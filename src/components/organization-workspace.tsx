"use client";

import { cloneElement, useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, Edit3, FileText, Gauge, Plus, Search, Trash2, X } from "lucide-react";
import { Section, StandardPills, StatCard, StatusBadge } from "@/components/ui";
import type { IsoStandardCode, Organization, OrganizationStatus } from "@/lib/types";

const STORAGE_KEY = "ims-ai-organizations-v1";
const standardOptions: IsoStandardCode[] = ["ISO 9001", "ISO 14001", "ISO 45001", "ISO 27001", "ISO 50001"];
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

const emptyOrganization: Organization = { id: "", name: "", uic: "", address: "", manager: "", contactEmail: "", employees: 0, activity: "", sites: 1, standards: ["ISO 9001"], status: "draft", readiness: 0, nextAuditDate: "" };

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `org-${Date.now()}`;
}

export function OrganizationWorkspace({ activeDocuments, overdueTasks }: { activeDocuments: number; overdueTasks: number }) {
  const [organizations, setOrganizations] = useState<Organization[]>(defaultOrganizations);
  const [storageReady, setStorageReady] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Organization | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setOrganizations(JSON.parse(saved) as Organization[]); }
      catch { window.localStorage.removeItem(STORAGE_KEY); }
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (storageReady) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(organizations));
  }, [organizations, storageReady]);

  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("bg");
    if (!value) return organizations;
    return organizations.filter((organization) =>
      [organization.name, organization.uic, organization.activity, organization.manager, ...organization.standards]
        .join(" ").toLocaleLowerCase("bg").includes(value)
    );
  }, [organizations, query]);

  const readinessAverage = organizations.length ? Math.round(organizations.reduce((sum, item) => sum + item.readiness, 0) / organizations.length) : 0;

  function openNew() {
    setError("");
    setEditing({ ...emptyOrganization, id: makeId(), standards: [...emptyOrganization.standards] });
  }

  function openEdit(organization: Organization) {
    setError("");
    setEditing({ ...organization, standards: [...organization.standards] });
  }

  function saveOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    if (!editing.name.trim() || !editing.uic.trim()) return setError("Името на фирмата и ЕИК са задължителни.");
    if (!editing.standards.length) return setError("Изберете поне един ISO стандарт.");
    setOrganizations((current) => current.some((item) => item.id === editing.id)
      ? current.map((item) => item.id === editing.id ? editing : item)
      : [editing, ...current]);
    setEditing(null);
  }

  function removeOrganization(organization: Organization) {
    if (window.confirm(`Сигурни ли сте, че искате да изтриете „${organization.name}“?`)) {
      setOrganizations((current) => current.filter((item) => item.id !== organization.id));
    }
  }

  return <>
    <Section id="dashboard" title="Табло" description="Общ поглед върху клиентите, готовността и критичните действия.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Организации" value={organizations.length} />
        <StatCard icon={Gauge} label="Средна готовност" tone="success" value={`${readinessAverage}%`} />
        <StatCard icon={FileText} label="Документи за работа" value={activeDocuments} />
        <StatCard icon={CalendarClock} label="Просрочени задачи" tone="warning" value={overdueTasks} />
      </div>
      <div className="mt-5 rounded border border-line bg-white p-4 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Готовност по организации</h3>
          <button className="focus-ring inline-flex items-center gap-2 rounded bg-action px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={openNew} type="button"><Plus className="h-4 w-4" />Нов клиент</button>
        </div>
        {organizations.length ? <div className="space-y-4">{organizations.map((organization) => <div key={organization.id}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="font-medium text-ink">{organization.name}</span><span className="text-slate-500">{organization.readiness}%</span></div>
          <div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-brand" style={{ width: `${organization.readiness}%` }} /></div>
        </div>)}</div> : <p className="py-5 text-center text-sm text-slate-500">Все още няма добавени фирми.</p>}
      </div>
    </Section>

    <Section id="organizations" title="Фирми" description="Добавяйте, намирайте и редактирайте клиентските организации.">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded border border-line bg-white px-3 py-2 shadow-sm"><Search className="h-4 w-4 text-slate-400" /><input aria-label="Търсене на фирми" className="focus-ring w-full border-0 bg-transparent text-sm outline-none" onChange={(e) => setQuery(e.target.value)} placeholder="Търсене по фирма, ЕИК, дейност или стандарт" value={query} /></div>
        <button className="focus-ring inline-flex items-center justify-center gap-2 rounded bg-action px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={openNew} type="button"><Plus className="h-4 w-4" />Добави фирма</button>
      </div>

      <div className="hidden overflow-hidden rounded border border-line bg-white shadow-soft md:block">
        <div className="grid grid-cols-12 gap-3 border-b border-line bg-panel px-4 py-3 text-xs font-semibold uppercase text-slate-500"><span className="col-span-3">Фирма</span><span className="col-span-2">ЕИК</span><span className="col-span-3">Стандарти</span><span className="col-span-2">Готовност</span><span className="col-span-2 text-right">Действия</span></div>
        {filtered.map((organization) => <div className="grid grid-cols-12 items-center gap-3 border-b border-line px-4 py-4 text-sm last:border-b-0" key={organization.id}>
          <div className="col-span-3"><p className="font-medium text-ink">{organization.name}</p><p className="truncate text-xs text-slate-500">{organization.activity || "Без въведена дейност"}</p></div>
          <span className="col-span-2 text-slate-600">{organization.uic}</span><div className="col-span-3"><StandardPills standards={organization.standards} /></div>
          <div className="col-span-2"><span className="mb-1 block text-xs text-slate-600">{organization.readiness}%</span><div className="h-1.5 rounded bg-slate-100"><div className="h-1.5 rounded bg-brand" style={{ width: `${organization.readiness}%` }} /></div></div>
          <div className="col-span-2 flex justify-end gap-1"><button aria-label={`Редактиране на ${organization.name}`} className="focus-ring grid h-9 w-9 place-items-center rounded text-slate-600 hover:bg-panel hover:text-action" onClick={() => openEdit(organization)} title="Редактиране" type="button"><Edit3 className="h-4 w-4" /></button><button aria-label={`Изтриване на ${organization.name}`} className="focus-ring grid h-9 w-9 place-items-center rounded text-slate-500 hover:bg-red-50 hover:text-red-700" onClick={() => removeOrganization(organization)} title="Изтриване" type="button"><Trash2 className="h-4 w-4" /></button></div>
        </div>)}
      </div>

      <div className="grid gap-3 md:hidden">{filtered.map((organization) => <div className="rounded border border-line bg-white p-4 shadow-soft" key={organization.id}>
        <div className="flex items-start justify-between gap-3"><div><p className="font-medium text-ink">{organization.name}</p><p className="text-xs text-slate-500">ЕИК {organization.uic}</p></div><StatusBadge status={organization.status} /></div>
        <p className="mt-3 text-sm text-slate-600">{organization.activity || "Без въведена дейност"}</p><div className="mt-3"><StandardPills standards={organization.standards} /></div>
        <div className="mt-4 flex gap-2"><button className="focus-ring inline-flex flex-1 items-center justify-center gap-2 rounded border border-line px-3 py-2 text-sm" onClick={() => openEdit(organization)} type="button"><Edit3 className="h-4 w-4" />Редактирай</button><button aria-label="Изтриване" className="focus-ring grid h-10 w-10 place-items-center rounded border border-line text-red-700" onClick={() => removeOrganization(organization)} type="button"><Trash2 className="h-4 w-4" /></button></div>
      </div>)}</div>
      {!filtered.length ? <div className="rounded border border-dashed border-line bg-white py-10 text-center text-sm text-slate-500">Няма фирми, които отговарят на търсенето.</div> : null}
    </Section>

    {editing ? <div aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-5" role="dialog">
      <form className="max-h-[94vh] w-full overflow-y-auto rounded-t-lg bg-white shadow-xl sm:max-w-3xl sm:rounded-lg" onSubmit={saveOrganization}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4"><div><h2 className="text-base font-semibold text-ink">{organizations.some((item) => item.id === editing.id) ? "Редактиране на фирма" : "Нова фирма"}</h2><p className="text-xs text-slate-500">Полетата със звездичка са задължителни.</p></div><button aria-label="Затвори" className="focus-ring grid h-9 w-9 place-items-center rounded hover:bg-panel" onClick={() => setEditing(null)} type="button"><X className="h-5 w-5" /></button></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Име на фирмата *"><input autoFocus required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="ЕИК *"><input inputMode="numeric" required value={editing.uic} onChange={(e) => setEditing({ ...editing, uic: e.target.value })} /></Field>
          <Field label="Адрес"><input value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></Field>
          <Field label="Управител"><input value={editing.manager} onChange={(e) => setEditing({ ...editing, manager: e.target.value })} /></Field>
          <Field label="Имейл"><input type="email" value={editing.contactEmail} onChange={(e) => setEditing({ ...editing, contactEmail: e.target.value })} /></Field>
          <Field label="Дейност"><input value={editing.activity} onChange={(e) => setEditing({ ...editing, activity: e.target.value })} /></Field>
          <Field label="Брой служители"><input min="0" type="number" value={editing.employees} onChange={(e) => setEditing({ ...editing, employees: Number(e.target.value) })} /></Field>
          <Field label="Брой обекти"><input min="0" type="number" value={editing.sites} onChange={(e) => setEditing({ ...editing, sites: Number(e.target.value) })} /></Field>
          <Field label="Статус"><select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as OrganizationStatus })}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
          <Field label={`Готовност: ${editing.readiness}%`}><input className="accent-blue-600" max="100" min="0" type="range" value={editing.readiness} onChange={(e) => setEditing({ ...editing, readiness: Number(e.target.value) })} /></Field>
          <Field label="Следващ одит"><input type="date" value={editing.nextAuditDate} onChange={(e) => setEditing({ ...editing, nextAuditDate: e.target.value })} /></Field>
          <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-medium text-ink">ISO стандарти *</legend><div className="grid gap-2 sm:grid-cols-3">{standardOptions.map((standard) => <label className="flex cursor-pointer items-center gap-2 rounded border border-line px-3 py-2 text-sm hover:bg-panel" key={standard}><input checked={editing.standards.includes(standard)} className="h-4 w-4 accent-blue-600" onChange={(e) => setEditing({ ...editing, standards: e.target.checked ? [...editing.standards, standard] : editing.standards.filter((item) => item !== standard) })} type="checkbox" />{standard}</label>)}</div></fieldset>
          {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p> : null}
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-white px-5 py-4"><button className="focus-ring rounded border border-line px-4 py-2 text-sm font-medium hover:bg-panel" onClick={() => setEditing(null)} type="button">Отказ</button><button className="focus-ring rounded bg-action px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" type="submit">Запази фирмата</button></div>
      </form>
    </div> : null}
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactElement<{ className?: string }> }) {
  return <label className="grid gap-1.5 text-sm font-medium text-ink">{label}{cloneElement(children, { className: `focus-ring h-10 w-full rounded border border-line bg-white px-3 text-sm font-normal outline-none ${children.props.className ?? ""}` })}</label>;
}
