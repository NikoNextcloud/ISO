"use client";

import { IsoExportWorkspace } from "@/components/iso-export-workspace";

export function Iso9001ExportWorkspace() {
  return <IsoExportWorkspace config={{
    code: "ISO 9001", edition: "ISO 9001:2015", apiPath: "/api/iso9001/export", templateCount: 31,
    title: "ISO 9001 система", description: "Генерирайте комплект документация за управление на качеството и избраната фирма.",
    scopeLabel: "Обхват на СУК", scopePlaceholder: "Например: производство, търговия, услуги, проектиране и административно управление...",
    logoAspect: 3.5,
    contents: ["Наръчник по качество", "11 процедури и 8 основни формуляра", "Одитни планове, отчети, обучения и управление на риска"],
    fields: [
      { key: "companyName", required: true, hint: "заглавия, папки, колонтитули" },
      { key: "uic", required: true, hint: "ЕИК на избраната фирма" },
      { key: "legalForm", hint: "например ООД, ЕООД или АД" },
      { key: "address", required: true, hint: "пълен и актуален адрес" },
      { key: "city", required: true, hint: "населено място" },
      { key: "manager", required: true, hint: "три имена" },
      { key: "foundedAt", required: true, hint: "единна дата за всички документи" },
      { key: "effectiveDate", required: true },
      { key: "version", required: true },
      { key: "activity", required: true, hint: "реалната основна дейност на фирмата" },
      { key: "scope", required: true, hint: "точният обхват на сертификация" },
      { key: "productsServices", required: true, hint: "конкретни продукти и услуги" },
      { key: "physicalScope", required: true, hint: "площадки, цехове, складове, офиси и обекти" },
      { key: "organizationContext", required: true, hint: "вътрешни и външни фактори, пазар, нормативни изисквания" },
      { key: "processesDescription", required: true, hint: "управленски, основни и поддържащи процеси" },
      { key: "externalParties", required: true, hint: "клиенти, доставчици, органи, собственици и други" },
      { key: "designDevelopment", required: true, hint: "изберете дали клауза 8.3 е приложима" },
      { key: "postDeliveryActivities", required: true, hint: "доставка, рекламации, гаранции или други последващи дейности" },
      { key: "trainingDetails", required: true, hint: "реален обучител, тема или вътрешно обучение" },
      { key: "internalAuditDate", required: true },
      { key: "managementReviewDate", required: true },
      { key: "previousYear", required: true },
      { key: "currentYear", required: true }
    ]
  }} />;
}
