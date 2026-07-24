import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import {
  readZip,
  replaceSpreadsheetTextWithStats,
  replaceWordTextWithStats,
  rewriteWordDocumentContentWithStats,
  writeZip,
  type OfficeImageReplacement,
  type WordBodyParagraph,
  type WordContentRewrite,
  type WordLogoReplacement,
  type ZipEntry
} from "@/lib/zip";

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
  productsServices?: string;
  environmentalAspects?: string;
  occupationalRisks?: string;
  externalParties?: string;
  wasteManagement?: string;
  designDevelopment?: string;
  postDeliveryActivities?: string;
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
  aiTextEdits?: Array<{
    file?: string;
    source?: string;
    replacement?: string;
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
  productsServices: string;
  environmentalAspects: string;
  occupationalRisks: string;
  externalParties: string;
  wasteManagement: string;
  designDevelopment: "" | "applicable" | "not_applicable";
  postDeliveryActivities: string;
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
  aiTextEdits: Array<{
    file: string;
    source: string;
    replacement: string;
  }>;
};

export type IsoExportConfig = {
  code: "ISO 9001" | "ISO 14001" | "ISO 27001" | "ISO 45001" | "ISO 50001" | "ISO 9-20-27" | "ISO 9-14" | "ISO 9001-14001-45001";
  edition: string;
  templateDirectory: "iso9001" | "iso14001" | "iso27001" | "iso45001" | "iso50001" | "iso902027" | "iso914" | "iso90011400145001";
  logoMode: WordLogoReplacement["mode"];
  logoSourceHashes?: string[];
  pathCompanyNames?: string[];
  pathYearReplacements?: Array<[string, "previousYear" | "currentYear"]>;
  fileReplacements?: Array<{
    fileNameIncludes: string;
    replacements: (data: NormalizedExportData) => Array<[string, string]>;
  }>;
  wordContentRules?: Array<{
    fileNameIncludes: string;
    rewrite: (data: NormalizedExportData) => WordContentRewrite;
  }>;
  contentRisks?: Array<{
    label: string;
    patterns: string[];
  }>;
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
  aiTextReplacements: number;
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
    contentWarnings: string[];
    aiTextReplacements: number;
  }>;
};

export const iso9001ExportConfig: IsoExportConfig = {
  code: "ISO 9001",
  edition: "ISO 9001:2015",
  templateDirectory: "iso9001",
  logoMode: "matching-images",
  pathCompanyNames: [
    "Артпласт ЕООД", "Артпласт", "ДЕОН-БГ ЕООД", "ДЕОН-БГ",
    "БАЛКАНРЕМОНТ ИНЖЕНЕРИНГ ООД", "БАЛКАНРЕМОНТ ИНЖЕНЕРИНГ"
  ],
  pathYearReplacements: [["2019", "previousYear"], ["2020", "currentYear"]],
  contentRisks: [
    { label: "чужда фирма", patterns: ["АРТПЛАСТ", "ДЕОН-БГ", "БАЛКАНРЕМОНТ ИНЖЕНЕРИНГ"] },
    {
      label: "чуждо съдържание за околна среда",
      patterns: ["Система за управление на околната среда", "Обмен на информация по околна среда"]
    },
    {
      label: "финансов или инвестиционен шаблон",
      patterns: [
        "инвестиционна стратегия", "търговска стратегия", "приемлива насрещна страна",
        "финансови средства с незаконен произход", "инвестиционните посредници",
        "клиентски активи", "ползвани от посредника", "работа на посредника"
      ]
    },
    {
      label: "чуждо съдържание за безопасност на храните",
      patterns: ["безопасност на храните", "управление на безопасността на храните", "хранителните чували"]
    },
    {
      label: "стар отчетен период",
      patterns: [
        "за 2019 година", "за 2019 г.", "за 2020 година", "за 2020 г.", "за 2020 год.",
        "за 2020година", "актуален към 2022 г.", "актуален към 2022г.", "202 2 г."
      ]
    },
    { label: "грешен адрес в Ямбол", patterns: ["област Ямбол", "община Ямбол", "гр. Ямбол"] },
    { label: "стар обучител", patterns: ["Сириус Груп С"] },
    {
      label: "терминология за интегрирана система вместо СУК",
      patterns: ["интегрирана система", "интегрираната система", "документ ИСУ", "по ИСУ", "на ИСУ", "за ИСУ", "кИСУ"]
    },
    {
      label: "чужди роли и процеси по продажби, магазини или сервиз",
      patterns: [
        "Продажби и магазини", "Търговски екип по развитие", "Ръководителят Проектиране и разработка",
        "следпродажбена поддръжка", "след сервизна поддръжка", "осигурен качествен и надежден сервиз",
        "Ръководител Предоставяне на услуги"
      ]
    },
    { label: "чужди примери за монтаж или инсталация", patterns: ["външните процеси от доставчици като \"монтаж\"", "\"инсталация\""] },
    { label: "неприложим стар нормативен списък", patterns: ["титанов диоксид", "вътреболничните инфекции", "инвестиционните проекти и/или упражняване на строителен надзор"] },
    { label: "чужд профил „търговски услуги“", patterns: ["фирмата извършва търговски услуги"] }
  ],
  fileReplacements: [
    {
      fileNameIncludes: "НК - Ф - 2 Списък на заинтересованите страни.docx",
      replacements: () => [
        ["ПОС 4.4.3", "НК 4.2"],
        ["Система за управление на околната среда", "Система за управление на качеството"],
        ["Обмен на информация по околна среда, участие и консултиране", "Списък на заинтересованите страни и техните изисквания"]
      ]
    },
    {
      fileNameIncludes: "ПР 01 - Управление на документите.docx",
      replacements: (data) => [
        ["данни по качеството или безопасност на храните", "данни по качеството"],
        ["интегрираната системата за управление", "системата за управление на качеството"],
        ["Интегрираната система за управление", "Системата за управление на качеството"],
        [
          "Протоколи от изпитване на хранителните чували по време на производството и на крайните продукти, документи от входящ контрол по качеството, сертификати за качество и други.",
          `Протоколи от контрол и изпитване на ${sentenceFragment(data.productsServices)}, документи от входящ контрол, критерии за приемане, сертификати за качество и други приложими записи.`
        ]
      ]
    },
    {
      fileNameIncludes: "ПР 05 - Коригиращи действия.docx",
      replacements: () => [
        ["разходи за качество и безопасност на храните", "разходи за качество"],
        ["системата за управление на безопасността на храните", "системата за управление на качеството"]
      ]
    },
    {
      fileNameIncludes: "ПР 06 - Превантини действия.docx",
      replacements: () => [
        ["качеството и безопасността на храните", "качеството"]
      ]
    },
    {
      fileNameIncludes: "НК - Ф - 6 - Политика и цели.docx",
      replacements: () => [
        [
          "Гарантиране на качеството и безопасността на хранителните продукти чрез проследимост и непрекъснато подобряване.",
          "Гарантиране на качеството на продуктите и услугите чрез проследимост, контрол на процесите и непрекъснато подобряване."
        ],
        [
          "изисквания на клиентите за качеството и безопасност на хранителните продукти",
          "изисквания на клиентите за качеството на продуктите и услугите"
        ],
        ["безопасност на храните", "качество на продуктите и услугите"]
      ]
    },
    {
      fileNameIncludes: "Графиг на одита.docx",
      replacements: (data) => [
        ...yearPhraseReplacements(data),
        ["Политика по качеството, БЗР и ОС", "Политика и цели по качеството"],
        ...(data.designDevelopment === "not_applicable" ? [["Проектиране", "Управление на промените"] as [string, string]] : [])
      ]
    },
    {
      fileNameIncludes: "Заповед В О 2020.docx",
      replacements: (data) => yearPhraseReplacements(data)
    },
    {
      fileNameIncludes: "Рискове  2019.docx",
      replacements: (data) => yearPhraseReplacements(data)
    },
    {
      fileNameIncludes: "ПРОТОКОЛ ЗА ОБУЧЕНИЕ.docx",
      replacements: (data) => replacementsWhen(data.trainingDetails, (training) => [
        ["Водещ обучението: „Сириус Груп С“ ЕООД", `Водещ/описание на обучението: ${training}`]
      ])
    },
    {
      fileNameIncludes: "ПР 07 -  Процедура по закупуване.docx",
      replacements: () => [
        ["Ръководител (Продажби и магазини)", "Отговорник по доставките"],
        ["Състояние на магазините", "Състояние на доставките"]
      ]
    },
    {
      fileNameIncludes: "ПР 10 -  Процедура за управление на поддръжката.docx",
      replacements: (data) => {
        const maintenanceOwner = data.preparedBy || "Отговорник поддръжка";
        return [
          ["сервизна поддръжка", "техническа поддръжка"],
          ["Ръководител Предоставяне на услуги", maintenanceOwner],
          ["Ръководителя Предоставяне на услуги", maintenanceOwner],
          ["Ръководителят Предоставяне на услуги", maintenanceOwner]
        ];
      }
    },
    {
      fileNameIncludes: "ПР 11 - Процедура за контрол на външни процеси, продукти и услуги.docx",
      replacements: (data) => supplierProcedureReplacements(data)
    },
    {
      fileNameIncludes: "Наръчник-9001.docx",
      replacements: (data) => qualityManualReplacements(data)
    }
  ],
  wordContentRules: [
    {
      fileNameIncludes: "ПЛАН ЗА УПРАВЛЕНИЕ НА РИСКА.docx",
      rewrite: (data) => ({ mode: "body", paragraphs: iso9001RiskPlanBody(data) })
    },
    {
      fileNameIncludes: "Доклад вътрешен одит.docx",
      rewrite: (data) => ({ mode: "body", paragraphs: iso9001AuditReportBody(data) })
    },
    {
      fileNameIncludes: "Преглед от ръководството 2020.docx",
      rewrite: (data) => ({ mode: "body", paragraphs: iso9001ManagementReviewBody(data) })
    },
    {
      fileNameIncludes: "ПР 01 - Управление на документите.docx",
      rewrite: () => ({
        mode: "from-marker",
        marker: "ОД_01-03",
        occurrence: "last",
        paragraphs: [
          { text: "ОД 01-03", style: "heading1" },
          { text: "РЕГИСТЪР НА ПРИЛОЖИМИТЕ НОРМАТИВНИ И ДРУГИ ИЗИСКВАНИЯ", style: "heading1" },
          {
            text: "Организацията поддържа отделен актуален регистър само на нормативните, договорните, клиентските и техническите изисквания, приложими към нейната дейност, продукти, услуги и обхват на СУК. Регистърът се преглежда при промяна и най-малко веднъж годишно."
          },
          { text: "За всеки запис се посочват: източник, приложимо изискване, отговорно лице, начин за изпълнение, доказателство, дата на последен преглед и статус.", style: "bullet" }
        ]
      })
    },
    {
      fileNameIncludes: "Наръчник-9001.docx",
      rewrite: (data) => ({
        mode: "between-markers",
        startMarker: "РАЗДЕЛ 8.3.ПРОЕКТИРАНЕ И РАЗРАБОТВАНЕ",
        endMarker: "РАЗДЕЛ 8.4.УПРАВЛЕНИЕ НА ПРОЦЕСИ",
        occurrence: "last",
        paragraphs: iso9001DesignSection(data)
      })
    }
  ],
  replacements: (data) => {
    const result: Array<[string, string]> = [
      ["“Артпласт” ЕООД", data.companyName], ["“Артпласт“ ЕООД", data.companyName],
      ["„Артпласт” ЕООД", data.companyName], ["„Артпласт“ ЕООД", data.companyName],
      ["\"Артпласт\" ЕООД", data.companyName], ["Артпласт ЕООД", data.companyName],
      ["ДЕОН-БГ ЕООД", data.companyName],
      ["\"БАЛКАНРЕМОНТ ИНЖЕНЕРИНГ\" ООД", data.companyName],
      ["„БАЛКАНРЕМОНТ ИНЖЕНЕРИНГ“ ООД", data.companyName],
      ["БАЛКАНРЕМОНТ ИНЖЕНЕРИНГ ООД", data.companyName]
    ];
    result.push(
      ...replacementsWhen(data.manager, (manager) => [
        ["ТОДОР ТОДОРОВ", manager.toLocaleUpperCase("bg")], ["Тодор Тодоров", manager], ["Боян Янев", manager]
      ]),
      ...replacementsWhen(data.uic, (uic) => [["128575615", uic]]),
      ...replacementsWhen(data.address, (address) => [
        ["БЪЛГАРИЯ, област Ямбол, община Ямбол, гр. Ямбол, п.к. 8600 ул. Панайот Хитов № 9", address],
        ["област Ямбол, община Ямбол, гр. Ямбол, п.к. 8600 ул. Панайот Хитов № 9", address]
      ]),
      ...replacementsWhen(data.city, (city) => [["гр. Ямбол", city.toLocaleLowerCase("bg").startsWith("гр.") ? city : `гр. ${city}`]]),
      ...replacementsWhen(data.phone, (phone) => [["+359 46 663219", phone]]),
      ...replacementsWhen(data.foundedAt, (foundedAt) => [
        ["е дружество с ограничена отговорност, създадено през 1994 г.", `е ${data.legalForm || "дружество"}, създадено на ${formatDate(foundedAt)} г.`]
      ]),
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
      ]),
      ...iso9001ContextReplacements(data)
    );
    return result;
  }
};

function yearPhraseReplacements(data: NormalizedExportData): Array<[string, string]> {
  const result: Array<[string, string]> = [];
  if (data.previousYear !== undefined) {
    const year = String(data.previousYear);
    result.push(
      ["за 2019 година", `за ${year} година`],
      ["за 2019 г.", `за ${year} г.`],
      ["2019 година", `${year} година`]
    );
  }
  if (data.currentYear !== undefined) {
    const year = String(data.currentYear);
    result.push(
      ["за 2020 година", `за ${year} година`],
      ["за 2020 год.", `за ${year} год.`],
      ["за 2020 г.", `за ${year} г.`],
      ["ЗА 2020 ГОДИНА", `ЗА ${year} ГОДИНА`],
      ["ЗА 2020 ГОД.", `ЗА ${year} ГОД.`],
      ["ЗА 2020 Г.", `ЗА ${year} Г.`],
      ["ЗА 2020 г.", `ЗА ${year} г.`],
      ["2020 година", `${year} година`],
      ["2020година", `${year} година`],
      ["2020г.", `${year} г.`],
      ["актуален към 2022 г.", `актуален към ${year} г.`],
      ["актуален към 2022г.", `актуален към ${year} г.`],
      ["202 2 г.", `${year} г.`],
      ["202 2г.", `${year} г.`]
    );
  }
  return result;
}

function iso9001ContextReplacements(data: NormalizedExportData): Array<[string, string]> {
  const activity = sentenceFragment(data.activity);
  const productsServices = sentenceFragment(data.productsServices);
  return [
    ...yearPhraseReplacements(data),
    ["ИНТЕГРИРАНА СИСТЕМА ЗА УПРАВЛЕНЕНИЕ НА КАЧЕСТВОТО", "СИСТЕМА ЗА УПРАВЛЕНИЕ НА КАЧЕСТВОТО"],
    ["ИНТЕГРИРАНА СИСТЕМА ЗА УПРАВЛЕНИЕ", "СИСТЕМА ЗА УПРАВЛЕНИЕ НА КАЧЕСТВОТО"],
    ["Интегрираната система за управление на качеството", "Системата за управление на качеството"],
    ["Интегрираната система за управление", "Системата за управление на качеството"],
    ["Интегрирана система за управление на качеството", "Система за управление на качеството"],
    ["Интегрирана система за управление", "Система за управление на качеството"],
    ["Интегрирана с истема за управление на качеството", "Система за управление на качеството"],
    ["интегрираната системата за управление на качеството", "системата за управление на качеството"],
    ["интегрираната системата за управление", "системата за управление на качеството"],
    ["интегрираната система за управление на качеството", "системата за управление на качеството"],
    ["интегрираната система за управление", "системата за управление на качеството"],
    ["интегрирана система за управление на качеството", "система за управление на качеството"],
    ["интегрирана система за управление", "система за управление на качеството"],
    ["ИНТЕГРИРАНА СИСТЕМА", "СИСТЕМА"],
    ["Интегрираната система", "Системата"],
    ["Интегрирана система", "Система"],
    ["интегрираната система", "системата"],
    ["интегрирана система", "система"],
    ["Координатор по ИСУ", "Координатор СУК"],
    ["Координатор ИСУ", "Координатор СУК"],
    ["кИСУ", "Координатор СУК"],
    ["Документ ИСУ", "Документ СУК"],
    ["документ ИСУ", "документ СУК"],
    ["ИСУ", "СУК"],
    ...replacementsWhen(activity, (value) => [
      [
        "Фирмата извършва търговски услуги, които съответстват на изискванията на продукта",
        `${data.companyName} извършва ${value}, като осигурява съответствие на продуктите и услугите с договорените и приложимите изисквания`
      ]
    ]),
    ...replacementsWhen(productsServices, (value) => [
      ["доставените продукти", value],
      ["вида и характеристиките на конкретния вид стоки и услуги", `характеристиките и изискванията към ${value}`]
    ])
  ];
}

function supplierProcedureReplacements(data: NormalizedExportData): Array<[string, string]> {
  const activity = sentenceFragment(data.activity);
  const externalProcesses = `доставки на материали и продукти, транспорт, ремонт и поддръжка на техника и други външни услуги, свързани с ${activity}`;
  return [
    ["Ръководителят (Продажби & Магазини)", "Отговорникът по доставките"],
    ["Ръководителят (Продажби и магазини)", "Отговорникът по доставките"],
    ["Ръководителят (Продажба и магазини)", "Отговорникът по доставките"],
    ["Ръководител (Продажби и магазини)", "Отговорник по доставките"],
    ["Ръководител (Продажба и магазини)", "Отговорник по доставките"],
    ["Ръководил (Продажба и магазинии)", "Отговорник по доставките"],
    ["Ръководителя Дизайн и разработка", "Техническия отговорник"],
    ["Ръководителят Проектиране и разработка", "Техническият отговорник"],
    ["Ръководител Човешки ресурси", "Отговорника по персонала"],
    ["Ръководителят Човешки ресурси", "Отговорникът по персонала"],
    ["Началникът Предлагане на услуги", "Отговорникът по клиентските изисквания"],
    ["Търговски екип по развитие", "Екип по оценка на доставчиците"],
    ["Състояние на магазините", "Състояние на доставките"],
    ["след сервизна поддръжка", "дейности след доставка"],
    ["следпродажбена поддръжка", "дейности след доставка"],
    ["монтаж", "външен транспорт"],
    ["инсталация", "ремонт и поддръжка на техника"],
    ["дейности след доставка", "доставки на материали и продукти"],
    [
      "Нашата организация разбира необходимостта от контролиране на външните процеси от доставчици като \"монтаж\", \"инсталация\", \"след сервизна поддръжка\", „ремонт” и т.н. Поради тази прична нашата организация контролира външните процеси като подписва правно обвързващи договори с доставчиците, което позволява по-голяма сигурност за клиентите.",
      `${data.companyName} определя и прилага контрол за външно предоставяните процеси, включително ${externalProcesses}. Видът и степента на контрол зависят от влиянието върху способността за постоянно предоставяне на съответстващи продукти и услуги. Изискванията, критериите за приемане, наблюдението и записите се определят предварително.`
    ],
    [
      "Нашата организация разбира необходимостта от контролиране на външните процеси от доставчици като „монтаж“, „инсталация“, „следпродажбена поддръжка“, „ремонт“ и т.н. Поради тази причина нашата организация контролира външните процеси като подписва правно обвързващи договори с доставчиците, което позволява по-голяма сигурност за клиентите.",
      `${data.companyName} определя и прилага контрол за външно предоставяните процеси, включително ${externalProcesses}. Видът и степента на контрол зависят от влиянието върху способността за постоянно предоставяне на съответстващи продукти и услуги. Изискванията, критериите за приемане, наблюдението и записите се определят предварително.`
    ]
  ];
}

function qualityManualReplacements(data: NormalizedExportData): Array<[string, string]> {
  const activity = sentenceFragment(data.activity);
  const productsServices = sentenceFragment(data.productsServices);
  const result: Array<[string, string]> = [
    [
      "лидер на регионалния пазар, предлага печат и обработващи операции върху текстил, производство и търговия на текстил и текстилни изделия, щампиране, обагряне, избелване, боядисване и конфекциониране на текстилни изделия и продукти. Изкуствените кожи са в актуални цветове и с високо качество.",
      `извършва ${activity}. Организацията предоставя ${productsServices} при контролирани условия и в съответствие с договорените и приложимите изисквания.`
    ],
    ["осигурен качествен и надежден сервиз.", "осигурена надеждна техническа поддръжка за закупеното оборудване и инфраструктура;"],
    ["чертежи, схеми, планове, условия за приемане;", "спецификации, технически изисквания и условия за приемане;"]
  ];
  if (data.designDevelopment === "not_applicable") {
    result.push([
      "ОРГАНИЗАЦИЯТА НЕ ПРАВИ ИЗКЛЮЧЕНИЯ ПО СТАНДАРТА.",
      `Клауза 8.3 „Проектиране и разработване“ не е приложима, тъй като ${data.companyName} предоставя ${productsServices} по утвърдени клиентски, нормативни и технологични изисквания и не извършва собствено проектиране на нови продукти или услуги. Всички останали изисквания на ISO 9001:2015 са приложими.`
    ]);
  }
  return result;
}

function iso9001DesignSection(data: NormalizedExportData): WordBodyParagraph[] {
  const productsServices = sentenceFragment(data.productsServices);
  if (data.designDevelopment === "not_applicable") {
    return [
      { text: "РАЗДЕЛ 8.3. ПРОЕКТИРАНЕ И РАЗРАБОТВАНЕ", style: "heading1" },
      {
        text: `Клаузата не е приложима. ${data.companyName} предоставя ${productsServices} по утвърдени клиентски, нормативни и технологични изисквания и не извършва собствено проектиране и разработване на нови продукти или услуги.`
      },
      {
        text: "Промените в изискванията, процесите, технологиите и документацията се идентифицират, преглеждат, одобряват и проследяват по контролиран ред."
      }
    ];
  }
  return [
    { text: "РАЗДЕЛ 8.3. ПРОЕКТИРАНЕ И РАЗРАБОТВАНЕ", style: "heading1" },
    { text: `Проектирането и разработването е приложимо за ${productsServices}.` },
    { text: "Организацията определя входните изисквания, етапите, отговорностите, ресурсите, критериите за приемане и необходимите прегледи, проверки и валидиране.", style: "bullet" },
    { text: "Изходните резултати трябва да изпълняват входните изисквания, да са подходящи за последващите процеси и да съдържат необходимите характеристики за безопасно и правилно предоставяне.", style: "bullet" },
    { text: "Промените се идентифицират, преглеждат и одобряват, а резултатите и предприетите действия се съхраняват като документирана информация.", style: "bullet" }
  ];
}

function iso9001RiskPlanBody(data: NormalizedExportData): WordBodyParagraph[] {
  const activity = sentenceFragment(data.activity);
  const processes = sentenceFragment(data.processesDescription);
  const productsServices = sentenceFragment(data.productsServices);
  const context = data.organizationContext;
  return [
    { text: "ПЛАН ЗА УПРАВЛЕНИЕ НА РИСКОВЕТЕ И ВЪЗМОЖНОСТИТЕ", style: "title" },
    { text: `${data.companyName} | ISO 9001:2015 | Версия ${data.version} | В сила от ${formatDate(data.effectiveDate)} г.` },
    { text: "1. Цел и обхват", style: "heading1" },
    { text: `Планът определя реда за идентифициране, оценяване, третиране, наблюдение и преглед на рисковете и възможностите, свързани с ${activity} и обхвата на системата за управление на качеството.` },
    { text: "2. Контекст", style: "heading1" },
    { text: context },
    { text: `Основни продукти и услуги: ${productsServices}.` },
    { text: `Основни процеси: ${processes}.` },
    { text: "3. Метод за оценяване", style: "heading1" },
    { text: "Всеки риск се оценява по вероятност и въздействие. Определят се съществуващите контроли, необходимите действия, отговорник, срок, ресурс и остатъчен риск. Възможностите се оценяват според очакваната полза и необходимите ресурси." },
    { text: "4. Основни групи рискове и контроли", style: "heading1" },
    { text: `Несъответствие на ${productsServices} с клиентски или нормативни изисквания. Контрол: преглед на изискванията, критерии за приемане, проверки, записи и управление на промените.`, style: "bullet" },
    { text: `Отклонения в процесите: ${processes}. Контрол: инструкции, компетентен персонал, наблюдение на показатели, проверки и коригиращи действия.`, style: "bullet" },
    { text: "Рискове от външни доставчици. Контрол: предварителен избор, определени изисквания, входящ контрол, оценка на изпълнението и периодична преоценка.", style: "bullet" },
    { text: "Недостатъчна компетентност или осъзнаване. Контрол: определяне на компетентности, обучение, оценка на ефективността и поддържане на записи.", style: "bullet" },
    { text: "Повреда на оборудване, инфраструктура или средства за наблюдение и измерване. Контрол: поддръжка, проверки, калибриране, резервни решения и проследяване на състоянието.", style: "bullet" },
    { text: "Загуба, неоторизирана промяна или използване на неактуална документирана информация. Контрол: версии, права за достъп, архивиране, резервни копия и контролирано разпространение.", style: "bullet" },
    { text: "Промени в законови, пазарни, технологични и клиентски изисквания. Контрол: периодичен преглед на контекста, заинтересованите страни и приложимите изисквания.", style: "bullet" },
    { text: "Прекъсване на критични процеси. Контрол: планове за реакция, отговорности, комуникация, резервни ресурси и периодични проверки на готовността.", style: "bullet" },
    { text: "5. Отговорности", style: "heading1" },
    { text: `Управителят ${data.manager} одобрява критериите и ресурсите. Собствениците на процеси идентифицират и наблюдават рисковете. Представителят на ръководството координира регистъра, сроковете и докладването.` },
    { text: "6. Наблюдение и преглед", style: "heading1" },
    { text: "Рисковете и възможностите се преглеждат при промени, несъответствия, рекламации, инциденти, резултати от одити и най-малко веднъж годишно при прегледа от ръководството. Предприетите действия се оценяват за ефективност." },
    { text: `Одобрил: ${data.manager} ____________________    Дата: ${formatDate(data.effectiveDate)} г.` }
  ];
}

function iso9001AuditReportBody(data: NormalizedExportData): WordBodyParagraph[] {
  const designStatement = data.designDevelopment === "not_applicable"
    ? "Клауза 8.3 е определена като неприложима и обосновката е проверена спрямо реалните продукти, услуги и процеси."
    : "Клауза 8.3 е приложима и се проверяват планирането, входовете, контролите, изходите и промените при проектиране и разработване.";
  return [
    { text: "ДОКЛАД ОТ ВЪТРЕШЕН ОДИТ", style: "title" },
    { text: `${data.companyName} | ISO 9001:2015 | Дата на одита: ${formatDate(data.internalAuditDate)} г.` },
    { text: "1. Цел, обхват и критерии", style: "heading1" },
    { text: `Целта е да се оцени съответствието и резултатността на СУК за ${sentenceFragment(data.activity)}. Обхват: ${sentenceFragment(data.scope)}. Критерии: ISO 9001:2015, вътрешната документация и приложимите договорни и нормативни изисквания.` },
    { text: "2. Одитирани процеси", style: "heading1" },
    { text: sentenceFragment(data.processesDescription) },
    { text: "3. Проверени области", style: "heading1" },
    { text: "Контекст, заинтересовани страни, обхват и процеси на СУК.", style: "bullet" },
    { text: "Лидерство, политика, цели, роли и отговорности.", style: "bullet" },
    { text: "Рискове и възможности, ресурси, компетентност, комуникация и документирана информация.", style: "bullet" },
    { text: "Оперативно планиране, изисквания към продуктите и услугите, доставки, изпълнение, освобождаване и несъответстващи изходи.", style: "bullet" },
    { text: designStatement, style: "bullet" },
    { text: "Наблюдение, измерване, удовлетвореност на клиента, вътрешни одити, преглед от ръководството и подобрение.", style: "bullet" },
    { text: "4. Констатации", style: "heading1" },
    { text: "Съответствия и добри практики: ____________________________________________________________________" },
    { text: "Несъответствия: _________________________________________________________________________________" },
    { text: "Наблюдения и възможности за подобрение: __________________________________________________________" },
    { text: "5. Заключение", style: "heading1" },
    { text: "Заключението за съответствие и резултатност се попълва от одиторския екип въз основа на събраните обективни доказателства. За всяко несъответствие се определят причина, корекция, коригиращо действие, отговорник и срок." },
    { text: "Водещ одитор: ____________________    Представител на одитираното звено: ____________________" }
  ];
}

function iso9001ManagementReviewBody(data: NormalizedExportData): WordBodyParagraph[] {
  const period = `${data.previousYear}–${data.currentYear}`;
  return [
    { text: "ПРЕГЛЕД ОТ РЪКОВОДСТВОТО", style: "title" },
    { text: `${data.companyName} | ISO 9001:2015 | Дата: ${formatDate(data.managementReviewDate)} г. | Отчетен период: ${period}` },
    { text: "1. Цел", style: "heading1" },
    { text: "Да се оцени продължаващата пригодност, адекватност, резултатност и съответствие на системата за управление на качеството със стратегическата посока на организацията." },
    { text: "2. Входни данни за прегледа", style: "heading1" },
    { text: `Промени в контекста и заинтересованите страни: ${data.organizationContext}`, style: "bullet" },
    { text: `Резултати от вътрешния одит от ${formatDate(data.internalAuditDate)} г. и статус на предходните действия.`, style: "bullet" },
    { text: "Удовлетвореност на клиентите, обратна връзка, рекламации и изпълнение на договорените изисквания.", style: "bullet" },
    { text: `Резултатност на процесите: ${sentenceFragment(data.processesDescription)}.`, style: "bullet" },
    { text: "Съответствие на продуктите и услугите, несъответствия, корекции и коригиращи действия.", style: "bullet" },
    { text: "Резултати от наблюдение и измерване, изпълнение на целите по качеството и показатели за процесите.", style: "bullet" },
    { text: "Резултатност на външните доставчици и адекватност на ресурсите.", style: "bullet" },
    { text: "Ефективност на действията за рискове и възможности и възможности за подобрение.", style: "bullet" },
    { text: `Компетентност и обучения: ${data.trainingDetails}.`, style: "bullet" },
    { text: "3. Решения и изходи", style: "heading1" },
    { text: "Решения за подобряване на СУК, процесите, продуктите и услугите: __________________________________________" },
    { text: "Необходими промени в СУК и документираната информация: _________________________________________________" },
    { text: "Необходими ресурси, отговорници и срокове: ______________________________________________________________" },
    { text: "Актуализирани цели и показатели за следващия период: ____________________________________________________" },
    { text: "4. Проследяване", style: "heading1" },
    { text: "Представителят на ръководството поддържа план на действията и докладва изпълнението. Ефективността се проверява при договорените срокове и при следващия преглед." },
    { text: `Председател/Управител: ${data.manager} ____________________` }
  ];
}

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

function integratedSystemContentReplacements(data: NormalizedExportData): Array<[string, string]> {
  if (!data.activity) return [
    ["“ДП БИЛД ИНВЕСТМЪНТ” ЕООД", data.companyName],
    ["„ДП БИЛД ИНВЕСТМЪНТ“ ЕООД", data.companyName],
    ["ДП БИЛД ИНВЕСТМЪНТ ЕООД", data.companyName]
  ];

  const isWoodProcessing = /дърводобив|дървопреработ|дървен материал|дървесин/i.test(data.activity);
  const activity = sentenceFragment(data.activity);
  const productsServices = sentenceFragment(data.productsServices || activity);
  const physicalScope = sentenceFragment(data.physicalScope || data.address || "работните площадки и обектите на организацията");
  const context = data.organizationContext || `Организацията извършва ${activity} при спазване на приложимите изисквания за качество, околна среда и здраве и безопасност при работа.`;
  const processes = sentenceFragment(data.processesDescription || (isWoodProcessing
    ? "планиране и управление, дърводобив, транспорт, разтоварване, първична и вторична обработка на дървесина, сушене и складиране, пакетиране, експедиция, контрол на качеството и поддръжка"
    : `планиране, изпълнение и контрол на дейностите по ${activity}, доставки, складиране, обслужване на клиенти, мониторинг, одити и подобрение`));
  const policyFocus = isWoodProcessing
    ? "Ориентиране към клиенти и други заинтересовани страни – постоянно подобряваме дърводобива и дървопреработването, контрола на фасонирания дървен материал и производствените процеси. Управляваме дървесния прах, шума, отпадъчната дървесина и рисковете при работа с машини, транспорт и товаро-разтоварни дейности, като спазваме приложимите законови и други изисквания."
    : `Ориентиране към клиенти и други заинтересовани страни – постоянно наблюдаваме и подобряваме процесите, свързани с ${activity}. Управляваме качеството, въздействията върху околната среда и рисковете за здравето и безопасността при работа, като спазваме приложимите законови и други изисквания.`;
  const environmentalAspects = sentenceFragment(data.environmentalAspects || (isWoodProcessing
    ? "Дървесни остатъци, стърготини, кори и дървесен прах; шум от дърводобивна и дървообработваща техника; разход на горива и смазочни материали; отработени масла, филтри, гуми и опаковки; емисии от транспорт и риск от разливи."
    : `Отпадъци, емисии, шум, потребление на ресурси и други въздействия, възникващи при ${activity}.`));
  const occupationalRisks = sentenceFragment(data.occupationalRisks || (isWoodProcessing
    ? "работа с дърводобивна и дървообработваща техника, режещи инструменти, движещи се части, дървесен прах, шум, пожар, транспорт и товаро-разтоварни дейности"
    : `оборудването, работната среда, транспорта, доставките и изпълнението на ${activity}`));
  const externalParties = sentenceFragment(data.externalParties || "клиенти, доставчици, контролни органи и външни изпълнители");
  const operationalControls = sentenceFragment(data.wasteManagement || (isWoodProcessing
    ? "Дървесните остатъци, стърготините, корите и прахът се събират разделно и се оползотворяват или предават по приложимия ред. Отработените масла, филтрите, гумите и опаковките се съхраняват обозначено и се предават на правоспособни лица. Контролират се прахът, шумът, техническата изправност на машините, транспортът и товаро-разтоварните дейности."
    : `Отпадъците и емисиите от ${activity} се идентифицират, събират, съхраняват и предават по приложимия ред. Контролират се ресурсите, техническата изправност, работната среда и рисковете при изпълнение на процесите.`));
  const postDeliveryActivities = sentenceFragment(data.postDeliveryActivities || "експедиция и доставка, проследяване на удовлетвореността, разглеждане на рекламации и предприемане на коригиращи действия");
  const designDescription = data.designDevelopment === "not_applicable"
    ? `Проектирането и разработването по смисъла на ISO 9001 не е приложимо. ${data.companyName} изпълнява утвърдени процеси за ${activity} и управлява промените в изискванията, технологиите и документацията по контролиран ред.`
    : `Проектирането и разработването е приложимо за ${productsServices}. Входните изисквания се преглеждат, планират се етапи, отговорности, ресурси, проверки и валидиране, а всички промени се идентифицират, одобряват и проследяват.`;
  const mission = `${data.companyName} развива ${activity}. Организацията изгражда дългосрочни отношения с клиентите и заинтересованите страни чрез постоянно качество, опазване на околната среда, безопасни условия на труд и непрекъснато подобрение.`;
  const siteDescription = `${data.companyName} изпълнява дейността си в рамките на следния физически обхват: ${physicalScope}. Прилагат се контролирани условия за инфраструктурата, машините, складовете, транспорта, работната среда и управлението на отпадъците.`;
  const companyPresentation = `Специализация – ${data.companyName} извършва ${activity}. ${context}`;
  const processDescription = `${data.companyName} прилага следните основни процеси: ${processes}. Процесите се планират, изпълняват, наблюдават и подобряват съгласно интегрираната система за управление.`;

  return [
    ["“ДП БИЛД ИНВЕСТМЪНТ” ЕООД", data.companyName],
    ["„ДП БИЛД ИНВЕСТМЪНТ“ ЕООД", data.companyName],
    ["ДП БИЛД ИНВЕСТМЪНТ ЕООД", data.companyName],
    [
      "Ориентиране към клиенти и други заинтересовани страни – постоянно изучаваме и се информираме за развитието на технологиите свързани с праховото и течно боядисване, емайлирането, обезпрашаването в производствените помещения и обезмасляването на метали, като  се стремим да задоволяваме в максимална степен настоящите и бъдещи потребности на всички свои клиенти, спазвайки действащите законови и нормативни изисквания;",
      policyFocus
    ],
    [
      "Специализация – „ЕКОБУЛ ПАРТНЕР“ ООД“ извършва дейности по третиране на отпадъци на площадка с местоположение гр. Пазарджик, област Пазарджик, община Пазарджик, УПИ ХV – 537, кв. 520 с обща площ 1651 кв. м. разположена в поземлен имот.",
      companyPresentation
    ],
    [
      "„ЕКОБУЛ ПАРТНЕР“ ООД в гр. Пазарджик използва следните методи и технологии за третиране на отпадъците:",
      processDescription
    ],
    [
      "Предварително третиране /разглобяване, шредиране и сепариране на получените метални и неметални отпадъци/ на опасни и неопасни отпадъци от ИУЕЕО и компоненти от ИУЕЕО в автоматизирана инсталация.",
      `Основните оперативни дейности включват: ${processes}.`
    ],
    [
      "Тонер касетите се разделят на съставни части – метали, ценни метали, органични материали и тонер чрез механични и физични методи.",
      `Основни екологични аспекти: ${environmentalAspects}`
    ],
    [
      "Площадката на  „ЕКОБУЛ ПАРТНЕР“ ООД за третиране на отпадъци отговарят на изискванията за това тя да е закрита с непропускливо покритие и е оборудвана със съоръжение за събиране на разливи, утаители и съоръжения за обезмасляване. Има навес за опасните вещества за предварително третиране в затворени контейнери. Има везни за измерване на теглото на приеманото и предаваното ИУЕЕО, както и веществата от предварителното третиране, със затворени съдове за съхранение на батерии и акумулатори, кондензатори.",
      siteDescription
    ],
    [
      "Мисия: Фирма ЕКОБУЛ ПАРТНЕР ООД е основана на 15 Февруари 2021 година с правна форма \"Дружество с ограничена отговорност\" или на кратко \"ООД\". Седалището на компанията се намира в гр. Пазарджик. Нашата бизнес философия е да установим дългосрочни партньорства и да удовлетворим по най-добрия възможен начин нуждите и желанията на нашите клиенти съобразно управлението на отпадъците.",
      `Мисия: ${mission}`
    ],
    [
      "Складиране и съхранение на компоненти от излязло от употреба електрическо и електронно оборудване. Обработка, разглобяване, сортиране и разкомплектоване на отпадъчни тонер касети, електрическо и електронно оборудване.",
      `Обхват на дейностите: ${activity}. Основни процеси: ${processes}.`
    ],
    [
      "Физическите граници на приложимост на ИС (интегрираната система за управление) – база на  „ЕКОБУЛ ПАРТНЕР“ ООД, в гр. Пазарджик.",
      `Физическите граници на приложимост на ИС (интегрираната система за управление) обхващат ${physicalScope}.`
    ],
    [
      "3.Регулярни обучения на персонала по теми свързани с: финансова теория и практика, управление на риска, нормативната база, имаща отношение към дейността на инвестиционните посредници, информационни технологии и сигурност, други;",
      `3. Регулярни обучения на персонала по теми, свързани с интегрираната система, приложимите изисквания, управление на риска, безопасна работа и опазване на околната среда при ${activity};`
    ],
    ["1.Действия в нарушение на определената инвестиционна стратегия;", "1. Действия в отклонение от утвърдените процеси, цели, правила и оперативни критерии;"],
    [
      "2.Неправилна преценка за рисковия профил на клиента и избор на неподходяща и  неуместна за клиента търговска стратегия;",
      "2. Неправилно определяне или преглед на изискванията на клиента и избор на неподходящ метод за изпълнение;"
    ],
    [
      "3.Виновно причинени вреди, които са в пряка причинна връзка с предоставяне на неверни, неточни или непълни анализи и прогнози в конкретна турговска консултация;",
      "3. Предоставяне на неверни, неточни или непълни данни, спецификации, анализи или указания при изпълнение на дейността;"
    ],
    ["4.Извършване на транзакции, с които Клиента е ощетен;", "4. Грешки при изпълнение, контрол, доставка или отчитане, които могат да причинят вреда на клиента;"],
    ["8.Грешки при събиране, въвеждане и осчетоводяване на данни;", "8. Грешки при събиране, въвеждане, обработване и отчитане на данни;"],
    [
      "9.Действие в нарушение на политиката за най-добро изпълнение и дължима грижа към клиента;",
      "9. Действия в нарушение на договорените изисквания, оперативните критерии и дължимата грижа към клиента;"
    ],
    ["11.Грешки при преоценка на клиентски активи;", "11. Грешки при проверка и оценяване на продукти, услуги, материали или резултати от процесите;"],
    ["12.Неправилна отчетност и съхранение на клиентски активи;", "12. Неправилна отчетност, идентификация, защита или съхранение на материали, продукти и собственост на клиента;"],
    [
      "1.Изчерпателно и максимално точно уговаряне в договорните отношения с клиента обхватът на управлението и конкретните сделки и действия, които „ЕКОБУЛ ПАРТНЕР“ ООД  извършва;",
      `1. Изчерпателно и точно определяне в договорните отношения с клиента на обхвата, изискванията, сроковете, критериите за приемане и дейностите, които ${data.companyName} извършва;`
    ],
    [
      "2.С цел коректната оценка рисковия профил на клиента „ЕКОБУЛ ПАРТНЕР“ ООД  класифицира клиентите си съгласно Критерии за определяне на клиентите като професионални, непрофесионални или приемлива насрещна страна.",
      `2. ${data.companyName} оценява рисковете за процесите, клиентите, доставчиците, работещите и околната среда според тяхната вероятност, последици и приложими мерки за контрол.`
    ],
    [
      "3.„ЕКОБУЛ ПАРТНЕР“ ООД  изисква от клиентите информация за установяване на съществени факти относно финансовите им възможности, цели, знания. При промяна на горепосочените факти Клиента се задължава своевременно да уведоми „ЕКОБУЛ ПАРТНЕР“ ООД .",
      `3. ${data.companyName} изисква от клиентите достатъчна информация за техните изисквания, предназначението, сроковете, техническите условия и приложимите критерии. При промяна клиентът уведомява своевременно организацията.`
    ],
    [
      "4.„ЕКОБУЛ ПАРТНЕР“ ООД поддържа системи и процедури, които осигуряват трайното и конфиденциално съхранение на получената от клиентите информация, както и за дадените им съвети и препоръки, заедно с мотивите за тези препоръки.",
      `4. ${data.companyName} поддържа правила за идентификация, защита, конфиденциалност, съхранение и проследимост на изискванията, документите и комуникацията с клиентите.`
    ],
    [
      "3.Организация и управление на достъпа на потребителите до информационната система, която да не позволява неволни или умишлени нарушения в интегритета на системите, ползвани от посредника.",
      "3. Организация и управление на достъпа до информационните системи, така че да се предотвратяват неволни или умишлени нарушения на целостта, наличността и поверителността на информацията."
    ],
    [
      "6.„ЕКОБУЛ ПАРТНЕР“ ООД разработва и разполага с план за действие в кризисни ситуации, който осигурява продължаването и поддържането за достатъчно дълъг период нормалната работа на посредника при спазване на законоустановените норми за дейността.",
      `6. ${data.companyName} поддържа план за действие при кризисни и извънредни ситуации, който осигурява продължаване или своевременно възстановяване на критичните процеси при спазване на приложимите изисквания.`
    ],
    ["2.Риск, свързан с финансови средства с незаконен произход.", `2. Рискове, свързани с ${occupationalRisks}.`],
    [
      "5.да се ангажират отделните отдели в процеса по установяване и оценка на риска, като по този начин се постига по-голяма отговорност на служителите на посредника за управлението на рисковете.",
      `5. Да се ангажират всички звена в процеса по установяване и оценка на риска, като се повишава отговорността на служителите на ${data.companyName} за управлението на рисковете.`
    ],
    [
      "Изходни елементи от проектирането – Изходните елементи от проектирането могат да бъдат чертежи, техническа документация, изготвен прототип, извършени измервания с оглед доказване съответствие с входните данни. След достигане на крайният резултат, съгласно заданието /входните данни/, екипа определен за извършване на проектирането следва да извърши проверка на резултата спрямо входните данни. Проектирането като процес се счита за приключен тогава, когато резултата от проектирането удовлетвори напълно изискванията поставени като входни данни. В зависимост от ситуацията, резултата от проектирането може да се валидира или от клиента или от Управителя, възложил проектирането. С процеса на валидация се поставя край на проектирането и екипа се разпуска.",
      `Планиране и управление на дейностите – входните изисквания за ${activity} се преглеждат преди изпълнение. Определят се необходимите ресурси, критерии за приемане, отговорности и контролни точки. Резултатите се проверяват спрямо изискванията на клиента, нормативните изисквания и правилата на интегрираната система.`
    ],
    [
      "Дейностите след доставка включват сервизно – гаранционно и извън гаранционно обслужване на доставените продукти. Организирането на тези дейности включва:",
      "Дейностите след доставка включват проследяване на удовлетвореността на клиента, разглеждане на рекламации и предприемане на необходимите корекции. Организирането им включва:"
    ],
    [
      "Определяне и разпределяне на квалифициран персонал за всеки един клиент, отговорен за извършване гаранционен и извънгаранционен сервиз и обслужване.",
      "Определяне на квалифициран персонал, отговорен за подготовката, проверката, доставката и комуникацията с клиента."
    ],
    [
      "Изготвяне на план за посещенията при всеки един клиент в зависимост от срока на гаранционния сервиз и доставеното оборудване.",
      "Проследяване на поръчките, доставките, обратната връзка, рекламациите и предприетите действия."
    ],
    [
      "„ЕКОБУЛ ПАРТНЕР“ ООД предоставя при поискване от заинтересованите страни информация, касаеща значимите аспекти на управление на качеството, околната среда и ЗБУТ. При  наличие на желание от заинтересованите страни, Управителят преценява и разпорежда на Отговорника по УК, УОС и ЗБУТ да предоставят необходимите документи и информация. На строителните обекти на Организацията Техническият ръководител предоставя при поискване, в рамките на своята компетентност, такава информация.",
      `${data.companyName} предоставя при поискване от заинтересованите страни информация за значимите аспекти по качество, околна среда и ЗБУТ. Управителят определя отговорно лице, което предоставя необходимите документи и информация в рамките на своята компетентност за производствените площадки, цеховете, складовете, транспорта и останалите дейности на организацията.`
    ],
    [
      "Редът за обмен на информация с подизпълнителите, работещи на строителни площадки на Организацията е същия като реда за вътрешен обмен на информация.",
      "Редът за обмен на информация с външните изпълнители, работещи на площадки и обекти на Организацията, е същият като реда за вътрешен обмен на информация."
    ],
    [
      "Депониране на отпадъци -  метод, при който не се предвижда последващо третиране на отпадъците и представлява складиране на отпадъци за срок, по-дълъг от три години - за отпадъци, предназначени за оползотворяване, и една година - за отпадъци, предназначени за обезвреждане, по начин, който не представлява опасност за човешкото здраве и околната среда.",
      `Управление на отпадъците – ${operationalControls}`
    ],
    ["7.3Депониране  и преработка", "7.3 Управление на отпадъците и оперативен контрол"],
    [
      "Изискванията за депониране на отпадъци и към площадките за разполагане на депа за отпадъци са регламентирани в съответните Наредби.",
      "Изискванията за разделно събиране, временно съхраняване, оползотворяване и предаване на отпадъците са регламентирани в приложимите нормативни актове и вътрешни правила."
    ],
    [
      "Управлението на доставките се извършва, като преди доставка са изясняват всички възможни рискове, които могат да възникнат от доставката – изменение на факторите на работната среда като шум, прах, осветление и т.н. При доставката се извършва проверка за съответствие със нормативни или стандартизационни документи, удостоверяващо че предмета на доставка отговаря на тези изисквания. По отношение на оперативния контрол на подизпълнителите, работещи на територията на фирмата или на обекти на фирмата, отговорника по монтажа извършва преглед относно спазването на изискванията по безопасност от страна на подизпълнителя. Това се отразява с подпис в ежедневния инструктаж.",
      `Преди доставка се оценяват рисковете за качеството, околната среда и работната среда, включително шум, прах, осветление, транспорт и товаро-разтоварни дейности. Доставките се проверяват за съответствие с договорните, нормативните и техническите изисквания. Определено отговорно лице контролира безопасната работа на доставчици и външни изпълнители на територията и обектите на ${data.companyName}; проведените инструктажи и проверки се документират.`
    ],
    [
      "Всички изисквания и отговорности към персонала са определени от документацията на системата и длъжностните характеристики се познават от заетите лица. Водят се досиета на сътрудниците. Квалификацията и опита на сътрудниците отговарят на изискванията. Подборът на кадри, въвеждането в работа, поддържането и повишаването на квалификацията се планират и се проследяват. Проведени и документирани са обучения за повишаване компетенциите на персонала. Развитието на персонала се планира в качествен и количествен аспект. В процеса на работа много ефективно е организиран подбора, въвеждането в работа, обучението и повишаването на квалификацията на персонала. Контролът и оценката на тази дейност е ежедневен и се проследява по записи, с които са запознати и самите сътрудници. Провеждат се встъпителни и периодични инструктажи по здравословни и безопасни условия на труд, съгласно Закона за ЗБУТ и наредбите към него. Има извършена оценка на риска от служба по трудова медицина. В хода на одита бе проверено досието на заварчика на дружеството.",
      "Изискванията и отговорностите към персонала са определени в документацията на системата и длъжностните характеристики. Водят се досиета на служителите и се проследяват тяхната квалификация, опит, въвеждане в работа, обучения и оценка на компетентността. Провеждат се и се документират встъпителни и периодични инструктажи по здравословни и безопасни условия на труд. Налична е актуална оценка на риска от служба по трудова медицина. В хода на одита бяха проверени представителни досиета и записи за компетентност и инструктаж."
    ],
    ["3.Генериране на опасни отпадъци от батерии и акумулатори", `3. ${environmentalAspects}`],
    [
      "4.7.5.Генерирани отпадъци от всички дейности извършвани от Дружеството, тяхното събиране, транспорт и депониране.",
      `4.7.5. ${operationalControls}`
    ],
    [
      "Площадката на  „ЕКОБУЛ ПАРТНЕР“ ООД за съхраняване на отпадъците отговаря на изискванията за това тя да бъде оградена, охраняема, с осигурени комуникации и изградена инфраструктура. Приетите отпадъци се съхраняват в обособени зони обозначени и маркирани със стикер  със съответния код на отпадъка.",
      `Генерираните отпадъци от дейността на ${data.companyName} се управляват по следния ред: ${operationalControls}`
    ],
    [
      "Определени като външни обстоятелства са: Съществуващите правни норми - местно законодателство и законодателство на Европейският съюз, технологични – съществуващи технически стандарти, нормали и изисквания към продуктите  които произвежда компанията, конкурентни в областта на производството на промишлено оборудване, пазарни, социални и икономически условия. Тези обстоятелства могат да влияят както положително, така и отрицателно върху възможностите на компанията да постига своите цели и развитие. За тази цел в \"ЕКОБУЛ ПАРТНЕР\" ООД съществува процес за следене и анализиране на тези външни обстоятелства като Управителят разпределя отговорностите за това. Като вътрешни обстоятелства са идентифицирани и отчетени натрупаните знания и опит, вътрешно-фирмени ценности, култура, наличието на квалифициран персонал, технологичното оборудване, финансовата стабилност на фирмата. Вътрешните обстоятелства се управляват и наблюдават със дефинирани процеси по управление на персонала, поддръжка на оборудване, архивиране на знанията под формата на технологии, чертежи, създадените процеси за вътрешна комуникация.",
      `${context} Външните обстоятелства включват приложимото законодателство, техническите и стандартните изисквания, пазара и конкуренцията при ${productsServices}, икономическите и социалните условия и очакванията на ${externalParties}. Вътрешните обстоятелства включват знанията и опита, персонала, инфраструктурата, технологиите, ресурсите, организационната култура и финансовата устойчивост. Управителят определя отговорности за периодично наблюдение и преглед на тези фактори.`
    ],
    [
      "Фирмата е създала организация, така че когато се изменят изискванията от страна на клиент или други изисквания, съответната документирана информация /чертежи, договори и др./ е изменена, съответният персонал е информиран за изменените изисквания /посредством изменената документация/, когато са променени изискванията за продуктите и услугите.",
      `При промяна на клиентски, нормативни или други изисквания към ${productsServices}, приложимите заявки, договори, спецификации, технологични инструкции и други документи се актуализират, а засегнатият персонал се информира своевременно.`
    ],
    [
      "Проектиране и разработване на нови продукти се налага в случаите, когато изискването на клиента не може да бъде изпълнено със съществуващите готови, разработени и утвърдени във фирмата модули и готови решения. В този случай процеса на проектиране преминава през следните етапи:",
      designDescription
    ],
    [
      "Планиране на проектирането и разработването – Това е началният етап на проектирането, в който управителя взема решение за стартиране на проектиране на нов модул. Това решение се оформя в заповед, в която се посочва:",
      data.designDevelopment === "not_applicable"
        ? "Промените в процесите, технологиите, ресурсите и изискванията се планират и одобряват от Управителя, като се определят отговорности, срокове, проверки и необходимите записи."
        : `Планирането на проектирането и разработването за ${productsServices} определя етапите, отговорностите, необходимите ресурси, входните и изходните данни, проверката, валидирането и критериите за приемане.`
    ],
    [
      "Изменение при проектирането и разработването – По време на проектирането е възможно да се получат изменения-поискани от клиента, наложени от резултатите в някой от етапите. Изменения могат да се получат и след края на процеса на проектиране – при инсталиране и внедряване на новия продукт в редовно производство. Във всички случаи на изменения, \"ЕКОБУЛ ПАРТНЕР\" ООД извършва отразяване на измененията в съответния документ по начин, по който гарантира недвусмисленост на информацията, отразява кога е извършено изменението, кой е извършил изменението. За вземането на решение за извършване на изменения в продуктите и резултатите от проектирането се създава заповед, която отразява какво следва да бъде променено и кой следва да го промени. Всички промени се документират. Измененията в техническата документация се нанасят с подпис на лицето извършило промените, а след това се отразяват в документацията съхранявана на сървъра, като съответния документ или чертеж се променя и се индексира с дата на промяната и променена версия в идентификационния номер.",
      `Промените в изискванията, процесите, технологиите и документацията се идентифицират, преглеждат и одобряват преди прилагане. ${data.companyName} документира причината, обхвата, отговорното лице, датата, версията, резултатите от проверката и необходимите действия за предотвратяване на неблагоприятни последствия.`
    ],
    [
      "Текуща оперативна координация на дейностите по монтаж на обекта при клиента се осъществява от Управителя, която включва и периодично или инцидентно посещение на обекта и разговори с представители на клиента.",
      `Текущата оперативна координация на процесите по ${activity} се осъществява от Управителя и определените отговорни лица. Тя включва наблюдение на ${processes}, комуникация с клиента и контрол на ${postDeliveryActivities}.`
    ],
    [
      "При начало на работа по нов обект се осигуряват нормите и изискванията за защита на околната среда, и работещия персонал, и населението. В тази насока се спазва проектът, утвърден от Инвеститора. Управлението на работната среда изисква от ръководния персонал, стриктно спазване на изискванията за опазване на околната среда и осигуряване на здравословни и безопасни условия на труд, и недопускане на възможности за възникване на потенциално рискови ситуации. За всички случаи на управление на здраве и безопасност при работа се прилагат изискванията на нормативната база.",
      `Преди започване на работа на нова площадка, обект или процес в рамките на ${physicalScope} се оценяват приложимите изисквания за околната среда и безопасността на работещите и засегнатите страни. Ръководният персонал осигурява контрол на рисковете, свързани с ${occupationalRisks}, и прилага нормативните, технологичните и вътрешните изисквания.`
    ],
    ["a.клиентите/инвеститорите,", `a. ${externalParties},`],
    ["a.Обмен на информация с клиентите/инвеститорите;", `a. Обмен на информация с ${externalParties};`],
    [
      "4. да организират безопасно съхраняване на отпадъците, за които няма подходящи средства за третирането им;",
      `4. Да организират разделно събиране и безопасно временно съхраняване на отпадъците до тяхното оползотворяване или предаване на правоспособни лица;`
    ],
    [
      "Транспортиране и предаване на отпадъци на изградени за целта депа, съгласно съответните нормативи и правила",
      "Транспортиране и предаване на отпадъците на правоспособни лица или оператори съгласно приложимите нормативни изисквания и вътрешни правила"
    ],
    ["Депониране на отпадъци", "Предаване и оползотворяване на отпадъци"],
    [
      "осигуряване на методи и средства за разделно временно съхранение на отпадъци, преди транспортирането им до съответните депа;",
      "осигуряване на методи и средства за разделно временно съхранение на отпадъците преди тяхното оползотворяване или предаване на правоспособни лица;"
    ],
    [
      "доставяне на отпадъци само на определени за целта депа.",
      "предаване на отпадъците само на правоспособни лица или оператори по приложимия ред."
    ]
  ];
}

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
  contentRisks: [
    { label: "чужда фирма „ДП БИЛД ИНВЕСТМЪНТ“", patterns: ["ДП БИЛД ИНВЕСТМЪНТ"] },
    { label: "дейности с ИУЕЕО и тонер касети", patterns: ["ИУЕЕО", "тонер касет"] },
    { label: "металообработка и боядисване", patterns: ["праховото и течно боядисване", "обезмасляването на метали", "емайлирането"] },
    {
      label: "финансов посредник",
      patterns: [
        "инвестиционните посредници", "инвестиционна стратегия", "търговска стратегия",
        "приемлива насрещна страна", "финансови средства с незаконен произход",
        "клиентски активи", "финансовите им възможности", "конкретните сделки",
        "ползвани от посредника", "работа на посредника", "служителите на посредника"
      ]
    },
    { label: "чужд процес по проектиране и сервиз", patterns: ["изготвен прототип", "гаранционно и извън гаранционно обслужване"] },
    { label: "строителен профил", patterns: ["строителните обекти", "строителни площадки", "Техническият ръководител"] },
    { label: "промишлено оборудване", patterns: ["производството на промишлено оборудване"] },
    { label: "чужди модули, сървър или монтаж", patterns: ["нов модул", "утвърдени във фирмата модули", "монтаж на обекта при клиента", "документацията съхранявана на сървъра"] },
    { label: "строителен инвеститор", patterns: ["утвърден от Инвеститора", "клиентите/инвеститорите"] },
    { label: "отпадъци от чужд оператор", patterns: ["Приетите отпадъци се съхраняват", "до съответните депа", "определени за целта депа"] },
    { label: "стара контролна дата", patterns: ["03.07.21"] },
    { label: "противоречива година на създаване", patterns: ["създадена през 1994", "създадено през 1994"] },
    { label: "чужда длъжност „заварчик“", patterns: ["досието на заварчика"] },
    { label: "чужда роля „отговорник по монтажа“", patterns: ["отговорника по монтажа"] }
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
        ["гр. Пазарджик", city.toLocaleLowerCase("bg").startsWith("гр.") ? city : `гр. ${city}`],
        ["община Пазарджик", `община ${cleanCityName(city)}`],
        ["Пазарджик", cleanCityName(city)]
      ]),
      ...replacementsWhen(data.address, (address) => [
        ["гр. Пазарджик, област Пазарджик, община Пазарджик ул Найчо Цанов №11", address],
        ["гр. Пазарджик, област Пазарджик, община Пазарджик, ул. Найчо Цанов №11", address],
        ["гр. Пазарджик", address]
      ]),
      ...replacementsWhen(data.foundedAt, (date) => [
        ["15.02.2021 г.", `${formatDate(date)} г.`],
        ["15.02.2021", formatDate(date)],
        ["15 Февруари 2021 година", formatLongDate(date)],
        ["25.05.2009 г.", `${formatDate(date)} г.`],
        ["25.05.2009", formatDate(date)],
        ["основана през 1994 г.", `основана на ${formatLongDate(date)}`],
        ["основана през 1994 година", `основана на ${formatLongDate(date)}`],
        ["създадена през 1994 г.", `създадена на ${formatLongDate(date)}`],
        ["създадена през 1994 година", `създадена на ${formatLongDate(date)}`],
        ["създадено през 1994 г.", `създадено на ${formatLongDate(date)}`]
      ]),
      ...replacementsWhen(data.email, (email) => [["office@ecobul.eu", email]]),
      ...replacementsWhen(data.phone, (phone) => [["0897550025", phone]]),
      ...replacementsWhen(data.activity, (activity) => [
        ["Складиране, съхранение, обработка, разглобяване, сортиране и разкомплектоване на ИУЕЕО и отпадъчни тонер касети", activity],
        ["извършва дейности по третиране на отпадъци", `извършва основна дейност: ${activity}`]
      ]),
      ...integratedSystemContentReplacements(data),
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
        ["05.01.2022 г., обучител \"Сириус Груп С\" ЕООД", training],
        ["„Сириус Груп С“ ЕООД", training],
        ["\"Сириус Груп С\" ЕООД", training]
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
          ["03.07.2021", formatted],
          ["03.07.21 г.", `${formatted} г.`],
          ["03.07.21г.", `${formatted} г.`],
          ["03.07.21", formatted]
        ];
      }),
      ...(data.currentYear === undefined ? [] : [
        ["2022 година", `${data.currentYear} година`],
        ["2022 год.", `${data.currentYear} год.`],
        ["2022 г.", `${data.currentYear} г.`],
        ["2022г.", `${data.currentYear}г.`],
        ["2022", String(data.currentYear)]
      ] as Array<[string, string]>),
      ...(data.previousYear === undefined ? [] : [
        ["2021 година", `${data.previousYear} година`],
        ["2021 год.", `${data.previousYear} год.`],
        ["2021 г.", `${data.previousYear} г.`],
        ["2021г.", `${data.previousYear}г.`],
        ["2021", String(data.previousYear)]
      ] as Array<[string, string]>),
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
  validateExportContext(data, config);
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
    const outputPath = replaceExportPath(file.relative, config, data);
    const fileSpecificReplacements = (config.fileReplacements ?? [])
      .filter((rule) => lowerName.includes(rule.fileNameIncludes.toLocaleLowerCase("bg")))
      .flatMap((rule) => rule.replacements(data));
    const wordContentRules = (config.wordContentRules ?? [])
      .filter((rule) => lowerName.includes(rule.fileNameIncludes.toLocaleLowerCase("bg")));
    let textReplacements = 0;
    let logoReplacements = 0;
    let replacedImages = 0;
    let aiTextReplacements = 0;
    let contentWarnings: string[] = [];
    if (lowerName.endsWith(".docx")) {
      const result = replaceWordTextWithStats(content, [...replacements, ...fileSpecificReplacements], logo, imageReplacements);
      content = result.buffer;
      textReplacements = result.textReplacements;
      logoReplacements = result.logoReplacements;
      replacedImages = result.imageReplacements;
      for (const rule of wordContentRules) {
        const rewriteResult = rewriteWordDocumentContentWithStats(content, rule.rewrite(data));
        content = rewriteResult.buffer;
        textReplacements += rewriteResult.textReplacements;
      }
      const aiReplacements = data.aiTextEdits
        .filter((edit) => edit.file === outputPath)
        .map((edit) => [edit.source, edit.replacement] as [string, string]);
      if (aiReplacements.length) {
        const aiResult = replaceWordTextWithStats(content, aiReplacements);
        content = aiResult.buffer;
        aiTextReplacements = aiResult.textReplacements;
        textReplacements += aiTextReplacements;
      }
      contentWarnings = scanOfficeContent(content, config.contentRisks);
    } else if (lowerName.endsWith(".xlsx")) {
      const result = replaceSpreadsheetTextWithStats(content, [...replacements, ...fileSpecificReplacements], logo, imageReplacements);
      content = result.buffer;
      textReplacements = result.textReplacements;
      logoReplacements = result.logoReplacements;
      replacedImages = result.imageReplacements;
      const aiReplacements = data.aiTextEdits
        .filter((edit) => edit.file === outputPath)
        .map((edit) => [edit.source, edit.replacement] as [string, string]);
      if (aiReplacements.length) {
        const aiResult = replaceSpreadsheetTextWithStats(content, aiReplacements);
        content = aiResult.buffer;
        aiTextReplacements = aiResult.textReplacements;
        textReplacements += aiTextReplacements;
      }
      contentWarnings = scanOfficeContent(content, config.contentRisks);
    }
    const pathRenamed = outputPath !== file.relative;
    fileResults.push({
      name: outputPath,
      format: path.extname(file.relative).slice(1).toUpperCase() || "FILE",
      changed: pathRenamed || textReplacements + logoReplacements + replacedImages > 0,
      textReplacements,
      logoReplacements,
      imageReplacements: replacedImages,
      pathRenamed,
      contentWarnings,
      aiTextReplacements
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
    ...summaryWhen(data.processesDescription, "Процеси"), ...summaryWhen(data.productsServices, "Продукти и услуги"),
    ...summaryWhen(data.environmentalAspects, "Екологични аспекти"), ...summaryWhen(data.occupationalRisks, "Рискове по ЗБУТ"),
    ...summaryWhen(data.externalParties, "Външни заинтересовани страни"), ...summaryWhen(data.wasteManagement, "Управление на отпадъците"),
    ...summaryWhen(data.designDevelopment, "Проектиране и разработване"), ...summaryWhen(data.postDeliveryActivities, "Дейности след доставка"),
    ...summaryWhen(data.trainingDetails, "Обучения"),
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
    `Одобрени AI текстови корекции: ${report.aiTextReplacements}`,
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
    "X-AI-Text-Replacements": String(report.aiTextReplacements),
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
  const riskyFiles = files.filter((file) => file.contentWarnings.length);
  if (riskyFiles.length) {
    warnings.push(`${riskyFiles.length} файла съдържат подозрителни остатъци от чужд шаблон. Прегледайте списъка преди използване.`);
  }
  if (config.code === "ISO 9001-14001-45001") {
    if (!data.activity) warnings.push("Не е попълнен обхват на дейност. Секторните текстове не могат да бъдат адаптирани.");
    if (!data.processesDescription) warnings.push("Не са попълнени процеси. Използвано е автоматично описание според дейността.");
    if (data.currentYear === undefined || data.previousYear === undefined) warnings.push("Попълнете настояща и предходна година, за да се изчистят старите години във всички записи.");
  }
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
    ["Продукти и услуги", data.productsServices], ["Екологични аспекти", data.environmentalAspects],
    ["Рискове по ЗБУТ", data.occupationalRisks], ["Външни заинтересовани страни", data.externalParties],
    ["Управление на отпадъците", data.wasteManagement], ["Проектиране и разработване", data.designDevelopment],
    ["Дейности след доставка", data.postDeliveryActivities],
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
    aiTextReplacements: files.reduce((sum, file) => sum + file.aiTextReplacements, 0),
    logoReplacements: files.reduce((sum, file) => sum + file.logoReplacements, 0),
    imageReplacements: files.reduce((sum, file) => sum + file.imageReplacements, 0),
    renamedPaths: files.filter((file) => file.pathRenamed).length,
    appliedFields,
    warnings,
    files
  };
}

function scanOfficeContent(officeFile: Buffer, risks: IsoExportConfig["contentRisks"]) {
  if (!risks?.length) return [];
  let text = "";
  try {
    for (const entry of readZip(officeFile)) {
      const isTextXml = /^(?:word|xl|docProps)\/.*\.xml$/i.test(entry.name);
      if (!isTextXml) continue;
      const xml = entry.data.toString("utf8");
      text += extractOfficeXmlText(xml);
    }
  } catch {
    return ["съдържанието не можа да бъде проверено автоматично"];
  }
  const normalized = text.toLocaleLowerCase("bg");
  return risks
    .filter((risk) => risk.patterns.some((pattern) => normalized.includes(pattern.toLocaleLowerCase("bg"))))
    .map((risk) => risk.label);
}

function extractOfficeXmlText(xml: string) {
  const values: string[] = [];
  const pattern = /<(?:(?:w:(?:t|delText|instrText)|a:t)|(?:(?:[a-z][\w.-]*):)?t)\b[^>]*>([\s\S]*?)<\/[^>]+>/gi;
  for (let match = pattern.exec(xml); match; match = pattern.exec(xml)) values.push(decodeOfficeXml(match[1]));
  return values.join("");
}

function decodeOfficeXml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

function validateExportContext(data: NormalizedExportData, config: IsoExportConfig) {
  let required: Array<[string, unknown]>;
  if (config.code === "ISO 9001") {
    required = [
      ["ЕИК", data.uic], ["Седалище/адрес", data.address], ["Град", data.city], ["Управител", data.manager],
      ["Дата на създаване", data.foundedAt], ["Дата на влизане в сила", data.effectiveDate], ["Версия", data.version],
      ["Обхват на дейност", data.activity], ["Обхват на СУК", data.scope],
      ["Продукти и услуги", data.productsServices], ["Физически обхват", data.physicalScope],
      ["Контекст на организацията", data.organizationContext], ["Процеси", data.processesDescription],
      ["Външни заинтересовани страни", data.externalParties],
      ["Проектиране и разработване", data.designDevelopment],
      ["Дейности след доставка", data.postDeliveryActivities], ["Обучения", data.trainingDetails],
      ["Вътрешен одит", data.internalAuditDate], ["Преглед от ръководството", data.managementReviewDate],
      ["Предходна година", data.previousYear], ["Настояща година", data.currentYear]
    ];
  } else if (config.code === "ISO 9001-14001-45001") {
    required = [
      ["ЕИК", data.uic], ["Седалище/адрес", data.address], ["Град", data.city], ["Управител", data.manager],
      ["Дата на създаване", data.foundedAt], ["Дата на системата/влизане в сила", data.effectiveDate],
      ["Обхват на дейност", data.activity], ["Продукти и услуги", data.productsServices],
      ["Физически обхват", data.physicalScope], ["Контекст на организацията", data.organizationContext],
      ["Процеси", data.processesDescription], ["Екологични аспекти", data.environmentalAspects],
      ["Рискове по ЗБУТ", data.occupationalRisks], ["Външни заинтересовани страни", data.externalParties],
      ["Управление на отпадъците", data.wasteManagement], ["Проектиране и разработване", data.designDevelopment],
      ["Вътрешен одит", data.internalAuditDate], ["Преглед от ръководството", data.managementReviewDate],
      ["Предходна година", data.previousYear], ["Настояща година", data.currentYear]
    ];
  } else {
    return;
  }
  const missing = required
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === "")
    .map(([label]) => label);
  if (missing.length) throw new Error(`Липсват задължителни данни за надеждна адаптация: ${missing.join(", ")}.`);
  if (config.code === "ISO 9001" && data.designDevelopment === "applicable") {
    const designContext = [
      data.activity, data.scope, data.productsServices, data.processesDescription, data.organizationContext
    ].join(" ");
    if (!/(?:проектиран|разработ|конструир|дизайн|прототип)/iu.test(designContext)) {
      throw new Error(
        "Клауза 8.3 е отбелязана като приложима, но в дейността, продуктите и процесите няма описано проектиране или разработване. " +
        "Изберете „Не е приложимо“ или опишете реалния процес по проектиране и разработване."
      );
    }
  }
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
    productsServices: optionalText(body.productsServices, 2000),
    environmentalAspects: optionalText(body.environmentalAspects, 2500),
    occupationalRisks: optionalText(body.occupationalRisks, 2500),
    externalParties: optionalText(body.externalParties, 1500),
    wasteManagement: optionalText(body.wasteManagement, 2500),
    designDevelopment: normalizeDesignDevelopment(body.designDevelopment),
    postDeliveryActivities: optionalText(body.postDeliveryActivities, 2000),
    trainingDetails: optionalText(body.trainingDetails, 1500),
    internalAuditDate: optionalText(body.internalAuditDate, 20),
    managementReviewDate: optionalText(body.managementReviewDate, 20),
    previousYear: optionalYear(body.previousYear), currentYear: optionalYear(body.currentYear),
    effectiveDate: optionalText(body.effectiveDate, 20) || systemDate, version: optionalText(body.version, 20),
    preparedBy: optionalText(body.preparedBy), teamMember1: optionalText(body.teamMember1), teamMember2: optionalText(body.teamMember2),
    logoPngDataUrl: optionalText(body.logoPngDataUrl, 5_800_000),
    aiVisuals: normalizeAiVisuals(body.aiVisuals),
    aiTextEdits: normalizeAiTextEdits(body.aiTextEdits)
  };
}

function normalizeDesignDevelopment(value: unknown): NormalizedExportData["designDevelopment"] {
  return value === "applicable" || value === "not_applicable" ? value : "";
}

function normalizeAiTextEdits(value: IsoExportRequest["aiTextEdits"]): NormalizedExportData["aiTextEdits"] {
  if (!Array.isArray(value)) return [];
  if (value.length > 300) throw new Error("AI корекциите са повече от разрешените 300.");
  return value.flatMap((item) => {
    const file = optionalText(item?.file, 500).replaceAll("\\", "/");
    const source = typeof item?.source === "string" ? item.source.slice(0, 5_000) : "";
    const replacement = typeof item?.replacement === "string" ? item.replacement.slice(0, 7_500) : "";
    const validFile = file
      && !file.startsWith("/")
      && !file.includes("../")
      && /\.(?:docx|xlsx)$/i.test(file);
    if (!validFile || source.length < 2 || !replacement.trim() || source === replacement) return [];
    return [{ file, source, replacement }];
  });
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
    ["{{PRODUCTS_SERVICES}}", data.productsServices], ["{{ENVIRONMENTAL_ASPECTS}}", data.environmentalAspects],
    ["{{OCCUPATIONAL_RISKS}}", data.occupationalRisks], ["{{EXTERNAL_PARTIES}}", data.externalParties],
    ["{{WASTE_MANAGEMENT}}", data.wasteManagement], ["{{DESIGN_DEVELOPMENT}}", data.designDevelopment],
    ["{{POST_DELIVERY_ACTIVITIES}}", data.postDeliveryActivities],
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

function cleanCityName(value: string) {
  return value.replace(/^(?:гр\.?|с\.?)\s*/iu, "").trim();
}

function sentenceFragment(value: string) {
  return value.trim().replace(/[.;,:]+\s*$/u, "");
}

function replaceExportPath(value: string, config: IsoExportConfig, data: NormalizedExportData) {
  let result = replaceCompanyInPath(value, config.pathCompanyNames, data.companyName);
  for (const [sourceYear, targetField] of config.pathYearReplacements ?? []) {
    const targetYear = data[targetField];
    if (targetYear !== undefined) result = result.replaceAll(sourceYear, String(targetYear));
  }
  if (data.currentYear !== undefined) result = result.replaceAll("2022", String(data.currentYear));
  return result;
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
