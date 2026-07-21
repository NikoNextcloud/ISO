"use client";

import { cloneElement, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Archive, Download, FileArchive, FolderTree, Loader2, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Organization, OrganizationHistoryEntry } from "@/lib/types";

type ExportForm = {
  companyName: string; uic: string; address: string; manager: string; representative: string;
  contactName: string; email: string; phone: string; employees: number; activity: string;
  scope: string; effectiveDate: string; version: string;
};

type OrganizationRow = {
  id: string; name: string; uic: string; address: string | null; manager: string | null; representative: string | null;
  contact_name: string | null; contact_phone: string | null; contact_email: string | null; employees_count: number;
  activity: string | null;
};

const emptyForm: ExportForm = {
  companyName: "", uic: "", address: "", manager: "", representative: "", contactName: "", email: "", phone: "",
  employees: 0, activity: "", scope: "", effectiveDate: new Date().toISOString().slice(0, 10), version: "1"
};

export function Iso27001ExportWorkspace() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(!supabase);
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<ExportForm>(emptyForm);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (supabase) return;
    const saved = window.localStorage.getItem("iso-certification-organizations-v2") ?? window.localStorage.getItem("ims-ai-organizations-v1");
    if (!saved) return;
    try {
      const local = JSON.parse(saved) as Organization[];
      setOrganizations(local.map((item) => ({ id: item.id, name: item.name, uic: item.uic, address: item.address, manager: item.manager, representative: item.representative ?? item.manager, contact_name: item.contactName ?? "", contact_phone: item.contactPhone ?? "", contact_email: item.contactEmail, employees_count: item.employees, activity: item.activity })));
    } catch { /* The export form can still be filled manually. */ }
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setAuthChecked(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) { if (supabase) setLoading(false); return; }
    setLoading(true);
    supabase.from("organizations").select("id,name,uic,address,manager,representative,contact_name,contact_phone,contact_email,employees_count,activity").order("name").then(({ data, error }) => {
      if (error) setError(`Неуспешно зареждане на фирмите: ${error.message}`);
      else setOrganizations(data ?? []);
      setLoading(false);
    });
  }, [supabase, user]);

  function selectOrganization(id: string) {
    setSelectedId(id);
    const organization = organizations.find((item) => item.id === id);
    if (!organization) return;
    setForm((current) => ({ ...current,
      companyName: organization.name, uic: organization.uic, address: organization.address ?? "", manager: organization.manager ?? "",
      representative: organization.representative ?? organization.manager ?? "", contactName: organization.contact_name ?? "",
      email: organization.contact_email ?? "", phone: organization.contact_phone ?? "", employees: organization.employees_count ?? 0,
      activity: organization.activity ?? "", scope: organization.activity ?? ""
    }));
  }

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setGenerating(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      const response = await fetch("/api/iso27001/export", { method: "POST", headers, body: JSON.stringify(form) });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "Генерирането не беше успешно.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const encodedName = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
      const filename = encodedName ? decodeURIComponent(encodedName) : `ISO-27001-${form.companyName}.zip`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      URL.revokeObjectURL(url);
      if (selectedId) await recordExportHistory();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Генерирането не беше успешно."); }
    finally { setGenerating(false); }
  }

  async function recordExportHistory() {
    const eventDate = new Date().toISOString();
    const description = `Генерирана е пълна ISO 27001 система, версия ${form.version}, с дата на влизане в сила ${formatDate(form.effectiveDate)}.`;
    const entry: OrganizationHistoryEntry = { id: makeId(), organizationId: selectedId, eventType: "system_exported", description, eventDate };
    if (supabase && user) {
      const { error } = await supabase.from("organization_history").insert({ id: entry.id, organization_id: selectedId, user_id: user.id, event_type: entry.eventType, description, event_date: eventDate });
      if (!error) window.dispatchEvent(new CustomEvent("iso-history-added", { detail: entry }));
      return;
    }
    const key = "iso-certification-history-v1";
    try {
      const current = JSON.parse(window.localStorage.getItem(key) ?? "[]") as OrganizationHistoryEntry[];
      current.unshift(entry);
      window.localStorage.setItem(key, JSON.stringify(current));
      window.dispatchEvent(new CustomEvent("iso-history-added", { detail: entry }));
    } catch { /* The ZIP was generated successfully even if local history is unavailable. */ }
  }

  const blocked = Boolean(supabase && authChecked && !user);

  return <div id="iso27001-system"><div className="mb-4"><h3 className="text-base font-semibold text-ink">ISO 27001 система</h3><p className="mt-1 text-sm text-slate-500">Генерирайте пълен комплект документация за избраната фирма с едно действие.</p></div>
    {blocked ? <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Влезте в приложението, за да генерирате защитения комплект документи.</div> : <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
      <form className="rounded border border-line bg-white shadow-soft" onSubmit={generate}>
        <div className="border-b border-line px-5 py-4"><h3 className="text-sm font-semibold text-ink">Данни за организацията</h3><p className="mt-1 text-xs text-slate-500">Изберете съществуваща фирма или попълнете данните ръчно.</p></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2">Фирма от регистъра<select className="focus-ring h-10 rounded border border-line bg-white px-3 text-sm font-normal outline-none" disabled={loading} onChange={(event) => selectOrganization(event.target.value)} value={selectedId}><option value="">Ръчно попълване</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} · ЕИК {organization.uic}</option>)}</select></label>
          <ExportField label="Име на фирмата *"><input required value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></ExportField>
          <ExportField label="ЕИК *"><input required value={form.uic} onChange={(event) => setForm({ ...form, uic: event.target.value })} /></ExportField>
          <ExportField label="Адрес"><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></ExportField>
          <ExportField label="Управител"><input value={form.manager} onChange={(event) => setForm({ ...form, manager: event.target.value })} /></ExportField>
          <ExportField label="Представител на ръководството"><input value={form.representative} onChange={(event) => setForm({ ...form, representative: event.target.value })} /></ExportField>
          <ExportField label="Лице за контакт"><input value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} /></ExportField>
          <ExportField label="Имейл"><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></ExportField>
          <ExportField label="Телефон"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></ExportField>
          <ExportField label="Брой служители"><input min="0" type="number" value={form.employees} onChange={(event) => setForm({ ...form, employees: Number(event.target.value) })} /></ExportField>
          <ExportField label="Дата на влизане в сила"><input required type="date" value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} /></ExportField>
          <ExportField label="Версия"><input required value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} /></ExportField>
          <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2">Основна дейност<textarea className="focus-ring min-h-24 rounded border border-line bg-white p-3 text-sm font-normal outline-none" value={form.activity} onChange={(event) => setForm({ ...form, activity: event.target.value })} /></label>
          <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2">Обхват на СУСИ<textarea className="focus-ring min-h-24 rounded border border-line bg-white p-3 text-sm font-normal outline-none" placeholder="Например: предоставяне на ИТ услуги, разработка и поддръжка на софтуер..." value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} /></label>
          {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p> : null}
        </div>
        <div className="flex justify-end border-t border-line px-5 py-4"><button className="focus-ring inline-flex items-center gap-2 rounded bg-action px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={generating || loading} type="submit">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{generating ? "Генериране на 84 файла..." : "Генерирай ZIP система"}</button></div>
      </form>

      <aside className="h-fit rounded border border-line bg-white p-4 shadow-soft"><div className="mb-4 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded bg-sky-50 text-action"><FileArchive className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold text-ink">Комплект ISO 27001</h3><p className="text-xs text-slate-500">ISO/IEC 27001:2022</p></div></div><div className="space-y-3 text-sm text-slate-600"><p className="flex items-center gap-2"><FolderTree className="h-4 w-4 text-slate-400" />Оригинална папкова структура</p><p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-slate-400" />Наръчник и 12 приложения</p><p className="flex items-center gap-2"><Archive className="h-4 w-4 text-slate-400" />Политики, процедури и записи</p></div><div className="mt-4 border-t border-line pt-4"><p className="text-2xl font-semibold text-ink">84</p><p className="text-xs text-slate-500">файла в един ZIP архив</p></div><p className="mt-4 text-xs leading-5 text-slate-500">Архивът се записва в папката за изтегляния на браузъра. Старият `.doc` файл с организационната схема се включва непроменен.</p></aside>
    </div>}
  </div>;
}

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `history-${Date.now()}`;
}

function formatDate(value: string) {
  return value ? new Intl.DateTimeFormat("bg-BG").format(new Date(`${value}T00:00:00`)) : "не е зададена";
}

function ExportField({ label, children }: { label: string; children: React.ReactElement<{ className?: string }> }) {
  return <label className="grid gap-1.5 text-sm font-medium text-ink">{label}{cloneElement(children, { className: `focus-ring h-10 rounded border border-line bg-white px-3 text-sm font-normal outline-none ${children.props.className ?? ""}` })}</label>;
}
