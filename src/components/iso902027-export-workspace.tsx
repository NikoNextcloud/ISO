"use client";

import { IsoExportWorkspace } from "@/components/iso-export-workspace";

export function Iso902027ExportWorkspace() {
  return <IsoExportWorkspace config={{
    code: "ISO 9-20-27",
    edition: "ISO 9001:2015 + ISO/IEC 20000-1:2018 + ISO/IEC 27001",
    apiPath: "/api/iso902027/export",
    templateCount: 271,
    title: "Интегрирана система ISO 9-20-27",
    description: "Генерирайте общ комплект за управление на качеството, услугите и информационната сигурност за избраната фирма.",
    scopeLabel: "Обхват на интегрираната система",
    scopePlaceholder: "Например: разработване, доставка и поддръжка на информационни системи и управлявани услуги...",
    logoAspect: 5.9,
    contents: ["Интегриран наръчник и политики", "Процедури, инструкции, регистри и работни документи", "ISO 9001, ISO/IEC 20000-1 и ISO/IEC 27001 в един ZIP архив"],
    fields: [
      { key: "companyName", required: true, hint: "заглавия, папки, колонтитули" },
      { key: "uic", required: true, hint: "ЕИК на С-ТРЪСТ ГРУП / България" },
      { key: "manager", required: true, hint: "Злати Петров / Станимир Николов" },
      { key: "representative", hint: "Васил Минев" },
      { key: "email", hint: "snt@snt.bg" }
    ]
  }} />;
}
