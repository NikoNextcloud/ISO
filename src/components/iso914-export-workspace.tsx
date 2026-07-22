"use client";

import { IsoExportWorkspace } from "@/components/iso-export-workspace";

export function Iso914ExportWorkspace() {
  return <IsoExportWorkspace config={{
    code: "ISO 9-14",
    edition: "ISO 9001:2015 + ISO 14001:2015",
    apiPath: "/api/iso914/export",
    templateCount: 34,
    title: "Интегрирана система ISO 9-14",
    description: "Генерирайте общ комплект за управление на качеството и околната среда за избраната фирма.",
    scopeLabel: "Обхват на интегрираната система",
    scopePlaceholder: "Например: производство и доставка на изделия в съответствие с изискванията за качество и околна среда...",
    logoAspect: 3.5,
    requiredFields: ["Име", "Адрес", "Управител", "Дата"], optionalFields: [],
    contents: [
      "Интегриран наръчник, политика и модел на управление",
      "Процедури, формуляри и работни документи",
      "ISO 9001 и ISO 14001 в един ZIP архив"
    ]
  }} />;
}
