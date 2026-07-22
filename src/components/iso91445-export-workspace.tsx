"use client";

import { IsoExportWorkspace } from "@/components/iso-export-workspace";

export function Iso91445ExportWorkspace() {
  return <IsoExportWorkspace config={{
    code: "ISO 9-14-45",
    edition: "ISO 9001:2015 + ISO 14001:2015 + ISO 45001:2018",
    apiPath: "/api/iso91445/export",
    templateCount: 54,
    title: "Интегрирана система ISO 9-14-45",
    description: "Генерирайте общ комплект за управление на качеството, околната среда и здравето и безопасността при работа за избраната фирма.",
    scopeLabel: "Обхват на интегрираната система",
    scopePlaceholder: "Например: производство, доставка и сервиз на изделия в съответствие с изискванията за качество, околна среда и безопасност...",
    logoAspect: 3.5,
    requiredFields: ["Име", "ЕИК", "Адрес", "Управител", "Дата"], optionalFields: ["Имейл", "Телефон"],
    contents: ["Интегриран наръчник и политики", "Процедури, формуляри и работни документи", "ISO 9001, ISO 14001 и ISO 45001 в един ZIP архив"]
  }} />;
}
