"use client";

import { IsoExportWorkspace } from "@/components/iso-export-workspace";

export function Iso27001ExportWorkspace() {
  return <IsoExportWorkspace config={{
    code: "ISO 27001", edition: "ISO/IEC 27001:2022", apiPath: "/api/iso27001/export", templateCount: 84,
    title: "ISO 27001 система", description: "Генерирайте пълен комплект документация за информационна сигурност и избраната фирма.",
    scopeLabel: "Обхват на СУСИ", scopePlaceholder: "Например: предоставяне на ИТ услуги, разработка и поддръжка на софтуер...",
    logoAspect: 1,
    contents: ["Оригинална папкова структура", "Наръчник и приложения", "Политики, процедури и записи"],
    fields: [
      { key: "companyName", required: true, hint: "заглавия, папки, колонтитули" },
      { key: "address", required: true, hint: "адрес на управление" },
      { key: "manager", required: true, hint: "Владимира Емилова / Драмов" },
      { key: "effectiveDate", required: true },
      { key: "version", required: true },
      { key: "activity", hint: "основна дейност на фирмата" }
    ]
  }} />;
}
