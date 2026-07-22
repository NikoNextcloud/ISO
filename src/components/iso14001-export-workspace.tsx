"use client";

import { IsoExportWorkspace } from "@/components/iso-export-workspace";

export function Iso14001ExportWorkspace() {
  return <IsoExportWorkspace config={{
    code: "ISO 14001", edition: "ISO 14001:2015", apiPath: "/api/iso14001/export", templateCount: 12,
    title: "ISO 14001 система", description: "Генерирайте комплект документация за управление на околната среда и избраната фирма.",
    scopeLabel: "Обхват на СУОС", scopePlaceholder: "Например: производство, складова дейност, транспорт и административно управление...",
    contents: ["Наръчник за управление на околната среда", "10 процедури по околна среда", "Корици и контролни данни"]
  }} />;
}
