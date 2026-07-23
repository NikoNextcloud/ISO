"use client";

import { IsoExportWorkspace } from "@/components/iso-export-workspace";

export function Iso90011400145001ExportWorkspace() {
  return <IsoExportWorkspace config={{
    code: "ISO 9001-14001-45001",
    edition: "ISO 9001:2015 + ISO 14001:2015 + ISO 45001:2018",
    apiPath: "/api/iso90011400145001/export",
    templateCount: 63,
    title: "Интегрирана система ISO 9001-14001-45001",
    description: "Генерирайте пълен интегриран комплект за управление на качеството, околната среда и здравето и безопасността при работа.",
    scopeLabel: "Обхват на интегрираната система",
    scopePlaceholder: "Например: производство, доставка и сервиз при прилагане на изискванията за качество, околна среда и безопасност при работа",
    logoAspect: 3.5,
    contents: [
      "Интегриран наръчник, политика и приложения",
      "Процедури, формуляри, планове и одитни записи",
      "ISO 9001, ISO 14001 и ISO 45001 в един ZIP архив"
    ],
    fields: [
      { key: "companyName", required: true, hint: "заменя ЕКОБУЛ ПАРТНЕР и БАЛКАНРЕМОНТ ИНЖЕНЕРИНГ" },
      { key: "uic", required: true, hint: "заменя ЕИК 206395182" },
      { key: "legalForm", hint: "например ООД или ЕООД" },
      { key: "address", required: true, hint: "заменя адреса в гр. Пазарджик" },
      { key: "city", hint: "използва се за общината и местата на одитите" },
      { key: "manager", required: true, hint: "заменя Иван Георгиев" },
      { key: "foundedAt", hint: "изчиства противоречивите дати за създаване" },
      { key: "email", hint: "заменя office@ecobul.eu" },
      { key: "phone", hint: "заменя 0897550025" },
      { key: "effectiveDate", required: true },
      { key: "internalAuditDate", hint: "дата за план, заповед и доклад от вътрешния одит" },
      { key: "managementReviewDate", hint: "дата за прегледа от ръководството" },
      { key: "previousYear", hint: "заменя старите позовавания на 2021 г." },
      { key: "currentYear", hint: "заменя старите позовавания на 2022 г." },
      { key: "version", hint: "попълнете само когато искате обща нова версия" },
      { key: "activity", required: true, hint: "по нея се адаптира секторното съдържание" },
      { key: "scope", hint: "обхват на интегрираната система" },
      { key: "physicalScope", hint: "площадки, цехове, складове, транспорт и инфраструктура" },
      { key: "organizationContext", hint: "заменя чуждия контекст; ако е празно, се съставя от дейността" },
      { key: "processesDescription", hint: "реалните процеси; ако е празно, се съставят от дейността" },
      { key: "trainingDetails", hint: "попълнете само ако обучителят и датата са известни" }
    ],
    visualTargets: [
      {
        sourceHash: "fb3834367ed5fce12e60e41a3e3ae8f2f5c9c2e825c7b60ed7dd5ad201f4ce46",
        label: "Организационна структура · замени старата схема"
      },
      {
        sourceHash: "4ef3d9af3c521adc3df7a91509b118597a5770c5d0e8f5e6eb9cfc5d04956415",
        label: "Процесна карта · замени англоезичната диаграма"
      }
    ]
  }} />;
}
