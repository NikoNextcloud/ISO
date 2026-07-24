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
const generator = loadTypeScriptModule(
  path.join(__dirname, "..", "src", "lib", "iso-system-export.ts"),
  { "@/lib/zip": zip }
);

function officeArchiveText(archive) {
  const output = [];
  for (const entry of zip.readZip(archive)) {
    if (!/\.docx$/i.test(entry.name)) continue;
    for (const nested of zip.readZip(entry.data)) {
      if (/^(?:word|docProps)\/.*\.xml$/i.test(nested.name)) output.push(nested.data.toString("utf8"));
    }
  }
  return output.join("\n");
}

test("ISO 9001 generation removes foreign companies, sectors and obsolete periods", async () => {
  const result = await generator.createIsoSystemArchive({
    companyName: '"ФОТЕКС" ООД',
    uic: "112041415",
    legalForm: "ООД",
    address: "гр. Батак, п.к. 4580, ул. Родопи № 3",
    city: "Батак",
    manager: "АНГЕЛ ПЕТРОВ КЛИМЕНТОВ",
    preparedBy: "Отговорник поддръжка",
    foundedAt: "2009-05-25",
    phone: "0888 123 456",
    activity: "дърводобив и дървопреработване",
    scope: "Дърводобив, дървопреработване и производство на фасониран дървен материал",
    physicalScope: "горски обекти, производствен цех, сушилни, складове и административен офис в гр. Батак",
    organizationContext: "Организацията работи на пазара на дървен материал при променящи се клиентски, нормативни, технологични и климатични условия.",
    processesDescription: "управление, договаряне, дърводобив, транспорт, разтоварване, бичене, сушене, сортиране, складиране, контрол на качеството, експедиция и поддръжка",
    productsServices: "фасониран дървен материал, дървени заготовки и услуги по дървопреработване",
    externalParties: "клиенти, доставчици, собственици, служители, контролни органи, местна общност и външни изпълнители",
    designDevelopment: "not_applicable",
    postDeliveryActivities: "експедиция, доставка, обработване на рекламации и проследяване на удовлетвореността",
    trainingDetails: "Вътрешно обучение по ISO 9001:2015, проведено от представителя на ръководството",
    internalAuditDate: "2026-01-27",
    managementReviewDate: "2026-01-28",
    previousYear: 2025,
    currentYear: 2026,
    effectiveDate: "2026-01-12",
    version: "1"
  }, generator.iso9001ExportConfig);

  if (process.env.ISO9001_TEST_OUTPUT) fs.writeFileSync(process.env.ISO9001_TEST_OUTPUT, result.archive);
  const text = officeArchiveText(result.archive).toLocaleLowerCase("bg");
  const forbidden = [
    "артпласт", "деон-бг", "балканремонт инженеринг",
    "система за управление на околната среда", "обмен на информация по околна среда",
    "инвестиционна стратегия", "търговска стратегия", "приемлива насрещна страна",
    "финансови средства с незаконен произход", "безопасност на храните",
    "област ямбол", "гр. ямбол", "сириус груп с",
    "продажби и магазини", "търговски екип по развитие",
    "следпродажбена поддръжка", "след сервизна поддръжка",
    "титанов диоксид", "вътреболничните инфекции",
    "фирмата извършва търговски услуги", "за 2019 година", "за 2020 година",
    "хранителните чували", "монтаж", "инсталация", "ръководител предоставяне на услуги",
    "2020година", "актуален към 2022", "202 2 г.",
    "интегрирана система", "документ ису", "по ису", "на ису", "за ису", "кису"
  ];
  const remaining = forbidden.filter((pattern) => text.includes(pattern));
  assert.deepEqual(remaining, []);
  assert.deepEqual(
    result.report.files
      .filter((file) => file.contentWarnings.length)
      .map((file) => ({ name: file.name, warnings: file.contentWarnings })),
    []
  );
  assert.ok(result.report.changedFiles >= 25);
  assert.match(result.filename, /ISO-9001-ФОТЕКС ООД\.zip/);
});

test("ISO 9001 rejects clause 8.3 as applicable without a real design process", async () => {
  await assert.rejects(
    generator.createIsoSystemArchive({
      companyName: "Тест ООД",
      uic: "123456789",
      address: "гр. София",
      city: "София",
      manager: "Иван Иванов",
      foundedAt: "2020-01-01",
      effectiveDate: "2026-01-01",
      version: "1",
      activity: "производство на дървен материал",
      scope: "производство на дървен материал",
      productsServices: "дървен материал",
      physicalScope: "производствен цех",
      organizationContext: "производствена организация",
      processesDescription: "доставка, производство, контрол и експедиция",
      externalParties: "клиенти и доставчици",
      designDevelopment: "applicable",
      postDeliveryActivities: "доставка и рекламации",
      trainingDetails: "вътрешно обучение",
      internalAuditDate: "2026-01-20",
      managementReviewDate: "2026-01-25",
      previousYear: 2025,
      currentYear: 2026
    }, generator.iso9001ExportConfig),
    /Клауза 8\.3 е отбелязана като приложима/
  );
});
