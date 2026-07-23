import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { readZip, replaceSpreadsheetTextWithStats, replaceWordTextWithStats, writeZip, type OfficeImageReplacement, type WordLogoReplacement, type ZipEntry } from "@/lib/zip";

export type IsoExportRequest = {
  companyName: string;
  uic?: string;
  legalForm?: string;
  address?: string;
  city?: string;
  manager?: string;
  foundedAt?: string;
  representative?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  employees?: number | string;
  activity?: string;
  scope?: string;
  physicalScope?: string;
  systemDate?: string;
  organizationContext?: string;
  processesDescription?: string;
  trainingDetails?: string;
  internalAuditDate?: string;
  managementReviewDate?: string;
  previousYear?: number | string;
  currentYear?: number | string;
  effectiveDate?: string;
  version?: string;
  preparedBy?: string;
  teamMember1?: string;
  teamMember2?: string;
  logoPngDataUrl?: string;
  aiVisuals?: Array<{
    title?: string;
    type?: string;
    pngDataUrl?: string;
    targetHash?: string;
  }>;
};

type NormalizedExportData = {
  companyName: string;
  uic: string;
  legalForm: string;
  address: string;
  city: string;
  manager: string;
  foundedAt: string;
  representative: string;
  contactName: string;
  email: string;
  phone: string;
  employees?: number;
  activity: string;
  scope: string;
  physicalScope: string;
  systemDate: string;
  organizationContext: string;
  processesDescription: string;
  trainingDetails: string;
  internalAuditDate: string;
  managementReviewDate: string;
  previousYear?: number;
  currentYear?: number;
  effectiveDate: string;
  version: string;
  preparedBy: string;
  teamMember1: string;
  teamMember2: string;
  logoPngDataUrl: string;
  aiVisuals: Array<{
    title: string;
    type: string;
    data: Buffer;
    targetHash: string;
  }>;
};

export type IsoExportConfig = {
  code: "ISO 9001" | "ISO 14001" | "ISO 27001" | "ISO 45001" | "ISO 50001" | "ISO 9-20-27" | "ISO 9-14" | "ISO 9001-14001-45001";
  edition: string;
  templateDirectory: "iso9001" | "iso14001" | "iso27001" | "iso45001" | "iso50001" | "iso902027" | "iso914" | "iso90011400145001";
  logoMode: WordLogoReplacement["mode"];
  logoSourceHashes?: string[];
  pathCompanyNames?: string[];
  replacements: (data: NormalizedExportData) => Array<[string, string]>;
};

export type IsoExportReport = {
  standard: string;
  companyName: string;
  generatedAt: string;
  totalFiles: number;
  changedFiles: number;
  unchangedFiles: number;
  wordFiles: number;
  spreadsheetFiles: number;
  legacyFiles: number;
  textReplacements: number;
  logoReplacements: number;
  imageReplacements: number;
  renamedPaths: number;
  appliedFields: string[];
  warnings: string[];
  files: Array<{
    name: string;
    format: string;
    changed: boolean;
    textReplacements: number;
    logoReplacements: number;
    imageReplacements: number;
    pathRenamed: boolean;
  }>;
};

export const iso9001ExportConfig: IsoExportConfig = {
  code: "ISO 9001",
  edition: "ISO 9001:2015",
  templateDirectory: "iso9001",
  logoMode: "matching-images",
  pathCompanyNames: ["Артпласт ЕООД", "Артпласт", "ДЕОН-БГ ЕООД", "ДЕОН-БГ"],
  replacements: (data) => {
    const result: Array<[string, string]> = [
      ["“Артпласт” ЕООД", data.companyName], ["“Артпласт“ ЕООД", data.companyName],
      ["„Артпласт” ЕООД", data.companyName], ["„Артпласт“ ЕООД", data.companyName],
      ["\"Артпласт\" ЕООД", data.companyName], ["Артпласт ЕООД", data.companyName],
      ["ДЕОН-БГ ЕООД", data.companyName]
    ];
    result.push(
      ...replacementsWhen(data.manager, (manager) => [
        ["ТОДОР ТОДОРОВ", manager.toLocaleUpperCase("bg")], ["Тодор Тодоров", manager], ["Боян Янев", manager]
      ]),
      ...replacementsWhen(data.address, (address) => [["гр. Ямбол", address]]),
      ...replacementsWhen(data.scope, (scope) => [
        ["Печат и обработващи операции върху текстил, производство и търговия на текстил и текстилни изделия. Щампиране, обагряне, избелване, боядисване и конфекциониране на текстилни изделия и продукти. Внос, износ и търговия със синтетични и щапелни влакна.", scope]
      ]),
      ...replacementsWhen(data.effectiveDate, (date) => {
        const formatted = formatDate(date);
        return [
          ["11.05.2020г.", `${formatted} г.`], ["11.05.2022г.", `${formatted} г.`],
          ["27.05.2020г.", `${formatted} г.`], ["27.05.2020г", `${formatted} г.`],
          ["27.05.2020 г.", `${formatted} г.`], ["27.05.2020.", `${formatted}.`],
          ["27.05.2020", formatted], ["16.06. 2020 г.", `${formatted} г.`],
          ["16.06.2020 г.", `${formatted} г.`], ["16.06.2020", formatted],
          ["17.06.2020 г.", `${formatted} г.`], ["17.06.2020г.", `${formatted} г.`],
          ["07.04.2020г.", `${formatted} г.`], ["02.05.2018", formatted],
          ["Май, 2022 г.", formatMonthYear(date)]
        ];
      }),
      ...replacementsWhen(data.version, (version) => [
        ["Версия: 001", `Версия: ${version}`], ["Версия:1", `Версия:${version}`], ["Версия 01", `Версия ${version}`],
        ["версия 01", `версия ${version}`]
      ])
    );
    return result;
  }
};

export const iso50001ExportConfig: IsoExportConfig = {
  code: "ISO 50001",
  edition: "ISO 50001:2018",
  templateDirectory: "iso50001",
  logoMode: "matching-images",
  pathCompanyNames: ["ТС КЪНСТРАКШЪН ЕООД", "ТС Кънстракшън ЕООД", "КОТЕК ЕООД"],
  replacements: (data) => {
    const result: Array<[string, string]> = [
      ["ТС КЪНСТРАКШЪН ЕООД", data.companyName], ["ТС Кънстракшън ЕООД", data.companyName],
      ["КОТЕК ЕООД", data.companyName]
    ];
    result.push(
      ...replacementsWhen(data.manager, (manager) => [
        ["ТЕОДОР ЕВГЕНИЕВ СЕРАФИМОВ", manager.toLocaleUpperCase("bg")],
        ["Теодор Евгениев Серафимов", manager], ["Теодор Серафимов", manager],
        ["Тодор Серафимов", manager], ["Борислав Тачев", manager], ["Боян Янев", manager]
      ]),
      ...replacementsWhen(data.representative, (representative) => [
        ["Невена Кръстева", representative]
      ]),
      ...replacementsWhen(data.preparedBy, (preparedBy) => [
        ["Емил Ръжчев", preparedBy], ["Емил Ръжев", preparedBy],
        ["Елена Ставрева", preparedBy], ["Константин Цеков", preparedBy]
      ]),
      ...replacementsWhen(data.uic, (uic) => [["206853231", uic]]),
      ...replacementsWhen(data.activity, (activity) => [
        ["Последните няколко години предприятието насочва все повече дейността си към предоставяне на строителни услуги, в областта на жилищно и нежилищно строителство на сгради в региона на София. Компанията разполага с набор от транспортни средства и техника за извършване на дейностите в обхвата на сертификация.", `${data.companyName} извършва основна дейност: ${activity}.`]
      ]),
      ...replacementsWhen(data.effectiveDate, (date) => {
        const formatted = formatDate(date);
        return [
          ["09.06.2024г.", `${formatted} г.`], ["09.06.2024г", `${formatted} г.`],
          ["09.06.2025г.", `${formatted} г.`], ["09.06.2025г", `${formatted} г.`], ["09.06.2025", formatted],
          ["27.06.2024г.", `${formatted} г.`], ["27.06.2024г", `${formatted} г.`],
          ["04.07.2024г", `${formatted} г.`], ["10.07.2024г.", `${formatted} г.`],
          ["10.07.2025г", `${formatted} г.`], ["10.07.2026г.", `${formatted} г.`], ["10.07.2026г", `${formatted} г.`],
          ["10.09.2025г.", `${formatted} г.`], ["10.09.2025г", `${formatted} г.`],
          ["11.12.2025г.", `${formatted} г.`], ["11.12.2025г", `${formatted} г.`],
          ["13.12.2025 г.", `${formatted} г.`], ["13.12.2025г.", `${formatted} г.`], ["13.12.2025г", `${formatted} г.`]
        ];
      }),
      ...replacementsWhen(data.version, (version) => [
        ["Версия No.1.0", `Версия No.${version}`], ["Версия №1.0", `Версия №${version}`],
        ["Версия: 01", `Версия: ${version}`], ["Версия 01", `Версия ${version}`],
        ["версия 01", `версия ${version}`]
      ])
    );
    return result;
  }
};

export const iso14001ExportConfig: IsoExportConfig = {
  code: "ISO 14001",
  edition: "ISO 14001:2015",
  templateDirectory: "iso14001",
  logoMode: "matching-images",
  pathCompanyNames: ["БРАМАНД ЕООД", "БРАМАНД"],
  replacements: (data) => [
    ...replacementsWhen(data.address, (address) => [
      ["БРАМАНД  ЕООД е основана на 16.07.2009 г. в гр. София.", `${data.companyName} е организация с адрес: ${address}.`],
      ["БРАМАНД ЕООД е основана на 16.07.2009 г. в гр. София.", `${data.companyName} е организация с адрес: ${address}.`],
      ["гр. София", address]
    ]),
    ...replacementsWhen(data.activity, (activity) => [
      ["Производство на алуминиеви профили. Обработка, огъване и разкрояване на алуминиеви профили, производство и търговия на осветителни тела.", activity]
    ]),
    ["БРАМАНД  ЕООД", data.companyName], ["БРАМАНД ЕООД", data.companyName],
    ["„БРАМАНД“ ЕООД", data.companyName], ["\"БРАМАНД\" ЕООД", data.companyName],
    ...replacementsWhen(data.manager, (manager) => [["ДЕЯН МАНДАЛИЕВ", manager.toLocaleUpperCase("bg")], ["Деян Мандалиев", manager]]),
    ...replacementsWhen(data.effectiveDate, (date) => [
      ["01.03.2021г.", `${formatDate(date)} г.`], ["01.03.2021г", `${formatDate(date)} г.`],
      ["01.03.2021", formatDate(date)], ["20 21 г.", `${new Date(`${date}T00:00:00`).getFullYear()} г.`]
    ]),
    ...replacementsWhen(data.version, (version) => [
      ["Версия : 00 1", `Версия: ${version}`], ["Версия : 001", `Версия: ${version}`],
      ["Версия 01", `Версия ${version}`], ["Вариант : 1", `Вариант: ${version}`], ["Вариант:1", `Вариант: ${version}`]
    ])
  ]
};

export const iso27001ExportConfig: IsoExportConfig = {
  code: "ISO 27001",
  edition: "ISO/IEC 27001:2022",
  templateDirectory: "iso27001",
  logoMode: "header-images",
  pathCompanyNames: ["БМ ПРОТЕКШЪН ЕООД", "БМ ПРОТЕКШЪН"],
  replacements: (data) => {
    const companyVariants = [
      "“БМ ПРОТЕКШЪН“ ЕООД", "“БМ ПРОТЕКШЪН” ЕООД", "„БМ ПРОТЕКШЪН“ ЕООД", "„БМ ПРОТЕКШЪН” ЕООД",
      "\"БМ ПРОТЕКШЪН\" ЕООД", "БМ ПРОТЕКШЪН ЕООД"
    ];
    const result: Array<[string, string]> = [];
    result.push(
      ...replacementsWhen(data.manager, (manager) => [
        ["Владимира  Емилова", manager], ["Владимира Емилова", manager],
        ["Георги Златков Драмов", manager], ["Лилия Каменова - Тошева", manager]
      ]),
      ...replacementsWhen(data.effectiveDate, (date) => [
        ["13.01.2025", formatDate(date)], ["02.05.2025", formatDate(date)]
      ]),
      ...replacementsWhen(data.version, (version) => [
        ["Версия № 2", `Версия № ${version}`], ["Версия № 1", `Версия № ${version}`]
      ]),
      ...replacementsWhen(data.address, (address) => [
        ["Област: София (столица), Община: Столична", `Адрес: ${address}`],
        ["Населено място: гр. София, п.к. 1404", ""], ["р-н Триадица", ""], ["бул./ул. Силиврия № 5 офис 1", ""]
      ]),
      ...replacementsWhen(data.activity, (activity) => [
        ["“БМ ПРОТЕКШЪН“ ЕООД е организация предоставяща услуги, свързани с охрана на имущество на физически и юридически лица. Сигнално охранителна дейност. Охрана на обекти – недвижими имоти. Охрана на мероприятия.", `${data.companyName} е организация с основна дейност: ${activity}.`]
      ])
    );
    companyVariants.forEach((variant) => result.push([variant, data.companyName]));
    return result;
  }
};

export const iso45001ExportConfig: IsoExportConfig = {
  code: "ISO 45001",
  edition: "ISO 45001",
  templateDirectory: "iso45001",
  logoMode: "matching-images",
  pathCompanyNames: ["СМП ПЛЕВЕН ЕООД", "СМП ПЛЕВЕН"],
  logoSourceHashes: ["007edd5d4b66e5f0e100381691d731eba96a4b9199cc5a95cbdfd7ed23c7e4a8"],
  replacements: (data) => [
    ["„ СМП ПЛЕВЕН“ ЕООД", data.companyName], ["„СМП ПЛЕВЕН“ ЕООД", data.companyName],
    ["\"СМП ПЛЕВЕН\" ЕООД", data.companyName], ["СМП ПЛЕВЕН ЕООД", data.companyName],
    ...replacementsWhen(data.activity, (activity) => [
      ["машинно-ремонтни дейности", activity],
      ["монтажна, машинно-ремонтна и строително-монтажна дейност", activity]
    ]),
    ...replacementsWhen(data.manager, (manager) => [
      ["АДЕЛИЯ ТОМОВА ТОДОРОВА", manager.toLocaleUpperCase("bg")], ["Аделия Томова Тодорова", manager]
    ]),
    ...replacementsWhen(data.address, (address) => [
      ["гр. Плевен, п.к. 5800, ул. БОРИС ШИВАЧЕВ № 47, ет. 2", address],
      ["гр. Плевен", address]
    ]),
    ...replacementsWhen(data.email, (email) => [["smp_pleven@abv.bg", email]]),
    ...replacementsWhen(data.phone, (phone) => [["0896791347", phone]]),
    ...replacementsWhen(data.effectiveDate, (date) => [
      ["12 януари 2026 г.", formatLongDate(date)], ["12 януари 2026 г", formatLongDate(date)],
      ["12.01.2026 г.", formatDate(date)], ["12.01.2026г.", formatDate(date)],
      ["12.01.2026", formatDate(date)], ["23.02.2026", formatDate(date)]
    ]),
    ...replacementsWhen(data.version, (version) => [
      ["Версия: 01", `Версия: ${version}`], ["Версия: 0 1", `Версия: ${version}`],
      ["рев . ном .: 0 1", `рев. ном.: ${version}`], ["рев. ном.: 0 1", `рев. ном.: ${version}`]
    ])
  ]
};

export const iso902027ExportConfig: IsoExportConfig = {
  code: "ISO 9-20-27",
  edition: "ISO 9001:2015 + ISO/IEC 20000-1:2018 + ISO/IEC 27001",
  templateDirectory: "iso902027",
  logoMode: "matching-images",
  logoSourceHashes: [
    "5d6ddef4a69e19b9942a8dc3b8d5bfa9c0805a735004f497e7d625b83b95e181",
    "49aa6c5955c6d29145e39b076e84039b0ca316c7a28143abdc0cc5ff7406519d",
    "95a48d29c98862d39248d41e6d7293dcebdb56ad8f4cf054680f2552058fb05e",
    "b4286d493f38d5bd4fb50697b255246343344fbd5ae159b857fe4629c3bd5a68",
    "4c20acdfc6bc6cef282b146632036dc475b4f345990b9603772b96e6c3ea13d8",
    "826dbf2a3330b726110fec7a46e7f7d7ca975b546d118e0552dbfb713492ac46",
    "dd6fa2892851567356934c55245ec45dcd98facec950488b02a635396c020b15",
    "63c9e8e8df36c4048da6b89e9d3eda9891edee45ab0db359c44b254931f3827d",
    "f03b71eb770020c5e9a5ef48e4a7db79e87bc0d55af9f62d4198fcca79c73cd4",
    "f2a035628910913686a3254fa4b039192914e9c0c6a491c2e590046c79336667",
    "514a4921376c843f896b7046eb8525758723324df384e44b21907bddbf7604fe",
    "d658105eb1c9bcb13738d432ba206e3d9ee3a3c0b2977f54ec60280ca97c45b6",
    "f08b6e5ad452ec46a0c0b252bcc70c76c7570b51e37d8232835564736d8c1937",
    "3811f4bfeda135cf340392bc4ccd321266d6e304a9b697d117dcb0470256a33f",
    "9c76aabdeb4dd80225f9a44e8c48e45dd587c6eb5f783a79a9d3855262d17066",
    "9e769ee87da43bc3bbc76271879b3b24697f02156124a79d033f85205da29366"
  ],
  pathCompanyNames: [
    "ST Al. Atanassov", "Atanassov 24-08-2020", "Atanassov 21-08-2020",
    "ATanassov 2020", "Atanassov 2020", "Атанасов 2020", "Atanassov"
  ],
  replacements: (data) => {
    const companyVariants = [
      '"С-ТРЪСТ ГРУП" ЕООД', '„С-ТРЪСТ ГРУП“ ЕООД', '“С-ТРЪСТ ГРУП“ ЕООД',
      'С-ТРЪСТ ГРУП" ЕООД', '“С -ТРЪСТ ГРУП“ ЕООД',
      '"С-ТРЪСТ ГРУП',
      "C-TRUST GROUP LTD", "C-TRUST GROUP Ltd",
      '“С&T България” ЕООД', '„S&T България” ЕООД', '“С&Т България” ЕООД',
      '“C&T България” ЕООД', 'С &T България” ЕООД', "С&Т България ЕООД",
      '„С&Т България“ ЕООД', '„С & Т България“ ЕООД', '„C&T България“ ЕООД',
      '“S&T България” ЕООД', '„С&T България” ЕООД', '„С&T БЪЛГАРИЯ“ ЕООД',
      "С&T БЪЛГАРИЯ ЕООД", '“C&T България” ООД', '„С&Т България” ЕООД',
      '„S&T БЪЛГАРИЯ” ЕООД', '„С&T България“ ЕООД', 'С &T БЪЛГАРИЯ” ЕООД',
      "С & Т България ЕООД", '„C&T България” ЕООД', '“S&T България” ООД',
      '“С&T България” ООД', "С &T БЪЛГАРИЯ ЕООД", "S&T България ЕООД",
      '„С &T БЪЛГАРИЯ” ЕООД', 'C&T България” ЕООД', '„С&Т БЪЛГАРИЯ” ЕООД',
      'S & T  България” ООД', 'C&T България“ ЕООД', "С &T България ЕООД",
      '“С&Т БЪЛГАРИЯ” ЕООД', '„С&T БЪЛГАРИЯ” ЕООД', "С &Т България ЕООД",
      '“S&T БЪЛГАРИЯ” ЕООД', '“С &Т България” ЕООД', "С&Т  България  ЕООД",
      "С & Т България  ЕООД", 'S&T България” ЕООД', '„С &T  България” ЕООД',
      'С&T България” ЕООД', '„С &T България” ЕООД', 'С & T  България” ЕООД',
      'С&Т България“ ЕООД', '„С&T България” ООД', "С &T България  еоод",
      "С&T България ЕООД", "C & T  България ЕООД", '“С&T БЪЛГАРИЯ” ЕООД',
      'C & T  България” ЕООД', 'C &T България” ЕООД', "S&T Bulgaria EOOD",
      "S&T BULGARIA EOOD", "S & T Bulgaria EOOD", "S   &   T Bulgaria EOOD",
      'СиТ  България“  ЕООД', '„СиТ България“  ЕООД',
      "С-ТРЪСТ ГРУП", "C-TRUST GROUP", "S&T България", "С&T България",
      "С&Т България", "C&T България", "С &T България", "С & Т България",
      "C &T България", "C & T България", "S&T Bulgaria", "СиТ България"
    ];
    return [
      ...companyVariants.map((variant) => [variant, data.companyName] as [string, string]),
      ...replacementsWhen(data.manager, (manager) => [
        ["Станимир Николов", manager], ["СТАНИМИР НИКОЛОВ", manager.toLocaleUpperCase("bg")],
        ["Злати Петров", manager], ["ЗЛАТИ ПЕТРОВ", manager.toLocaleUpperCase("bg")]
      ]),
      ...replacementsWhen(data.representative, (representative) => [["Васил Минев", representative]]),
      ...replacementsWhen(data.uic, (uic) => [["831131023", uic], ["202755117", uic]]),
      ...replacementsWhen(data.email, (email) => [["snt@snt.bg", email]])
    ];
  }
};

export const iso90011400145001ExportConfig: IsoExportConfig = {
  code: "ISO 9001-14001-45001",
  edition: "ISO 9001:2015 + ISO 14001:2015 + ISO 45001:2018",
  templateDirectory: "iso90011400145001",
  logoMode: "matching-images",
  logoSourceHashes: ["726c7493f4198568da2325458f5ec6ff310609243f5d4c47e8721e2ecad05755"],
  pathCompanyNames: [
    "ЕКОБУЛ ПАРТНЕР ООД",
    "ЕКОБУЛ ПАРТНЕР",
    "БАЛКАНРЕМОНТ ИНЖЕНЕРИНГ ООД",
    "БАЛКАНРЕМОНТ ИНЖЕНЕРИНГ"
  ],
  replacements: (data) => {
    const companyVariants = [
      "\"ЕКОБУЛ ПАРТНЕР\" ООД",
      "\"\"ЕКОБУЛ ПАРТНЕР\" ООД",
      "„ЕКОБУЛ ПАРТНЕР“ ООД",
      "„ ЕКОБУЛ ПАРТНЕР“ ООД",
      "ЕКОБУЛ ПАРТНЕР ООД",
      "\"БАЛКАНРЕМОНТ ИНЖЕНЕРИНГ\" ООД",
      "„БАЛКАНРЕМОНТ ИНЖЕНЕРИНГ“ ООД",
      "БАЛКАНРЕМОНТ ИНЖЕНЕРИНГ ООД",
      "ЕКОБУЛ ПАРТНЕР",
      "БАЛКАНРЕМОНТ ИНЖЕНЕРИНГ"
    ];
    return [
      ...companyVariants.map((variant) => [variant, data.companyName] as [string, string]),
      ...replacementsWhen(data.manager, (manager) => [
        ["Иван Георгиев", manager],
        ["ИВАН ГЕОРГИЕВ", manager.toLocaleUpperCase("bg")]
      ]),
      ...replacementsWhen(data.uic, (uic) => [["206395182", uic]]),
      ...replacementsWhen(data.city, (city) => [
        ["гр. Пазарджик", city.toLocaleLowerCase("bg").startsWith("гр.") ? city : `гр. ${city}`]
      ]),
      ...replacementsWhen(data.address, (address) => [
        ["гр. Пазарджик, област Пазарджик, община Пазарджик ул Найчо Цанов №11", address],
        ["гр. Пазарджик, област Пазарджик, община Пазарджик, ул. Найчо Цанов №11", address],
        ["гр. Пазарджик", address]
      ]),
      ...replacementsWhen(data.foundedAt, (date) => [
        ["15.02.2021 г.", `${formatDate(date)} г.`],
        ["15.02.2021", formatDate(date)]
      ]),
      ...replacementsWhen(data.email, (email) => [["office@ecobul.eu", email]]),
      ...replacementsWhen(data.phone, (phone) => [["0897550025", phone]]),
      ...replacementsWhen(data.activity, (activity) => [
        ["Складиране, съхранение, обработка, разглобяване, сортиране и разкомплектоване на ИУЕЕО и отпадъчни тонер касети", activity],
        ["извършва дейности по третиране на отпадъци", `извършва основна дейност: ${activity}`]
      ]),
      ...replacementsWhen(data.physicalScope, (scope) => [
        ["Работни площадки, складове, административни помещения, инфраструктура, информационни системи", scope]
      ]),
      ...replacementsWhen(data.organizationContext, (context) => [
        ["Има текстове за дейността на фирмата", context]
      ]),
      ...replacementsWhen(data.processesDescription, (processes) => [
        ["Управление, услуги, доставки, склад, клиенти, одити, несъответствия и др.", processes]
      ]),
      ...replacementsWhen(data.trainingDetails, (training) => [
        ["05.01.2022 г., обучител „Сириус Груп С“ ЕООД", training],
        ["05.01.2022 г., обучител \"Сириус Груп С\" ЕООД", training]
      ]),
      ...replacementsWhen(data.effectiveDate, (date) => {
        const formatted = formatDate(date);
        const internalAudit = formatDate(data.internalAuditDate || date);
        const managementReview = formatDate(data.managementReviewDate || date);
        return [
          ["27.01.2022 г.", `${internalAudit} г.`],
          ["27.01.2022 г", `${internalAudit} г.`],
          ["27.01.2022", internalAudit],
          ["20.01.2022 г.", `${formatted} г.`],
          ["20.01.2022", formatted],
          ["28.01.2022 г.", `${managementReview} г.`],
          ["28.01.2022г.", `${managementReview} г.`],
          ["28.01.2022", managementReview],
          ["20.12.2021 г.", `${formatted} г.`],
          ["20.12.2021", formatted],
          ["27.01.2021 г.", `${formatted} г.`],
          ["27.01.2021", formatted],
          ["25.10.2021г.", `${formatted} г.`],
          ["25.10.2021", formatted],
          ["03.07.2021г.", `${formatted} г.`],
          ["03.07.2021", formatted]
        ];
      }),
      ...replacementsWhen(data.version, (version) => [
        ["Версия: 01", `Версия: ${version}`],
        ["Версия 01", `Версия ${version}`],
        ["версия 01", `версия ${version}`],
        ["Ревизия: 01", `Ревизия: ${version}`],
        ["Ревизия 01", `Ревизия ${version}`]
      ])
    ];
  }
};

export const iso914ExportConfig: IsoExportConfig = {
  code: "ISO 9-14",
  edition: "ISO 9001:2015 + ISO 14001:2015",
  templateDirectory: "iso914",
  logoMode: "matching-images",
  pathCompanyNames: ["Братя Панчеви ООД", "Братя Панчеви"],
  replacements: (data) => {
    const companyVariants = [
      "„Братя Панчеви“ ООД", "“Братя Панчеви” ООД", '"Братя Панчеви" ООД',
      "Братя Панчеви ООД", "„БРАТЯ ПАНЧЕВИ“ ООД", "БРАТЯ ПАНЧЕВИ ООД"
    ];
    return [
      ...companyVariants.map((variant) => [variant, data.companyName] as [string, string]),
      ...replacementsWhen(data.manager, (manager) => [
        ["Ташко Панчев", manager], ["ТАШКО ПАНЧЕВ", manager.toLocaleUpperCase("bg")]
      ]),
      ...replacementsWhen(data.address, (address) => [
        ["Дружеството е с адрес на управление: Ямбол, Община: Ямбол", `Дружеството е с адрес на управление: ${address}`],
        ["Населено място: гр. Ямбол, п.к. 8600 ул. Малко Търново № 4", `Адрес: ${address}`]
      ]),
      ...replacementsWhen(data.effectiveDate, (date) => [
        ["06.02.2023", formatDate(date)],
        ["2023г.", `${new Date(`${date}T00:00:00`).getFullYear()}г.`],
        ["2023 г.", `${new Date(`${date}T00:00:00`).getFullYear()} г.`]
      ])
    ];
  }
};

export function getIsoExportConfig(code: string) {
  return [
    iso9001ExportConfig, iso14001ExportConfig, iso27001ExportConfig, iso45001ExportConfig,
    iso50001ExportConfig, iso902027ExportConfig,
    iso90011400145001ExportConfig, iso914ExportConfig
  ].find((config) => config.code === code);
}

export async function authorizeIsoExport(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return true;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return !error && Boolean(data.user);
}

export async function loadActiveTemplatePackage(request: NextRequest, standard: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return undefined;
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const result = await client.from("template_versions").select("storage_path").eq("standard", standard).eq("is_active", true).maybeSingle();
  if (result.error || !result.data?.storage_path) return undefined;
  const download = await client.storage.from("iso-templates").download(result.data.storage_path);
  if (download.error) throw new Error(`Активната версия на шаблона не може да бъде заредена: ${download.error.message}`);
  return Buffer.from(await download.data.arrayBuffer());
}

export async function createIsoSystemArchive(body: IsoExportRequest, config: IsoExportConfig, templatePackage?: Buffer) {
  const data = normalizeRequest(body);
  const templateRoot = path.join(process.cwd(), "templates", config.templateDirectory);
  const files = templatePackage ? templateFilesFromZip(templatePackage) : await walk(templateRoot);
  if (!files.length) throw new Error(`Няма налични шаблони за ${config.code}.`);

  const logoData = decodeLogo(data.logoPngDataUrl);
  const logo = logoData ? { data: logoData, mode: config.logoMode, sourceHashes: config.logoSourceHashes } satisfies WordLogoReplacement : undefined;
  const imageReplacements = data.aiVisuals
    .filter((visual) => visual.targetHash)
    .map((visual) => ({ data: visual.data, sourceHash: visual.targetHash })) satisfies OfficeImageReplacement[];
  const pathTitleReplacements = (config.pathCompanyNames ?? []).map((source) => [source, data.companyName] as [string, string]);
  const replacements = [...baseReplacements(data), ...pathTitleReplacements, ...config.replacements(data)];
  const folder = `${config.code} - ${safeName(data.companyName)}`;
  const entries: ZipEntry[] = [];
  const fileResults: IsoExportReport["files"] = [];

  for (const file of files) {
    let content = file.data ?? await fs.readFile(file.absolute!);
    const lowerName = file.relative.toLocaleLowerCase("bg");
    const outputPath = replaceCompanyInPath(file.relative, config.pathCompanyNames, data.companyName);
    let textReplacements = 0;
    let logoReplacements = 0;
    let replacedImages = 0;
    if (lowerName.endsWith(".docx")) {
      const result = replaceWordTextWithStats(content, replacements, logo, imageReplacements);
      content = result.buffer;
      textReplacements = result.textReplacements;
      logoReplacements = result.logoReplacements;
      replacedImages = result.imageReplacements;
    } else if (lowerName.endsWith(".xlsx")) {
      const result = replaceSpreadsheetTextWithStats(content, replacements, logo, imageReplacements);
      content = result.buffer;
      textReplacements = result.textReplacements;
      logoReplacements = result.logoReplacements;
      replacedImages = result.imageReplacements;
    }
    const pathRenamed = outputPath !== file.relative;
    fileResults.push({
      name: outputPath,
      format: path.extname(file.relative).slice(1).toUpperCase() || "FILE",
      changed: pathRenamed || textReplacements + logoReplacements + replacedImages > 0,
      textReplacements,
      logoReplacements,
      imageReplacements: replacedImages,
      pathRenamed
    });
    entries.push({ name: path.posix.join(folder, outputPath), data: content });
  }

  const report = createExportReport(config, data, fileResults);

  data.aiVisuals.forEach((visual, index) => {
    const name = `${String(index + 1).padStart(2, "0")} - ${safeName(visual.title || visual.type || "AI визуализация")}.png`;
    entries.push({ name: path.posix.join(folder, "AI визуализации", name), data: visual.data });
  });

  const summary = [
    `${config.edition} - комплект документация`, `Организация: ${data.companyName}`,
    ...summaryWhen(data.uic, "ЕИК"), ...summaryWhen(data.legalForm, "Правна форма"),
    ...summaryWhen(data.address, "Седалище/адрес"), ...summaryWhen(data.city, "Град"),
    ...summaryWhen(data.manager, "Управител"), ...summaryWhen(data.foundedAt ? formatDate(data.foundedAt) : "", "Дата на създаване"),
    ...summaryWhen(data.preparedBy, "Изготвил/Отговорник"),
    ...summaryWhen(data.activity, "Обхват на дейност"), ...summaryWhen(data.scope, "Обхват"),
    ...summaryWhen(data.physicalScope, "Физически обхват"),
    ...summaryWhen(data.organizationContext, "Контекст на организацията"),
    ...summaryWhen(data.processesDescription, "Процеси"), ...summaryWhen(data.trainingDetails, "Обучения"),
    ...summaryWhen(data.internalAuditDate ? formatDate(data.internalAuditDate) : "", "Вътрешен одит"),
    ...summaryWhen(data.managementReviewDate ? formatDate(data.managementReviewDate) : "", "Преглед от ръководството"),
    ...summaryWhen(data.previousYear === undefined ? "" : String(data.previousYear), "Предходна година"),
    ...summaryWhen(data.currentYear === undefined ? "" : String(data.currentYear), "Настояща година"),
    ...summaryWhen(data.effectiveDate ? formatDate(data.effectiveDate) : "", "Дата на влизане в сила"),
    ...summaryWhen(data.version, "Версия"),
    `Дата на генериране: ${formatDate(new Date().toISOString().slice(0, 10))}`, `Документи: ${files.length}`,
    `Фирмено лого: ${logoData ? "заменено в приложимите шаблони" : "оригиналните изображения са запазени"}`,
    `AI визуализации: ${data.aiVisuals.length}`,
    "",
    "РЕЗУЛТАТ ОТ ПРОВЕРКАТА",
    `Променени файлове: ${report.changedFiles} от ${report.totalFiles}`,
    `Текстови замени: ${report.textReplacements}`,
    `Сменени фирмени лога: ${report.logoReplacements}`,
    `Сменени служебни изображения: ${report.imageReplacements}`,
    `Преименувани файлове/папки: ${report.renamedPaths}`,
    `Предупреждения: ${report.warnings.length ? report.warnings.join("; ") : "няма"}`
  ].join("\r\n");
  entries.unshift({ name: path.posix.join(folder, "README - ДАННИ ЗА ЕКСПОРТА.txt"), data: Buffer.from(summary, "utf8") });
  entries.unshift({ name: path.posix.join(folder, "ПРОВЕРКА НА ГЕНЕРИРАНЕТО.json"), data: Buffer.from(JSON.stringify(report, null, 2), "utf8") });

  return {
    archive: writeZip(entries),
    filename: `${config.code.replace("ISO ", "ISO-")}-${safeName(data.companyName)}.zip`,
    documentCount: files.length,
    report
  };
}

function templateFilesFromZip(archive: Buffer) {
  const entries = readZip(archive).filter((entry) => !entry.directory && !entry.name.startsWith("__MACOSX/") && !entry.name.endsWith(".DS_Store"));
  if (!entries.length) throw new Error("Качената версия на шаблона е празна.");
  if (entries.length > 1000) throw new Error("Качената версия съдържа твърде много файлове.");
  const expandedSize = entries.reduce((sum, entry) => sum + entry.data.length, 0);
  if (expandedSize > 300 * 1024 * 1024) throw new Error("Качената версия е твърде голяма след разархивиране.");
  const firstParts = entries.map((entry) => entry.name.replaceAll("\\", "/").split("/"));
  const commonRoot = firstParts.every((parts) => parts.length > 1 && parts[0] === firstParts[0][0]) ? firstParts[0][0] : "";
  return entries.map((entry) => ({
    relative: commonRoot ? entry.name.replaceAll("\\", "/").slice(commonRoot.length + 1) : entry.name.replaceAll("\\", "/"),
    data: entry.data,
    absolute: undefined as string | undefined
  })).filter((entry) => entry.relative);
}

export function isoExportReportHeaders(report: IsoExportReport) {
  return {
    "X-Changed-Files": String(report.changedFiles),
    "X-Unchanged-Files": String(report.unchangedFiles),
    "X-Text-Replacements": String(report.textReplacements),
    "X-Logo-Replacements": String(report.logoReplacements),
    "X-Image-Replacements": String(report.imageReplacements),
    "X-Legacy-Files": String(report.legacyFiles),
    "X-Report-Warnings": encodeURIComponent(report.warnings.join(" | "))
  };
}

function createExportReport(config: IsoExportConfig, data: NormalizedExportData, files: IsoExportReport["files"]): IsoExportReport {
  const legacyFiles = files.filter((file) => file.format === "XLS" || file.format === "DOC").length;
  const warnings: string[] = [];
  if (legacyFiles) warnings.push(`${legacyFiles} стари XLS/DOC файла не поддържат автоматична проверка на съдържанието`);
  if (data.logoPngDataUrl && !files.some((file) => file.logoReplacements > 0)) warnings.push("Не е намерено подходящо фирмено лого за замяна");
  if (data.aiVisuals.some((visual) => visual.targetHash) && !files.some((file) => file.imageReplacements > 0)) warnings.push("Не е намерено съвпадащо служебно изображение за замяна");
  const appliedFields = [
    ["Име на фирмата", data.companyName], ["ЕИК", data.uic], ["Правна форма", data.legalForm],
    ["Седалище/адрес", data.address], ["Град", data.city], ["Управител", data.manager],
    ["Дата на създаване", data.foundedAt],
    ["Представител", data.representative], ["Лице за контакт", data.contactName], ["Имейл", data.email], ["Телефон", data.phone],
    ["Изготвил/Отговорник", data.preparedBy],
    ["Член на енергийния екип 1", data.teamMember1], ["Член на енергийния екип 2", data.teamMember2],
    ["Брой служители", data.employees === undefined ? "" : String(data.employees)], ["Обхват на дейност", data.activity], ["Обхват", data.scope],
    ["Физически обхват", data.physicalScope], ["Дата на системата", data.systemDate],
    ["Контекст на организацията", data.organizationContext], ["Процеси", data.processesDescription],
    ["Обучения", data.trainingDetails], ["Вътрешен одит", data.internalAuditDate],
    ["Преглед от ръководството", data.managementReviewDate],
    ["Предходна година", data.previousYear === undefined ? "" : String(data.previousYear)],
    ["Настояща година", data.currentYear === undefined ? "" : String(data.currentYear)],
    ["Дата", data.effectiveDate], ["Версия", data.version]
  ].filter((entry) => entry[1]).map((entry) => entry[0]);
  return {
    standard: config.code,
    companyName: data.companyName,
    generatedAt: new Date().toISOString(),
    totalFiles: files.length,
    changedFiles: files.filter((file) => file.changed).length,
    unchangedFiles: files.filter((file) => !file.changed).length,
    wordFiles: files.filter((file) => file.format === "DOCX").length,
    spreadsheetFiles: files.filter((file) => file.format === "XLSX").length,
    legacyFiles,
    textReplacements: files.reduce((sum, file) => sum + file.textReplacements, 0),
    logoReplacements: files.reduce((sum, file) => sum + file.logoReplacements, 0),
    imageReplacements: files.reduce((sum, file) => sum + file.imageReplacements, 0),
    renamedPaths: files.filter((file) => file.pathRenamed).length,
    appliedFields,
    warnings,
    files
  };
}

function normalizeRequest(body: IsoExportRequest): NormalizedExportData {
  const systemDate = optionalText(body.systemDate, 20);
  return {
    companyName: requiredText(body.companyName, "Име на фирмата"), uic: optionalText(body.uic, 30),
    legalForm: optionalText(body.legalForm, 80), address: optionalText(body.address), city: optionalText(body.city, 120),
    manager: optionalText(body.manager), foundedAt: optionalText(body.foundedAt, 20), representative: optionalText(body.representative),
    contactName: optionalText(body.contactName), email: optionalText(body.email, 200), phone: optionalText(body.phone, 80),
    employees: optionalNumber(body.employees), activity: optionalText(body.activity, 1000), scope: optionalText(body.scope, 1500),
    physicalScope: optionalText(body.physicalScope, 1500), systemDate,
    organizationContext: optionalText(body.organizationContext, 2000),
    processesDescription: optionalText(body.processesDescription, 2000),
    trainingDetails: optionalText(body.trainingDetails, 1500),
    internalAuditDate: optionalText(body.internalAuditDate, 20),
    managementReviewDate: optionalText(body.managementReviewDate, 20),
    previousYear: optionalYear(body.previousYear), currentYear: optionalYear(body.currentYear),
    effectiveDate: optionalText(body.effectiveDate, 20) || systemDate, version: optionalText(body.version, 20),
    preparedBy: optionalText(body.preparedBy), teamMember1: optionalText(body.teamMember1), teamMember2: optionalText(body.teamMember2),
    logoPngDataUrl: optionalText(body.logoPngDataUrl, 5_800_000),
    aiVisuals: normalizeAiVisuals(body.aiVisuals)
  };
}

function baseReplacements(data: NormalizedExportData): Array<[string, string]> {
  const result: Array<[string, string]> = [["{{COMPANY_NAME}}", data.companyName]];
  const optionalValues: Array<[string, string]> = [
    ["{{UIC}}", data.uic], ["{{LEGAL_FORM}}", data.legalForm], ["{{ADDRESS}}", data.address],
    ["{{CITY}}", data.city], ["{{MANAGER}}", data.manager],
    ["{{FOUNDED_AT}}", data.foundedAt ? formatDate(data.foundedAt) : ""],
    ["{{REPRESENTATIVE}}", data.representative], ["{{CONTACT_NAME}}", data.contactName],
    ["{{EMAIL}}", data.email], ["{{PHONE}}", data.phone], ["{{ACTIVITY}}", data.activity],
    ["{{SCOPE}}", data.scope], ["{{PHYSICAL_SCOPE}}", data.physicalScope],
    ["{{SYSTEM_DATE}}", data.systemDate ? formatDate(data.systemDate) : ""],
    ["{{ORGANIZATION_CONTEXT}}", data.organizationContext], ["{{PROCESSES}}", data.processesDescription],
    ["{{TRAINING_DETAILS}}", data.trainingDetails],
    ["{{INTERNAL_AUDIT_DATE}}", data.internalAuditDate ? formatDate(data.internalAuditDate) : ""],
    ["{{MANAGEMENT_REVIEW_DATE}}", data.managementReviewDate ? formatDate(data.managementReviewDate) : ""],
    ["{{EFFECTIVE_DATE}}", data.effectiveDate ? formatDate(data.effectiveDate) : ""],
    ["{{VERSION}}", data.version], ["{{PREPARED_BY}}", data.preparedBy],
    ["{{TEAM_MEMBER_1}}", data.teamMember1], ["{{TEAM_MEMBER_2}}", data.teamMember2]
  ];
  optionalValues.forEach(([placeholder, value]) => { if (value) result.push([placeholder, value]); });
  if (data.employees !== undefined) result.push(["{{EMPLOYEES}}", String(data.employees)]);
  if (data.previousYear !== undefined) result.push(["{{PREVIOUS_YEAR}}", String(data.previousYear)]);
  if (data.currentYear !== undefined) result.push(["{{CURRENT_YEAR}}", String(data.currentYear)]);
  return result;
}

function decodeLogo(value: string) {
  if (!value) return undefined;
  const match = /^data:image\/png;base64,([a-z0-9+/=]+)$/i.exec(value);
  if (!match) throw new Error("Логото трябва да бъде валидно PNG изображение.");
  const data = Buffer.from(match[1], "base64");
  if (data.length > 4_000_000) throw new Error("Логото е твърде голямо. Максималният размер е 4 MB.");
  if (data.length < 8 || data.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("Логото не е валиден PNG файл.");
  return data;
}

function normalizeAiVisuals(value: IsoExportRequest["aiVisuals"]) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).map((item, index) => {
    const pngDataUrl = optionalText(item?.pngDataUrl, 4_500_000);
    if (!pngDataUrl) throw new Error(`Липсва изображение за AI визуализация ${index + 1}.`);
    return {
      title: optionalText(item?.title, 120) || `AI визуализация ${index + 1}`,
      type: optionalText(item?.type, 80),
      data: decodePngDataUrl(pngDataUrl, `AI визуализация ${index + 1}`),
      targetHash: /^[a-f0-9]{64}$/i.test(item?.targetHash ?? "") ? item!.targetHash!.toLowerCase() : ""
    };
  });
}

function decodePngDataUrl(value: string, label: string) {
  const match = /^data:image\/png;base64,([a-z0-9+/=]+)$/i.exec(value);
  if (!match) throw new Error(`${label} трябва да бъде валидно PNG изображение.`);
  const data = Buffer.from(match[1], "base64");
  if (data.length > 3_000_000) throw new Error(`${label} е твърде голяма. Максималният размер е 3 MB.`);
  if (data.length < 8 || data.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error(`${label} не е валиден PNG файл.`);
  }
  return data;
}

async function walk(directory: string, relative = ""): Promise<Array<{ absolute?: string; relative: string; data?: Buffer }>> {
  const items = await fs.readdir(directory, { withFileTypes: true });
  const result: Array<{ absolute?: string; relative: string; data?: Buffer }> = [];
  for (const item of items) {
    const absolute = path.join(directory, item.name);
    const childRelative = path.posix.join(relative, item.name);
    if (item.isDirectory()) result.push(...await walk(absolute, childRelative));
    else result.push({ absolute, relative: childRelative });
  }
  return result;
}

function requiredText(value: unknown, name: string, max = 250) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} е задължително поле.`);
  return value.trim().slice(0, max);
}

function optionalText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function optionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : undefined;
}

function optionalYear(value: unknown) {
  const year = optionalNumber(value);
  return year !== undefined && year >= 1900 && year <= 2200 ? year : undefined;
}

function replacementsWhen(value: string, build: (value: string) => Array<[string, string]>) {
  return value ? build(value) : [];
}

function summaryWhen(value: string, label: string) {
  return value ? [`${label}: ${value}`] : [];
}

function formatDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

function formatLongDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const months = ["януари", "февруари", "март", "април", "май", "юни", "юли", "август", "септември", "октомври", "ноември", "декември"];
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]} г.`;
}

function formatMonthYear(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const months = ["Януари", "Февруари", "Март", "Април", "Май", "Юни", "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември"];
  return `${months[Number(match[2]) - 1]}, ${match[1]} г.`;
}

function safeName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 70) || "Организация";
}

function replaceCompanyInPath(value: string, sourceNames: string[] | undefined, companyName: string) {
  let result = value;
  const replacement = safeName(companyName);
  for (const source of [...new Set(sourceNames ?? [])].sort((a, b) => b.length - a.length)) {
    result = result.replace(new RegExp(escapeRegExp(source), "giu"), () => replacement);
  }
  return result;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
