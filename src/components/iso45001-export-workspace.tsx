"use client";

import { IsoExportWorkspace } from "@/components/iso-export-workspace";

export function Iso45001ExportWorkspace() {
  return <IsoExportWorkspace config={{
    code: "ISO 45001", edition: "ISO 45001", apiPath: "/api/iso45001/export", templateCount: 60,
    title: "ISO 45001 система", description: "Генерирайте пълен комплект документация за здраве и безопасност при работа и избраната фирма.",
    scopeLabel: "Обхват на СУЗБУТ", scopePlaceholder: "Например: производство, монтаж, ремонтни дейности и административно управление...",
    logoAspect: 3.7, contents: ["Оригинална папкова структура", "Наръчник и 31 формуляра", "Процедури, подготовка и одит"]
  }} />;
}
