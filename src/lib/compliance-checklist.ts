import type { ImsDocument, IsoStandardCode, Organization, OrganizationCertificate, OrganizationHistoryEntry } from "@/lib/types";

export type ChecklistItem = { id: string; label: string; complete: boolean; detail: string };
export type StandardChecklist = { standard: IsoStandardCode; percent: number; items: ChecklistItem[] };

const REQUIRED_PROFILE: Record<IsoStandardCode, Array<keyof Organization>> = {
  "ISO 9001": ["name", "address", "manager"],
  "ISO 14001": ["name", "address", "manager"],
  "ISO 45001": ["name", "address", "manager"],
  "ISO 27001": ["name", "address", "manager"],
  "ISO 50001": ["name", "manager"],
  "ISO 9-20-27": ["name", "uic", "manager"],
  "ISO 9001-14001-45001": ["name", "uic", "address", "manager"],
  "ISO 9-14": ["name", "address", "manager"]
};

export function buildOrganizationChecklists(organization: Organization, certificates: OrganizationCertificate[], history: OrganizationHistoryEntry[], documents: ImsDocument[]) {
  const checklists = organization.standards.map((standard): StandardChecklist => {
    const profileMissing = REQUIRED_PROFILE[standard].filter((key) => !String(organization[key] ?? "").trim());
    const relatedDocuments = documents.filter((document) => documentMatchesStandard(document, standard));
    const generated = history.some((entry) => entry.eventType === "system_exported" && entry.description.toLocaleLowerCase("bg").includes(standard.toLocaleLowerCase("bg")));
    const certificate = certificates.find((item) => item.standard === standard);
    const hasNextDate = Boolean(certificate?.nextCertificationDate || organization.nextAuditDate);
    const valid = Boolean(certificate?.validUntil && new Date(`${certificate.validUntil}T23:59:59`).getTime() >= Date.now());
    const items: ChecklistItem[] = [
      { id: "profile", label: "Задължителни фирмени данни", complete: profileMissing.length === 0, detail: profileMissing.length ? `Липсват: ${profileMissing.map(profileLabel).join(", ")}` : "Фирмените данни са попълнени" },
      { id: "generated", label: "Генерирана ISO система", complete: generated, detail: generated ? "Има запис и ZIP версия в историята" : "Все още няма генерирана система" },
      { id: "documents", label: "Документи и доказателства", complete: generated || relatedDocuments.length > 0, detail: relatedDocuments.length ? `${relatedDocuments.length} свързани документа` : generated ? "Документите са в генерирания ZIP" : "Няма свързани документи" },
      { id: "approved", label: "Одобрен документ", complete: relatedDocuments.some((document) => document.status === "approved"), detail: relatedDocuments.some((document) => document.status === "approved") ? "Има поне един одобрен документ" : "Няма документ със статус „Одобрен“" },
      { id: "certificate", label: "Сертификат", complete: Boolean(certificate), detail: certificate ? `№ ${certificate.certificateNumber}` : "Не е добавен сертификат" },
      { id: "validity", label: "Валидност на сертификата", complete: valid, detail: certificate?.validUntil ? (valid ? `Валиден до ${formatDate(certificate.validUntil)}` : `Изтекъл на ${formatDate(certificate.validUntil)}`) : "Не е зададена валидност" },
      { id: "next-date", label: "Следваща сертификация или одит", complete: hasNextDate, detail: hasNextDate ? formatDate(certificate?.nextCertificationDate || organization.nextAuditDate) : "Не е зададена дата" }
    ];
    return { standard, percent: Math.round((items.filter((item) => item.complete).length / items.length) * 100), items };
  });
  const allItems = checklists.flatMap((checklist) => checklist.items);
  return { checklists, percent: allItems.length ? Math.round((allItems.filter((item) => item.complete).length / allItems.length) * 100) : 0, missing: allItems.filter((item) => !item.complete).length };
}

function documentMatchesStandard(document: ImsDocument, standard: IsoStandardCode) {
  if (document.standards.includes(standard)) return true;
  const components: Partial<Record<IsoStandardCode, IsoStandardCode[]>> = {
    "ISO 9-20-27": ["ISO 9001", "ISO 27001"],
    "ISO 9001-14001-45001": ["ISO 9001", "ISO 14001", "ISO 45001"],
    "ISO 9-14": ["ISO 9001", "ISO 14001"]
  };
  return components[standard]?.some((component) => document.standards.includes(component)) ?? false;
}

function profileLabel(key: keyof Organization) {
  return ({ name: "име", uic: "ЕИК", address: "адрес", manager: "управител" } as Partial<Record<keyof Organization, string>>)[key] ?? String(key);
}

function formatDate(value: string) { return new Intl.DateTimeFormat("bg-BG").format(new Date(`${value}T00:00:00`)); }
