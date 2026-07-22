"use client";

import { IsoExportWorkspace } from "@/components/iso-export-workspace";

export function Iso9001ExportWorkspace() {
  return <IsoExportWorkspace config={{
    code: "ISO 9001", edition: "ISO 9001:2015", apiPath: "/api/iso9001/export", templateCount: 31,
    title: "ISO 9001 система", description: "Генерирайте комплект документация за управление на качеството и избраната фирма.",
    scopeLabel: "Обхват на СУК", scopePlaceholder: "Например: производство, търговия, услуги, проектиране и административно управление...",
    contents: ["Наръчник по качество", "11 процедури и 8 основни формуляра", "Одитни планове, отчети, обучения и управление на риска"]
  }} />;
}
