"use client";

import { cloneElement, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { Award, BarChart3, Building2, Cloud, Edit3, FileText, FolderOpen, Gauge, History, Loader2, LogIn, LogOut, Plus, Save, Search, TrendingUp, Trash2, X } from "lucide-react";
import { Section, StandardPills, StatCard, StatusBadge } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { IsoStandardCode, Organization, OrganizationCertificate, OrganizationHistoryEntry, OrganizationStatus } from "@/lib/types";

const STORAGE_KEY = "iso-certification-organizations-v2";
const LEGACY_STORAGE_KEY = "ims-ai-organizations-v1";
const CERTIFICATES_STORAGE_KEY = "iso-certification-certificates-v1";
const HISTORY_STORAGE_KEY = "iso-certification-history-v1";
const DOCUMENTS_STORAGE_KEY = "iso-certification-documents-v1";
const standardOptions: IsoStandardCode[] = [
  "ISO 9001", "ISO 14001", "ISO 45001", "ISO 27001", "ISO 50001",
  "ISO 9-20-27", "ISO 9001-14001-45001", "ISO 9-14"
];
const statusOptions: { value: OrganizationStatus; label: string }[] = [
  { value: "draft", label: "Чернова" },
  { value: "implementation", label: "Внедряване" },
  { value: "ready", label: "Готово" },
  { value: "certified", label: "Сертифицирана" },
  { value: "attention", label: "Изисква внимание" }
];

const defaultOrganizations: Organization[] = [
  { id: "org-1", name: "Метал Форм АД", uic: "204512345", address: "Пловдив, Индустриална зона", manager: "Иван Петров", contactEmail: "office@metalform.example", employees: 86, activity: "Металообработка и CNC производство", sites: 2, standards: ["ISO 9001", "ISO 14001", "ISO 45001"], status: "implementation", readiness: 72, nextAuditDate: "2026-09-18" },
  { id: "org-2", name: "Дигитал Сейф ООД", uic: "207712340", address: "София, бул. България 88", manager: "Мария Георгиева", contactEmail: "security@digitalsafe.example", employees: 34, activity: "Разработка на софтуер и облачни услуги", sites: 1, standards: ["ISO 9001", "ISO 27001"], status: "attention", readiness: 58, nextAuditDate: "2026-08-04" },
  { id: "org-3", name: "Енерго Плант ЕООД", uic: "205098765", address: "Стара Загора, Производствен парк", manager: "Николай Димитров", contactEmail: "ims@energoplant.example", employees: 142, activity: "Енергийно интензивно производство", sites: 3, standards: ["ISO 9001", "ISO 14001", "ISO 45001", "ISO 50001"], status: "ready", readiness: 91, nextAuditDate: "2026-10-22" }
];

const emptyOrganization: Organization = {
  id: "", name: "", uic: "", legalForm: "", address: "", city: "", manager: "", foundedAt: "",
  representative: "", contactName: "", contactPhone: "", contactEmail: "", employees: 0, activity: "",
  physicalScope: "", systemDate: "", organizationContext: "", processesDescription: "", trainingDetails: "",
  internalAuditDate: "", managementReviewDate: "", previousYear: undefined, currentYear: undefined,
  sites: 1, standards: ["ISO 9001"], status: "draft", readiness: 0, nextAuditDate: ""
};

const emptyCertificate: Omit<OrganizationCertificate, "id" | "organizationId" | "createdAt"> = {
  standard: "ISO 9001",
  certificateNumber: "",
  certificationBody: "",
  issuedAt: "",
  validUntil: "",
  nextCertificationDate: "",
  notes: ""
};

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `org-${Date.now()}`;
}

export function OrganizationWorkspace({ view }: { view: "dashboard" | "organizations" }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [organizations, setOrganizations] = useState<Organization[]>(supabase ? [] : defaultOrganizations);
  const [certificates, setCertificates] = useState<OrganizationCertificate[]>([]);
  const [history, setHistory] = useState<OrganizationHistoryEntry[]>([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});
  const [storageReady, setStorageReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(!supabase);
  const [syncing, setSyncing] = useState(Boolean(supabase));
  const [syncError, setSyncError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Organization | null>(null);
  const [dossierId, setDossierId] = useState("");
  const [certificateDraft, setCertificateDraft] = useState({ ...emptyCertificate });
  const [showCertificateForm, setShowCertificateForm] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (supabase) return;
    const saved = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved) {
      try { setOrganizations(JSON.parse(saved) as Organization[]); }
      catch { window.localStorage.removeItem(STORAGE_KEY); }
    }
    const savedCertificates = window.localStorage.getItem(CERTIFICATES_STORAGE_KEY);
    const savedHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedCertificates) {
      try { setCertificates(JSON.parse(savedCertificates) as OrganizationCertificate[]); }
      catch { window.localStorage.removeItem(CERTIFICATES_STORAGE_KEY); }
    }
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory) as OrganizationHistoryEntry[]); }
      catch { window.localStorage.removeItem(HISTORY_STORAGE_KEY); }
    }
    try {
      const localDocuments = JSON.parse(window.localStorage.getItem(DOCUMENTS_STORAGE_KEY) ?? "[]") as { organizationId?: string }[];
      setDocumentCount(localDocuments.length);
      setDocumentCounts(countByOrganization(localDocuments.map((item) => item.organizationId)));
    }
    catch { setDocumentCount(0); }
    setStorageReady(true);
  }, [supabase]);

  useEffect(() => {
    if (!supabase && storageReady) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(organizations));
  }, [organizations, storageReady, supabase]);

  useEffect(() => {
    if (!supabase && storageReady) window.localStorage.setItem(CERTIFICATES_STORAGE_KEY, JSON.stringify(certificates));
  }, [certificates, storageReady, supabase]);

  useEffect(() => {
    if (!supabase && storageReady) window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }, [history, storageReady, supabase]);

  useEffect(() => {
    const receiveHistory = (event: Event) => {
      const entry = (event as CustomEvent<OrganizationHistoryEntry>).detail;
      if (!entry) return;
      setHistory((current) => current.some((item) => item.id === entry.id) ? current : [entry, ...current]);
    };
    window.addEventListener("iso-history-added", receiveHistory);
    return () => window.removeEventListener("iso-history-added", receiveHistory);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthChecked(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) {
      if (supabase) setSyncing(false);
      return;
    }
    let active = true;
    setSyncing(true);
    setSyncError("");
    supabase.from("organizations").select("*").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      if (error) setSyncError(`Неуспешно зареждане от Supabase: ${error.message}`);
      else setOrganizations((data ?? []).map(fromDatabase));
      setSyncing(false);
    });
    return () => { active = false; };
  }, [supabase, user]);

  useEffect(() => {
    if (!supabase || !user) return;
    Promise.all([
      supabase.from("organization_certificates").select("*").order("created_at", { ascending: false }),
      supabase.from("organization_history").select("*").order("event_date", { ascending: false }),
      supabase.from("documents").select("organization_id")
    ]).then(([certificateResult, historyResult, documentResult]) => {
      if (certificateResult.error || historyResult.error || documentResult.error) {
        const message = certificateResult.error?.message ?? historyResult.error?.message ?? documentResult.error?.message;
        setSyncError(`Сертификатите и историята не са заредени: ${message}. Изпълнете миграция 004 в Supabase.`);
        return;
      }
      setCertificates((certificateResult.data ?? []).map(certificateFromDatabase));
      setHistory((historyResult.data ?? []).map(historyFromDatabase));
      const documentRows = documentResult.data ?? [];
      setDocumentCount(documentRows.length);
      setDocumentCounts(countByOrganization(documentRows.map((item) => item.organization_id)));
    });
  }, [supabase, user]);

  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("bg");
    if (!value) return organizations;
    return organizations.filter((organization) =>
      [
        organization.name, organization.uic, organization.legalForm, organization.city, organization.address,
        organization.activity, organization.physicalScope, organization.organizationContext,
        organization.processesDescription, organization.manager, ...organization.standards
      ]
        .join(" ").toLocaleLowerCase("bg").includes(value)
    );
  }, [organizations, query]);

  const readinessAverage = organizations.length ? Math.round(organizations.reduce((sum, item) => sum + item.readiness, 0) / organizations.length) : 0;
  const dossier = organizations.find((item) => item.id === dossierId) ?? null;
  const dossierCertificates = certificates.filter((item) => item.organizationId === dossierId).sort((a, b) => (a.nextCertificationDate || "9999").localeCompare(b.nextCertificationDate || "9999"));
  const dossierHistory = history.filter((item) => item.organizationId === dossierId).sort((a, b) => b.eventDate.localeCompare(a.eventDate));

  function openNew() {
    setError("");
    setEditing({ ...emptyOrganization, id: makeId(), standards: [...emptyOrganization.standards] });
  }

  function openEdit(organization: Organization) {
    setError("");
    setEditing({ ...organization, standards: [...organization.standards] });
  }

  function openDossier(organization: Organization) {
    setDossierId(organization.id);
    setCertificateDraft({ ...emptyCertificate, standard: organization.standards[0] ?? "ISO 9001" });
    setShowCertificateForm(false);
    setError("");
  }

  async function recordHistory(organizationId: string, eventType: OrganizationHistoryEntry["eventType"], description: string) {
    const entry: OrganizationHistoryEntry = { id: makeId(), organizationId, eventType, description, eventDate: new Date().toISOString() };
    if (supabase && user) {
      const { data, error } = await supabase.from("organization_history").insert({
        id: entry.id,
        organization_id: organizationId,
        user_id: user.id,
        event_type: eventType,
        description,
        event_date: entry.eventDate
      }).select().single();
      if (error) {
        setSyncError(`Историята не беше записана: ${error.message}`);
        return;
      }
      setHistory((current) => [historyFromDatabase(data), ...current]);
      return;
    }
    setHistory((current) => [entry, ...current]);
  }

  async function saveOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    if (!editing.name.trim() || !editing.uic.trim()) return setError("Името на фирмата и ЕИК са задължителни.");
    if (!editing.standards.length) return setError("Изберете поне един ISO стандарт.");
    const exists = organizations.some((item) => item.id === editing.id);
    if (supabase && user) {
      setSyncing(true);
      setSyncError("");
      const payload = toDatabase(editing, user.id);
      const result = exists
        ? await supabase.from("organizations").update(payload).eq("id", editing.id).select().single()
        : await supabase.from("organizations").insert(payload).select().single();
      setSyncing(false);
      if (result.error) {
        setError(`Supabase отказа записа: ${result.error.message}`);
        return;
      }
      const saved = fromDatabase(result.data);
      setOrganizations((current) => exists ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      await recordHistory(saved.id, exists ? "organization_updated" : "organization_created", exists ? `Данните на фирмата са редактирани. Избрани стандарти: ${saved.standards.join(", ")}.` : `Фирмата е добавена. Избрани стандарти: ${saved.standards.join(", ")}.`);
      setEditing(null);
      return;
    }
    setOrganizations((current) => exists ? current.map((item) => item.id === editing.id ? editing : item) : [editing, ...current]);
    await recordHistory(editing.id, exists ? "organization_updated" : "organization_created", exists ? `Данните на фирмата са редактирани. Избрани стандарти: ${editing.standards.join(", ")}.` : `Фирмата е добавена. Избрани стандарти: ${editing.standards.join(", ")}.`);
    setEditing(null);
  }

  async function addCertificate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dossier) return;
    if (!certificateDraft.certificateNumber.trim()) return setError("Въведете номер на сертификата.");
    const certificate: OrganizationCertificate = {
      ...certificateDraft,
      id: makeId(),
      organizationId: dossier.id,
      createdAt: new Date().toISOString()
    };
    if (supabase && user) {
      setSyncing(true);
      const { data, error } = await supabase.from("organization_certificates").insert(certificateToDatabase(certificate)).select().single();
      setSyncing(false);
      if (error) return setError(`Сертификатът не беше записан: ${error.message}`);
      setCertificates((current) => [certificateFromDatabase(data), ...current]);
    } else {
      setCertificates((current) => [certificate, ...current]);
    }

    if (!dossier.standards.includes(certificate.standard)) {
      const standards = [...dossier.standards, certificate.standard];
      setOrganizations((current) => current.map((item) => item.id === dossier.id ? { ...item, standards } : item));
      if (supabase && user) await supabase.from("organizations").update({ standards }).eq("id", dossier.id);
    }
    await recordHistory(dossier.id, "certificate_added", `Добавен сертификат ${certificate.standard}, № ${certificate.certificateNumber}. Следваща сертификация: ${formatDate(certificate.nextCertificationDate)}.`);
    setCertificateDraft({ ...emptyCertificate, standard: dossier.standards[0] ?? certificate.standard });
    setShowCertificateForm(false);
    setError("");
  }

  async function removeCertificate(certificate: OrganizationCertificate) {
    if (!window.confirm(`Да бъде ли изтрит сертификат ${certificate.standard} № ${certificate.certificateNumber}?`)) return;
    if (supabase && user) {
      const { error } = await supabase.from("organization_certificates").delete().eq("id", certificate.id);
      if (error) return setSyncError(`Сертификатът не беше изтрит: ${error.message}`);
    }
    setCertificates((current) => current.filter((item) => item.id !== certificate.id));
    await recordHistory(certificate.organizationId, "certificate_removed", `Изтрит сертификат ${certificate.standard}, № ${certificate.certificateNumber}.`);
  }

  async function removeOrganization(organization: Organization) {
    if (window.confirm(`Сигурни ли сте, че искате да изтриете „${organization.name}“?`)) {
      if (supabase && user) {
        setSyncing(true);
        const { error } = await supabase.from("organizations").delete().eq("id", organization.id);
        setSyncing(false);
        if (error) return setSyncError(`Supabase отказа изтриването: ${error.message}`);
      }
      setOrganizations((current) => current.filter((item) => item.id !== organization.id));
    }
  }

  if (supabase && !authChecked) return <LoadingState />;
  if (supabase && !user) return <LoginPanel supabase={supabase} />;

  return <>
    {view === "dashboard" ? <Section id="dashboard" title="Табло" description="Общ поглед върху клиентите, готовността и критичните действия.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Организации" value={organizations.length} />
        <StatCard icon={Gauge} label="Средна готовност" tone="success" value={`${readinessAverage}%`} />
        <StatCard icon={Award} label="Сертификати" value={certificates.length} />
        <StatCard icon={FileText} label="Качени документи" value={documentCount} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-bold text-ink"><TrendingUp className="h-5 w-5 text-teal-600" />Готовност по организации</h3>
          <div className="flex items-center gap-2">
            {supabase ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700"><Cloud className="h-4 w-4" />Supabase</span> : <span className="text-xs font-medium text-amber-700">Локален режим</span>}
            {supabase ? <button aria-label="Изход" className="focus-ring grid h-9 w-9 place-items-center rounded border border-line text-slate-600 hover:bg-panel" onClick={() => supabase.auth.signOut()} title="Изход" type="button"><LogOut className="h-4 w-4" /></button> : null}
            <button className="focus-ring inline-flex items-center gap-2 rounded bg-action px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={openNew} type="button"><Plus className="h-4 w-4" />Нов клиент</button>
          </div>
        </div>
        {syncError ? <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{syncError}</p> : null}
        {syncing ? <p className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Синхронизиране със Supabase...</p> : null}
        {organizations.length ? <div className="space-y-4">{[...organizations].sort((a, b) => a.readiness - b.readiness).map((organization) => <div key={organization.id}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="font-medium text-ink">{organization.name}</span><span className="text-slate-500">{organization.readiness}%</span></div>
          <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${organization.readiness}%` }} /></div>
        </div>)}</div> : <p className="py-5 text-center text-sm text-slate-500">Все още няма добавени фирми.</p>}
      </div>
      <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-ink"><BarChart3 className="h-5 w-5 text-blue-600" />Покритие по ISO стандарти</h3>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{standardOptions.map((standard) => {
          const count = organizations.filter((organization) => organization.standards.includes(standard)).length;
          const percentage = organizations.length ? Math.round((count / organizations.length) * 100) : 0;
          return <div key={standard}><div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-semibold text-ink">{standard}</span><span className="text-slate-500">{count} {count === 1 ? "фирма" : "фирми"}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-teal-600" style={{ width: `${percentage}%` }} /></div></div>;
        })}</div>
      </div>
      </div>
    </Section> : null}

    {view === "organizations" ? <Section id="organizations" title="Фирми" description="Добавяйте, намирайте и редактирайте клиентските организации.">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex h-11 flex-1 items-center gap-2 rounded-lg border border-line bg-white px-3 shadow-sm"><Search className="h-4 w-4 text-slate-400" /><input aria-label="Търсене на фирми" className="focus-ring w-full border-0 bg-transparent text-sm outline-none" onChange={(e) => setQuery(e.target.value)} placeholder="Търсене по фирма, ЕИК, дейност или стандарт" value={query} /></div>
        <button className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-action px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700" onClick={openNew} type="button"><Plus className="h-4 w-4" />Добави фирма</button>
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-line bg-white shadow-soft md:block">
        <table className="w-full min-w-[1380px] text-left text-sm">
          <thead className="border-b border-line bg-panel text-xs font-semibold uppercase text-slate-500"><tr><th className="px-4 py-3">Фирма</th><th className="px-4 py-3">ЕИК</th><th className="px-4 py-3">Управител / контакт</th><th className="px-4 py-3">Телефон</th><th className="px-4 py-3 text-center">Служители</th><th className="px-4 py-3">Стандарти</th><th className="px-4 py-3 text-center">Сертификати</th><th className="px-4 py-3 text-center">Документи</th><th className="px-4 py-3">Следваща сертификация</th><th className="px-4 py-3 text-right">Действия</th></tr></thead>
          <tbody>{filtered.map((organization) => <tr className="border-b border-line last:border-0" key={organization.id}><td className="max-w-64 px-4 py-4"><p className="font-medium text-ink">{organization.name}</p><p className="truncate text-xs text-slate-500">{[organization.legalForm, organization.city, organization.activity].filter(Boolean).join(" · ") || "Без въведена дейност"}</p></td><td className="whitespace-nowrap px-4 py-4 text-slate-600">{organization.uic}</td><td className="px-4 py-4"><p className="text-ink">{organization.manager || "Не е посочен"}</p><p className="text-xs text-slate-500">{organization.contactName || organization.contactEmail || "Без контакт"}</p></td><td className="whitespace-nowrap px-4 py-4 text-slate-600">{organization.contactPhone || "Не е посочен"}</td><td className="px-4 py-4 text-center text-slate-600">{organization.employees}</td><td className="px-4 py-4"><StandardPills standards={organization.standards} /></td><td className="px-4 py-4 text-center font-medium text-ink">{certificates.filter((item) => item.organizationId === organization.id).length}</td><td className="px-4 py-4 text-center font-medium text-ink">{documentCounts[organization.id] ?? 0}</td><td className="whitespace-nowrap px-4 py-4 text-slate-600">{nextCertificationFor(organization.id, certificates)}</td><td className="px-4 py-4"><div className="flex justify-end gap-1"><Link aria-label={`Досие на ${organization.name}`} className="focus-ring grid h-9 w-9 place-items-center rounded text-slate-600 hover:bg-panel hover:text-action" href={`/organizations/${organization.id}` as Route} title="Отвори досието"><FolderOpen className="h-4 w-4" /></Link><button aria-label={`Редактиране на ${organization.name}`} className="focus-ring grid h-9 w-9 place-items-center rounded text-slate-600 hover:bg-panel hover:text-action" onClick={() => openEdit(organization)} title="Редактиране" type="button"><Edit3 className="h-4 w-4" /></button><button aria-label={`Изтриване на ${organization.name}`} className="focus-ring grid h-9 w-9 place-items-center rounded text-slate-500 hover:bg-red-50 hover:text-red-700" onClick={() => removeOrganization(organization)} title="Изтриване" type="button"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">{filtered.map((organization) => <div className="rounded-lg border border-line bg-white p-4 shadow-soft" key={organization.id}>
        <div className="flex items-start justify-between gap-3"><div><p className="font-medium text-ink">{organization.name}</p><p className="text-xs text-slate-500">ЕИК {organization.uic}</p></div><StatusBadge status={organization.status} /></div>
        <p className="mt-3 text-sm text-slate-600">{[organization.legalForm, organization.city, organization.activity].filter(Boolean).join(" · ") || "Без въведена дейност"}</p><div className="mt-3"><StandardPills standards={organization.standards} /></div>
        <div className="mt-4 flex gap-2"><Link className="focus-ring inline-flex flex-1 items-center justify-center gap-2 rounded border border-line px-3 py-2 text-sm" href={`/organizations/${organization.id}` as Route}><FolderOpen className="h-4 w-4" />Досие</Link><button className="focus-ring inline-flex flex-1 items-center justify-center gap-2 rounded border border-line px-3 py-2 text-sm" onClick={() => openEdit(organization)} type="button"><Edit3 className="h-4 w-4" />Редактирай</button><button aria-label="Изтриване" className="focus-ring grid h-10 w-10 place-items-center rounded border border-line text-red-700" onClick={() => removeOrganization(organization)} type="button"><Trash2 className="h-4 w-4" /></button></div>
      </div>)}</div>
      {!filtered.length ? <div className="rounded border border-dashed border-line bg-white py-10 text-center text-sm text-slate-500">Няма фирми, които отговарят на търсенето.</div> : null}
    </Section> : null}

    {editing ? <div aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-5" role="dialog">
      <form className="max-h-[94vh] w-full overflow-y-auto rounded-t-lg bg-white shadow-xl sm:max-w-5xl sm:rounded-lg" onSubmit={saveOrganization}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4"><div><h2 className="text-base font-semibold text-ink">{organizations.some((item) => item.id === editing.id) ? "Редактиране на фирма" : "Нова фирма"}</h2><p className="text-xs text-slate-500">Полетата със звездичка са задължителни.</p></div><button aria-label="Затвори" className="focus-ring grid h-9 w-9 place-items-center rounded hover:bg-panel" onClick={() => setEditing(null)} type="button"><X className="h-5 w-5" /></button></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <FormSectionTitle title="Основни данни за фирмата" />
          <Field label="Име на фирмата *"><input autoFocus placeholder="ЕКОБУЛ ПАРТНЕР ООД" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="ЕИК *"><input inputMode="numeric" placeholder="206395182" required value={editing.uic} onChange={(e) => setEditing({ ...editing, uic: e.target.value })} /></Field>
          <Field label="Правна форма"><input placeholder="ООД" value={editing.legalForm ?? ""} onChange={(e) => setEditing({ ...editing, legalForm: e.target.value })} /></Field>
          <Field label="Град"><input placeholder="Пазарджик" value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></Field>
          <Field label="Седалище/адрес"><input placeholder="гр. Пазарджик, ул. Найчо Цанов №11" value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></Field>
          <Field label="Дата на създаване на фирмата"><input type="date" value={editing.foundedAt ?? ""} onChange={(e) => setEditing({ ...editing, foundedAt: e.target.value })} /></Field>
          <Field label="Имейл"><input placeholder="office@ecobul.eu" type="email" value={editing.contactEmail} onChange={(e) => setEditing({ ...editing, contactEmail: e.target.value })} /></Field>
          <Field label="Телефон"><input placeholder="0897550025" value={editing.contactPhone ?? ""} onChange={(e) => setEditing({ ...editing, contactPhone: e.target.value })} /></Field>
          <Field label="Управител"><input placeholder="Николай Вилинов Острев" value={editing.manager} onChange={(e) => setEditing({ ...editing, manager: e.target.value })} /></Field>
          <Field label="Дата на системата"><input type="date" value={editing.systemDate ?? ""} onChange={(e) => {
            const systemDate = e.target.value;
            setEditing({
              ...editing,
              systemDate,
              internalAuditDate: editing.internalAuditDate || addDays(systemDate, 14),
              managementReviewDate: editing.managementReviewDate || addDays(systemDate, 17)
            });
          }} /></Field>
          <TextAreaField label="Обхват на дейност" placeholder="Складиране, съхранение, обработка, разглобяване, сортиране и разкомплектоване на отпадъчни тонер касети" value={editing.activity} onChange={(value) => setEditing({ ...editing, activity: value })} />
          <TextAreaField label="Физически обхват" placeholder="Работни площадки, складове, административни помещения, инфраструктура, информационни системи" value={editing.physicalScope ?? ""} onChange={(value) => setEditing({ ...editing, physicalScope: value })} />
          <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-medium text-ink">ISO стандарти *</legend><div className="grid gap-2 sm:grid-cols-3">{standardOptions.map((standard) => <label className="flex cursor-pointer items-center gap-2 rounded border border-line px-3 py-2 text-sm hover:bg-panel" key={standard}><input checked={editing.standards.includes(standard)} className="h-4 w-4 accent-blue-600" onChange={(e) => setEditing({ ...editing, standards: e.target.checked ? [...editing.standards, standard] : editing.standards.filter((item) => item !== standard) })} type="checkbox" />{standard}</label>)}</div></fieldset>

          <FormSectionTitle title="Данни за системата" />
          <TextAreaField label="Контекст на организацията" placeholder="Описание на дейността, вътрешните и външните фактори на фирмата" value={editing.organizationContext ?? ""} onChange={(value) => setEditing({ ...editing, organizationContext: value })} />
          <TextAreaField label="Процеси" placeholder="Управление, услуги, доставки, склад, клиенти, одити, несъответствия и др." value={editing.processesDescription ?? ""} onChange={(value) => setEditing({ ...editing, processesDescription: value })} />
          <TextAreaField label="Обучения" placeholder="05.01.2022 г., обучител „Сириус Груп С“ ЕООД" value={editing.trainingDetails ?? ""} onChange={(value) => setEditing({ ...editing, trainingDetails: value })} />
          <Field label="Вътрешен одит"><input type="date" value={editing.internalAuditDate ?? ""} onChange={(e) => setEditing({ ...editing, internalAuditDate: e.target.value })} /></Field>
          <Field label="Преглед от ръководството"><input type="date" value={editing.managementReviewDate ?? ""} onChange={(e) => setEditing({ ...editing, managementReviewDate: e.target.value })} /></Field>
          <Field label="Предходна година"><input inputMode="numeric" max="2200" min="1900" placeholder="2025" type="number" value={editing.previousYear ?? ""} onChange={(e) => setEditing({ ...editing, previousYear: e.target.value ? Number(e.target.value) : undefined })} /></Field>
          <Field label="Настояща година"><input inputMode="numeric" max="2200" min="1900" placeholder="2026" type="number" value={editing.currentYear ?? ""} onChange={(e) => setEditing({ ...editing, currentYear: e.target.value ? Number(e.target.value) : undefined })} /></Field>

          <FormSectionTitle title="Допълнителни административни данни" />
          <Field label="Представител на ръководството"><input value={editing.representative ?? ""} onChange={(e) => setEditing({ ...editing, representative: e.target.value })} /></Field>
          <Field label="Лице за контакт"><input value={editing.contactName ?? ""} onChange={(e) => setEditing({ ...editing, contactName: e.target.value })} /></Field>
          <Field label="Брой служители"><input min="0" type="number" value={editing.employees} onChange={(e) => setEditing({ ...editing, employees: Number(e.target.value) })} /></Field>
          <Field label="Брой обекти"><input min="0" type="number" value={editing.sites} onChange={(e) => setEditing({ ...editing, sites: Number(e.target.value) })} /></Field>
          <Field label="Статус"><select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as OrganizationStatus })}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
          <Field label={`Готовност: ${editing.readiness}%`}><input className="accent-blue-600" max="100" min="0" type="range" value={editing.readiness} onChange={(e) => setEditing({ ...editing, readiness: Number(e.target.value) })} /></Field>
          <Field label="Следващ одит"><input type="date" value={editing.nextAuditDate} onChange={(e) => setEditing({ ...editing, nextAuditDate: e.target.value })} /></Field>
          {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p> : null}
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-white px-5 py-4"><button className="focus-ring rounded border border-line px-4 py-2 text-sm font-medium hover:bg-panel" onClick={() => setEditing(null)} type="button">Отказ</button><button className="focus-ring rounded bg-action px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" type="submit">Запази фирмата</button></div>
      </form>
    </div> : null}

    {dossier ? <div aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-5" role="dialog">
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-lg bg-white shadow-xl sm:max-w-5xl sm:rounded-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4"><div><h2 className="text-base font-semibold text-ink">Досие на {dossier.name}</h2><p className="text-xs text-slate-500">ЕИК {dossier.uic} · {dossierCertificates.length} сертификата · {dossierHistory.length} събития</p></div><button aria-label="Затвори" className="focus-ring grid h-9 w-9 place-items-center rounded hover:bg-panel" onClick={() => setDossierId("")} type="button"><X className="h-5 w-5" /></button></div>
        <div className="space-y-8 p-5">
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><Award className="h-4 w-4 text-brand" />Сертификати</h3><p className="mt-1 text-xs text-slate-500">Към една фирма могат да бъдат добавени няколко сертификата по един или различни стандарти.</p></div><button className="focus-ring inline-flex items-center gap-2 rounded bg-action px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={() => { setShowCertificateForm((current) => !current); setError(""); }} type="button"><Plus className="h-4 w-4" />Добави сертификат</button></div>

            {showCertificateForm ? <form className="mb-5 grid gap-4 border-y border-line bg-panel px-4 py-4 sm:grid-cols-3" onSubmit={addCertificate}>
              <Field label="Стандарт *"><select required value={certificateDraft.standard} onChange={(event) => setCertificateDraft({ ...certificateDraft, standard: event.target.value as IsoStandardCode })}>{standardOptions.map((standard) => <option key={standard}>{standard}</option>)}</select></Field>
              <Field label="Номер на сертификата *"><input required value={certificateDraft.certificateNumber} onChange={(event) => setCertificateDraft({ ...certificateDraft, certificateNumber: event.target.value })} /></Field>
              <Field label="Сертифициращ орган"><input value={certificateDraft.certificationBody} onChange={(event) => setCertificateDraft({ ...certificateDraft, certificationBody: event.target.value })} /></Field>
              <Field label="Дата на издаване"><input type="date" value={certificateDraft.issuedAt} onChange={(event) => setCertificateDraft({ ...certificateDraft, issuedAt: event.target.value })} /></Field>
              <Field label="Валиден до"><input type="date" value={certificateDraft.validUntil} onChange={(event) => setCertificateDraft({ ...certificateDraft, validUntil: event.target.value })} /></Field>
              <Field label="Следваща сертификация"><input type="date" value={certificateDraft.nextCertificationDate} onChange={(event) => setCertificateDraft({ ...certificateDraft, nextCertificationDate: event.target.value })} /></Field>
              <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-3">Бележки<textarea className="focus-ring min-h-20 rounded border border-line bg-white p-3 text-sm font-normal outline-none" value={certificateDraft.notes} onChange={(event) => setCertificateDraft({ ...certificateDraft, notes: event.target.value })} /></label>
              {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-3">{error}</p> : null}
              <div className="flex justify-end gap-2 sm:col-span-3"><button className="focus-ring rounded border border-line bg-white px-3 py-2 text-sm" onClick={() => setShowCertificateForm(false)} type="button">Отказ</button><button className="focus-ring inline-flex items-center gap-2 rounded bg-action px-3 py-2 text-sm font-medium text-white" disabled={syncing} type="submit"><Save className="h-4 w-4" />Запази сертификата</button></div>
            </form> : null}

            {dossierCertificates.length ? <div className="overflow-hidden rounded border border-line">
              <div className="hidden grid-cols-12 gap-3 border-b border-line bg-panel px-4 py-2 text-xs font-semibold uppercase text-slate-500 md:grid"><span className="col-span-2">Стандарт</span><span className="col-span-2">Номер</span><span className="col-span-2">Издаден</span><span className="col-span-2">Валиден до</span><span className="col-span-3">Следваща сертификация</span><span className="text-right">Действия</span></div>
              {dossierCertificates.map((certificate) => <div className="grid gap-2 border-b border-line px-4 py-3 text-sm last:border-b-0 md:grid-cols-12 md:items-center md:gap-3" key={certificate.id}><div className="md:col-span-2"><span className="font-medium text-ink">{certificate.standard}</span><span className={`ml-2 text-xs ${certificateStatus(certificate.validUntil).tone}`}>{certificateStatus(certificate.validUntil).label}</span></div><span className="text-slate-600 md:col-span-2">№ {certificate.certificateNumber}</span><span className="text-slate-600 md:col-span-2">{formatDate(certificate.issuedAt)}</span><span className="text-slate-600 md:col-span-2">{formatDate(certificate.validUntil)}</span><span className="font-medium text-ink md:col-span-3">{formatDate(certificate.nextCertificationDate)}</span><div className="flex justify-end"><button aria-label="Изтрий сертификата" className="focus-ring grid h-8 w-8 place-items-center rounded text-red-700 hover:bg-red-50" onClick={() => removeCertificate(certificate)} title="Изтриване" type="button"><Trash2 className="h-4 w-4" /></button></div>{certificate.certificationBody || certificate.notes ? <p className="text-xs text-slate-500 md:col-span-11 md:col-start-2">{[certificate.certificationBody, certificate.notes].filter(Boolean).join(" · ")}</p> : null}</div>)}
            </div> : <div className="rounded border border-dashed border-line py-8 text-center text-sm text-slate-500">Все още няма добавени сертификати.</div>}
          </section>

          <section>
            <div className="mb-4"><h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><History className="h-4 w-4 text-brand" />История на фирмата</h3><p className="mt-1 text-xs text-slate-500">Автоматичен запис на добавянето, редакциите, сертификатите и генерираните ISO системи.</p></div>
            {dossierHistory.length ? <ol className="border-l border-line pl-5">{dossierHistory.map((entry) => <li className="relative pb-5 last:pb-0" key={entry.id}><span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-brand" /><p className="text-sm text-ink">{entry.description}</p><p className="mt-1 text-xs text-slate-500">{formatDateTime(entry.eventDate)}</p></li>)}</ol> : <div className="rounded border border-dashed border-line py-8 text-center text-sm text-slate-500">Историята ще започне при следващото записано действие.</div>}
          </section>
        </div>
      </div>
    </div> : null}
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactElement<{ className?: string }> }) {
  return <label className="grid gap-1.5 text-sm font-medium text-ink">{label}{cloneElement(children, { className: `focus-ring h-10 w-full rounded border border-line bg-white px-3 text-sm font-normal outline-none ${children.props.className ?? ""}` })}</label>;
}

function TextAreaField({ label, placeholder, value, onChange }: { label: string; placeholder?: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2">{label}<textarea className="focus-ring min-h-24 w-full rounded border border-line bg-white p-3 text-sm font-normal outline-none" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function FormSectionTitle({ title }: { title: string }) {
  return <div className="border-b border-line pb-2 pt-2 sm:col-span-2"><h3 className="text-sm font-semibold text-ink">{title}</h3></div>;
}

function addDays(value: string, days: number) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

type OrganizationRow = {
  id: string;
  name: string;
  uic: string;
  legal_form: string | null;
  address: string | null;
  city: string | null;
  manager: string | null;
  founded_at: string | null;
  representative: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  employees_count: number;
  activity: string | null;
  physical_scope: string | null;
  system_date: string | null;
  organization_context: string | null;
  processes_description: string | null;
  training_details: string | null;
  internal_audit_date: string | null;
  management_review_date: string | null;
  previous_year: number | null;
  current_year: number | null;
  sites_count: number;
  standards: IsoStandardCode[] | null;
  status: OrganizationStatus;
  readiness_percent: number;
  next_audit_date: string | null;
};

function fromDatabase(value: OrganizationRow): Organization {
  return {
    id: value.id,
    name: value.name,
    uic: value.uic,
    legalForm: value.legal_form ?? "",
    address: value.address ?? "",
    city: value.city ?? "",
    manager: value.manager ?? "",
    foundedAt: value.founded_at ?? "",
    representative: value.representative ?? "",
    contactName: value.contact_name ?? "",
    contactPhone: value.contact_phone ?? "",
    contactEmail: value.contact_email ?? "",
    employees: value.employees_count ?? 0,
    activity: value.activity ?? "",
    physicalScope: value.physical_scope ?? "",
    systemDate: value.system_date ?? "",
    organizationContext: value.organization_context ?? "",
    processesDescription: value.processes_description ?? "",
    trainingDetails: value.training_details ?? "",
    internalAuditDate: value.internal_audit_date ?? "",
    managementReviewDate: value.management_review_date ?? "",
    previousYear: value.previous_year ?? undefined,
    currentYear: value.current_year ?? undefined,
    sites: value.sites_count ?? 1,
    standards: value.standards ?? [],
    status: value.status,
    readiness: value.readiness_percent ?? 0,
    nextAuditDate: value.next_audit_date ?? ""
  };
}

function toDatabase(value: Organization, ownerId: string) {
  return {
    id: value.id,
    owner_id: ownerId,
    name: value.name.trim(),
    uic: value.uic.trim(),
    legal_form: value.legalForm?.trim() || null,
    address: value.address.trim() || null,
    city: value.city?.trim() || null,
    manager: value.manager.trim() || null,
    founded_at: value.foundedAt || null,
    representative: value.representative?.trim() || null,
    contact_name: value.contactName?.trim() || null,
    contact_phone: value.contactPhone?.trim() || null,
    contact_email: value.contactEmail.trim() || null,
    employees_count: value.employees,
    activity: value.activity.trim() || null,
    physical_scope: value.physicalScope?.trim() || null,
    system_date: value.systemDate || null,
    organization_context: value.organizationContext?.trim() || null,
    processes_description: value.processesDescription?.trim() || null,
    training_details: value.trainingDetails?.trim() || null,
    internal_audit_date: value.internalAuditDate || null,
    management_review_date: value.managementReviewDate || null,
    previous_year: value.previousYear ?? null,
    current_year: value.currentYear ?? null,
    sites_count: value.sites,
    standards: value.standards,
    status: value.status,
    readiness_percent: value.readiness,
    next_audit_date: value.nextAuditDate || null
  };
}

type CertificateRow = {
  id: string;
  organization_id: string;
  standard: IsoStandardCode;
  certificate_number: string | null;
  certification_body: string | null;
  issued_at: string | null;
  valid_until: string | null;
  next_certification_date: string | null;
  notes: string | null;
  created_at: string;
};

type HistoryRow = {
  id: string;
  organization_id: string;
  event_type: OrganizationHistoryEntry["eventType"];
  description: string;
  event_date: string;
};

function certificateFromDatabase(value: CertificateRow): OrganizationCertificate {
  return {
    id: value.id,
    organizationId: value.organization_id,
    standard: value.standard,
    certificateNumber: value.certificate_number ?? "",
    certificationBody: value.certification_body ?? "",
    issuedAt: value.issued_at ?? "",
    validUntil: value.valid_until ?? "",
    nextCertificationDate: value.next_certification_date ?? "",
    notes: value.notes ?? "",
    createdAt: value.created_at
  };
}

function certificateToDatabase(value: OrganizationCertificate) {
  return {
    id: value.id,
    organization_id: value.organizationId,
    standard: value.standard,
    certificate_number: value.certificateNumber.trim(),
    certification_body: value.certificationBody.trim() || null,
    issued_at: value.issuedAt || null,
    valid_until: value.validUntil || null,
    next_certification_date: value.nextCertificationDate || null,
    notes: value.notes.trim() || null,
    created_at: value.createdAt
  };
}

function historyFromDatabase(value: HistoryRow): OrganizationHistoryEntry {
  return { id: value.id, organizationId: value.organization_id, eventType: value.event_type, description: value.description, eventDate: value.event_date };
}

function formatDate(value: string) {
  if (!value) return "Не е зададена";
  return new Intl.DateTimeFormat("bg-BG").format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function nextCertificationFor(organizationId: string, certificates: OrganizationCertificate[]) {
  const dates = certificates.filter((item) => item.organizationId === organizationId && item.nextCertificationDate).map((item) => item.nextCertificationDate).sort();
  return dates[0] ? formatDate(dates[0]) : "Не е зададена";
}

function certificateStatus(validUntil: string) {
  if (!validUntil) return { label: "Без срок", tone: "text-slate-500" };
  const expired = new Date(`${validUntil}T23:59:59`) < new Date();
  return expired ? { label: "Изтекъл", tone: "text-red-700" } : { label: "Активен", tone: "text-emerald-700" };
}

function countByOrganization(ids: Array<string | undefined>) {
  return ids.reduce<Record<string, number>>((counts, id) => {
    if (id) counts[id] = (counts[id] ?? 0) + 1;
    return counts;
  }, {});
}

function LoadingState() {
  return <div className="grid min-h-[55vh] place-items-center"><div className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-5 w-5 animate-spin text-action" />Свързване със Supabase...</div></div>;
}

function LoginPanel({ supabase }: { supabase: SupabaseClient }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError("Невалиден имейл или парола.");
  }

  return <div className="grid min-h-[70vh] place-items-center py-8">
    <form className="w-full max-w-md rounded border border-line bg-white p-6 shadow-soft" onSubmit={signIn}>
      <div className="mb-6 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded bg-brand text-white"><LogIn className="h-5 w-5" /></span><div><h2 className="font-semibold text-ink">Вход в ISO платформата</h2><p className="text-sm text-slate-500">Достъп само за администратора</p></div></div>
      <div className="grid gap-4"><Field label="Имейл"><input autoComplete="email" autoFocus required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field><Field label="Парола"><input autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field></div>
      {error ? <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <button className="focus-ring mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-action px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={loading} type="submit">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}Вход</button>
      <p className="mt-4 text-xs leading-5 text-slate-500">Акаунтът се създава предварително в Supabase Authentication. В приложението няма публична регистрация.</p>
    </form>
  </div>;
}
