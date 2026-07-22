"use client";

import { IsoExportWorkspace } from "@/components/iso-export-workspace";

export function Iso50001ExportWorkspace() {
  return <IsoExportWorkspace config={{
    code: "ISO 50001", edition: "ISO 50001:2018", apiPath: "/api/iso50001/export", templateCount: 24,
    title: "ISO 50001 система", description: "Генерирайте комплект документация за управление на енергията и избраната фирма.",
    scopeLabel: "Обхват на СЕУ", scopePlaceholder: "Например: производствени обекти, административни сгради, транспорт, съоръжения и енергийни процеси...",
    logoAspect: 3.5,
    contents: ["Системен наръчник за енергийно управление", "5 процедури и свързаните формуляри", "Енергийни цели, мониторинг, одити, рискове и записи"],
    fields: [
      { key: "companyName", required: true, hint: "заглавия, папки, колонтитули" },
      { key: "manager", required: true, hint: "Теодор Серафимов" },
      { key: "representative", hint: "Невена Кръстева" },
      { key: "effectiveDate", required: true },
      { key: "version", required: true },
      { key: "activity", hint: "основна дейност на фирмата" }
    ]
  }} />;
}
