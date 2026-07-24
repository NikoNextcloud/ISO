const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function loadTypeScriptModule(filename) {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(compiled, filename);
  return loaded.exports;
}

const zip = loadTypeScriptModule(path.join(__dirname, "..", "src", "lib", "zip.ts"));
const contentTypes = Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');

test("DOCX replaces split text, title metadata and matching logo", () => {
  const oldLogo = Buffer.from("old-word-logo");
  const newLogo = Buffer.from("new-word-logo");
  const archive = zip.writeZip([
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "word/document.xml", data: Buffer.from('<w:document xmlns:w="w"><w:p><w:r><w:t>Стара </w:t></w:r><w:r><w:t>Фирма</w:t></w:r><w:r><w:t>{{MANAGER}}</w:t></w:r></w:p></w:document>') },
    { name: "docProps/core.xml", data: Buffer.from('<cp:coreProperties xmlns:cp="cp" xmlns:dc="dc"><dc:title>Стара Фирма - политика</dc:title></cp:coreProperties>') },
    { name: "word/media/logo.png", data: oldLogo }
  ]);
  const result = zip.replaceWordTextWithStats(archive, [["Стара Фирма", "Нова Фирма"]], { data: newLogo, mode: "matching-images", sourceHashes: [sha(oldLogo)] });
  const entries = new Map(zip.readZip(result.buffer).map((entry) => [entry.name, entry.data]));
  assert.match(entries.get("word/document.xml").toString("utf8"), /Нова Фирма/);
  assert.match(entries.get("docProps/core.xml").toString("utf8"), /Нова Фирма - политика/);
  assert.match(entries.get("word/document.xml").toString("utf8"), /\{\{MANAGER\}\}/, "неподадено поле трябва да остане непроменено");
  assert.deepEqual(entries.get("word/media/logo.png"), newLogo);
  assert.equal(result.textReplacements, 2);
  assert.equal(result.logoReplacements, 1);
  assert.equal(result.changed, true);
});

test("XLSX replaces split cells, workbook attributes, title and matching logo", () => {
  const oldLogo = Buffer.from("old-sheet-logo");
  const newLogo = Buffer.from("new-sheet-logo");
  const archive = zip.writeZip([
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "xl/sharedStrings.xml", data: Buffer.from('<sst><si><r><t>Стар</t></r><r><t> Управител</t></r></si><si><t>{{ADDRESS}}</t></si></sst>') },
    { name: "xl/workbook.xml", data: Buffer.from('<workbook internalId="Стара Фирма"><sheets><sheet name="Стара Фирма" sheetId="1"/></sheets></workbook>') },
    { name: "docProps/core.xml", data: Buffer.from('<cp:coreProperties xmlns:cp="cp" xmlns:dc="dc"><dc:title>Стара Фирма</dc:title></cp:coreProperties>') },
    { name: "xl/media/logo.png", data: oldLogo }
  ]);
  const result = zip.replaceSpreadsheetTextWithStats(archive, [["Стар Управител", "Нов Управител"], ["Стара Фирма", "Нова Фирма"]], { data: newLogo, mode: "matching-images", sourceHashes: [sha(oldLogo)] });
  const entries = new Map(zip.readZip(result.buffer).map((entry) => [entry.name, entry.data]));
  assert.match(entries.get("xl/sharedStrings.xml").toString("utf8"), /Нов Управител/);
  assert.match(entries.get("xl/workbook.xml").toString("utf8"), /name="Нова Фирма"/);
  assert.match(entries.get("xl/workbook.xml").toString("utf8"), /internalId="Стара Фирма"/, "служебните XML атрибути не трябва да се променят");
  assert.match(entries.get("docProps/core.xml").toString("utf8"), /Нова Фирма/);
  assert.match(entries.get("xl/sharedStrings.xml").toString("utf8"), /\{\{ADDRESS\}\}/, "неподадено поле трябва да остане непроменено");
  assert.deepEqual(entries.get("xl/media/logo.png"), newLogo);
  assert.equal(result.textReplacements, 3);
  assert.equal(result.logoReplacements, 1);
  assert.equal(result.changed, true);
});

test("Office archive remains unchanged when no source value exists", () => {
  const archive = zip.writeZip([{ name: "word/document.xml", data: Buffer.from('<w:document xmlns:w="w"><w:t>Без промяна</w:t></w:document>') }]);
  const result = zip.replaceWordTextWithStats(archive, [["Несъществуваща стойност", "Нова стойност"]]);
  assert.equal(result.textReplacements, 0);
  assert.equal(result.logoReplacements, 0);
  assert.equal(result.changed, false);
});

test("DOCX can rebuild a contaminated body and replace a section between markers", () => {
  const document = [
    '<w:document xmlns:w="w"><w:body>',
    '<w:p><w:r><w:t>Стар финансов шаблон</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>РАЗДЕЛ 8.3.ПРОЕКТИРАНЕ И РАЗРАБОТВАНЕ</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Чужд текст за сервиз и монтаж</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>РАЗДЕЛ 8.4.УПРАВЛЕНИЕ НА ПРОЦЕСИ</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>Текст след секцията</w:t></w:r></w:p>',
    '<w:sectPr/></w:body></w:document>'
  ].join("");
  const archive = zip.writeZip([{ name: "word/document.xml", data: Buffer.from(document) }]);

  const section = zip.rewriteWordDocumentContentWithStats(archive, {
    mode: "between-markers",
    startMarker: "РАЗДЕЛ 8.3.ПРОЕКТИРАНЕ И РАЗРАБОТВАНЕ",
    endMarker: "РАЗДЕЛ 8.4.УПРАВЛЕНИЕ НА ПРОЦЕСИ",
    occurrence: "last",
    paragraphs: [{ text: "Клауза 8.3 не е приложима.", style: "heading1" }]
  });
  let xml = zip.readZip(section.buffer).find((entry) => entry.name === "word/document.xml").data.toString("utf8");
  assert.match(xml, /Клауза 8\.3 не е приложима/);
  assert.doesNotMatch(xml, /Чужд текст за сервиз и монтаж/);
  assert.match(xml, /РАЗДЕЛ 8\.4\.УПРАВЛЕНИЕ НА ПРОЦЕСИ/);

  const body = zip.rewriteWordDocumentContentWithStats(section.buffer, {
    mode: "body",
    paragraphs: [
      { text: "ПЛАН ЗА УПРАВЛЕНИЕ НА РИСКА", style: "title" },
      { text: "Риск от несъответстващ продукт.", style: "bullet" }
    ]
  });
  xml = zip.readZip(body.buffer).find((entry) => entry.name === "word/document.xml").data.toString("utf8");
  assert.match(xml, /ПЛАН ЗА УПРАВЛЕНИЕ НА РИСКА/);
  assert.match(xml, /• Риск от несъответстващ продукт/);
  assert.doesNotMatch(xml, /Стар финансов шаблон/);
  assert.match(xml, /<w:sectPr\/>/);
  assert.equal(section.changed, true);
  assert.equal(body.changed, true);
});

test("DOCX and XLSX allow a replacement that contains the original text", () => {
  const source = "Old Company";
  const replacement = "Old Company (AI edit)";
  const wordArchive = zip.writeZip([
    { name: "word/document.xml", data: Buffer.from(`<w:document xmlns:w="w"><w:t>${source}</w:t></w:document>`) },
    { name: "docProps/core.xml", data: Buffer.from(`<cp:coreProperties xmlns:cp="cp" xmlns:dc="dc"><dc:title>${source}</dc:title></cp:coreProperties>`) }
  ]);
  const sheetArchive = zip.writeZip([
    { name: "xl/sharedStrings.xml", data: Buffer.from(`<sst><si><t>${source}</t></si></sst>`) },
    { name: "xl/workbook.xml", data: Buffer.from(`<workbook><sheets><sheet name="${source}" sheetId="1"/></sheets></workbook>`) }
  ]);

  const wordResult = zip.replaceWordTextWithStats(wordArchive, [[source, replacement]]);
  const sheetResult = zip.replaceSpreadsheetTextWithStats(sheetArchive, [[source, replacement]]);
  const wordEntries = new Map(zip.readZip(wordResult.buffer).map((entry) => [entry.name, entry.data.toString("utf8")]));
  const sheetEntries = new Map(zip.readZip(sheetResult.buffer).map((entry) => [entry.name, entry.data.toString("utf8")]));

  assert.match(wordEntries.get("word/document.xml"), /Old Company \(AI edit\)/);
  assert.match(wordEntries.get("docProps/core.xml"), /Old Company \(AI edit\)/);
  assert.match(sheetEntries.get("xl/sharedStrings.xml"), /Old Company \(AI edit\)/);
  assert.match(sheetEntries.get("xl/workbook.xml"), /name="Old Company \(AI edit\)"/);
  assert.equal(wordResult.textReplacements, 2);
  assert.equal(sheetResult.textReplacements, 2);
});

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
