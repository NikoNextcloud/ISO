const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function loadTypeScriptModule(filename, aliases = {}) {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const defaultRequire = loaded.require.bind(loaded);
  loaded.require = (request) => aliases[request] ?? defaultRequire(request);
  loaded._compile(compiled, filename);
  return loaded.exports;
}

const zip = loadTypeScriptModule(path.join(__dirname, "..", "src", "lib", "zip.ts"));
const review = loadTypeScriptModule(
  path.join(__dirname, "..", "src", "lib", "ai-document-review.ts"),
  { "@/lib/zip": zip }
);

test("extracts reviewable Bulgarian paragraphs from generated DOCX files", () => {
  const docx = zip.writeZip([
    {
      name: "word/document.xml",
      data: Buffer.from('<w:document xmlns:w="w"><w:p><w:r><w:t>Организацията управлява процесите, но това изречение има достатъчно съдържание за езиков преглед.</w:t></w:r></w:p><w:p><w:r><w:t>Кратко</w:t></w:r></w:p></w:document>')
    }
  ]);
  const archive = zip.writeZip([{ name: "ISO 9001 - Фирма/Наръчник.docx", data: docx }]);
  const result = review.extractReviewSegments(archive);
  assert.equal(result.totalFiles, 1);
  assert.equal(result.reviewedFiles, 1);
  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0].files[0], "Наръчник.docx");
  assert.match(result.segments[0].text, /езиков преглед/);
});

test("normalizes one AI suggestion for every file containing the same text", () => {
  const batch = [{
    id: "s1",
    text: "Организацията управлява свойте процеси по установен и документиран ред.",
    files: ["Наръчник.docx", "Процедура.docx"]
  }];
  const result = review.normalizeReviewSuggestions({
    suggestions: [{
      id: "s1",
      suggested: "Организацията управлява своите процеси по установен и документиран ред.",
      reason: "Правописна корекция.",
      category: "language",
      confidence: 0.98
    }]
  }, batch);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((item) => item.file), ["Наръчник.docx", "Процедура.docx"]);
  assert.ok(result.every((item) => item.category === "language" && item.confidence === 0.98));
});

test("parses fenced Cloudflare model JSON and creates bounded batches", () => {
  const parsed = review.parseAiReviewJson('```json\n{"suggestions":[]}\n```');
  assert.deepEqual(parsed, { suggestions: [] });
  const segments = Array.from({ length: 5 }, (_, index) => ({
    id: `s${index}`,
    text: "Това е достатъчно дълъг текст за проверка и разпределяне в отделен пакет.",
    files: [`Файл-${index}.docx`]
  }));
  const batches = review.createReviewBatches(segments, 160, 2);
  assert.ok(batches.length >= 3);
  assert.ok(batches.every((batch) => batch.length <= 2));
});
