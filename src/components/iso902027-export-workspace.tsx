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
    ],
    visualTargets: [
      { sourceHash: "a354e42a7da0b5c04d366969dc9c31a0eab7cf135fcb4dccae578b27b117c21e", label: "RD NISU 07 (2026) · графичен заглавен блок" },
      { sourceHash: "5d8682ec8a5360571b93a751cdd5ea690b9ae8b6c8e1a4ff6f1f9c8af0c53ae0", label: "RD NISU-06 · системен графичен блок" },
      { sourceHash: "05e057f0d2977b48ce09a39be7c9c58d7253ccca9da515e5d18b4f1b735e96e1", label: "RD NISU-06 · контролен графичен блок" },
      { sourceHash: "475247d4b4012e003239da14abc61b2092f2dc873f2eb665842935ceaf521a49", label: "RD NISU-07 · графичен заглавен блок" },
      { sourceHash: "7d40368e73f392df33f6b964ecc6e1ddc22a90d4d994733a2f97406675524322", label: "RD NISU-08 · графичен заглавен блок" },
      { sourceHash: "6fd665c3fdc388ffe573f84337ae1a596030369550cf0a0ee810b51131ebe40e", label: "RD NISU-09 · графичен заглавен блок" },
      { sourceHash: "98ff9aeb2844c4ddd7f296085d85fef7d9e2ac1ea954dd8221a3f19c7d23998d", label: "RD 10-06 · графичен заглавен блок" }
    ]
  }} />;
}
