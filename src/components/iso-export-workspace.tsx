"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AlertTriangle, Archive, CheckCircle2, Download, Eye, FileArchive, FolderTree, ImagePlus, Info, Loader2, ShieldCheck, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { storageErrorMessage } from "@/lib/storage-errors";
import type { Organization, OrganizationHistoryEntry } from "@/lib/types";
import { AiVisualStudio, type AiGeneratedVisual, type AiVisualTarget } from "@/components/ai-visual-studio";

export type ExportFieldKey =
  | "companyName" | "uic" | "legalForm" | "address" | "city" | "manager" | "foundedAt" | "representative"
  | "contactName" | "email" | "phone" | "employees" | "activity"
  | "scope" | "physicalScope" | "systemDate" | "organizationContext" | "processesDescription"
  | "trainingDetails" | "internalAuditDate" | "managementReviewDate" | "previousYear" | "currentYear"
  | "effectiveDate" | "version" | "preparedBy" | "teamMember1" | "teamMember2";

export type ExportFieldSpec = { key: ExportFieldKey; required?: boolean; hint?: string };

const FIELD_META: Record<ExportFieldKey, { label: string; type: "text" | "email" | "number" | "date" | "textarea"; fullWidth?: boolean }> = {
  companyName: { label: "Име на фирмата", type: "text", fullWidth: true },
  uic: { label: "ЕИК", type: "text" },
  legalForm: { label: "Правна форма", type: "text" },
  address: { label: "Седалище/адрес", type: "text" },
  city: { label: "Град", type: "text" },
  manager: { label: "Управител", type: "text" },
  foundedAt: { label: "Дата на създаване на фирмата", type: "date" },
  representative: { label: "Представител на ръководството", type: "text" },
  preparedBy: { label: "Изготвил/Отговорник", type: "text" },
  teamMember1: { label: "Член на енергийния екип 1", type: "text" },
  teamMember2: { label: "Член на енергийния екип 2", type: "text" },
  contactName: { label: "Лице за контакт", type: "text" },
  email: { label: "Имейл", type: "email" },
  phone: { label: "Телефон", type: "text" },
  employees: { label: "Брой служители", type: "number" },
  effectiveDate: { label: "Дата на влизане в сила", type: "date" },
  version: { label: "Версия", type: "text" },
  activity: { label: "Обхват на дейност", type: "textarea", fullWidth: true },
  scope: { label: "Обхват", type: "textarea", fullWidth: true },
  physicalScope: { label: "Физически обхват", type: "textarea", fullWidth: true },
  systemDate: { label: "Дата на системата", type: "date" },
  organizationContext: { label: "Контекст на организацията", type: "textarea", fullWidth: true },
  processesDescription: { label: "Процеси", type: "textarea", fullWidth: true },
  trainingDetails: { label: "Обучения", type: "textarea", fullWidth: true },
  internalAuditDate: { label: "Вътрешен одит", type: "date" },
  managementReviewDate: { label: "Преглед от ръководството", type: "date" },
  previousYear: { label: "Предходна година", type: "number" },
  currentYear: { label: "Настояща година", type: "number" }
};

export type IsoExportWorkspaceConfig = {
  code: "ISO 9001" | "ISO 14001" | "ISO 27001" | "ISO 45001" | "ISO 50001" | "ISO 9-20-27" | "ISO 9-14" | "ISO 9001-14001-45001";
  edition: string;
  apiPath: string;
  templateCount: number;
  title: string;
  description: string;
  scopeLabel: string;
  scopePlaceholder: string;
  logoAspect?: number;
  contents: string[];
  fields: ExportFieldSpec[];
  visualTargets?: AiVisualTarget[];
};

type ExportForm = {
  companyName: string; uic: string; legalForm: string; address: string; city: string; manager: string; foundedAt: string; representative: string;
  contactName: string; email: string; phone: string; employees: number | ""; activity: string;
  scope: string; physicalScope: string; systemDate: string; organizationContext: string; processesDescription: string;
  trainingDetails: string; internalAuditDate: string; managementReviewDate: string; previousYear: number | "";
  currentYear: number | ""; effectiveDate: string; version: string; preparedBy: string; teamMember1: string; teamMember2: string;
};

type OrganizationRow = {
  id: string; name: string; uic: string; legal_form: string | null; address: string | null; city: string | null;
  manager: string | null; founded_at: string | null; representative: string | null;
  contact_name: string | null; contact_phone: string | null; contact_email: string | null; employees_count: number;
  activity: string | null; physical_scope: string | null; system_date: string | null; organization_context: string | null;
  processes_description: string | null; training_details: string | null; internal_audit_date: string | null;
  management_review_date: string | null; previous_year: number | null; current_year: number | null;
};

type ExportReport = {
  standard: string; companyName: string; totalFiles: number; changedFiles: number; unchangedFiles: number;
  wordFiles: number; spreadsheetFiles: number; legacyFiles: number; textReplacements: number;
  logoReplacements: number; imageReplacements: number; renamedPaths: number; appliedFields: string[]; warnings: string[];
};

type GeneratedArchive = { url: string; filename: string; blob: Blob };

const emptyForm: ExportForm = {
  companyName: "", uic: "", legalForm: "", address: "", city: "", manager: "", foundedAt: "", representative: "",
  contactName: "", email: "", phone: "", employees: "", activity: "", scope: "", physicalScope: "", systemDate: "",
  organizationContext: "", processesDescription: "", trainingDetails: "", internalAuditDate: "",
  managementReviewDate: "", previousYear: "", currentYear: "", effectiveDate: "", version: "", preparedBy: "",
  teamMember1: "", teamMember2: ""
};

export function IsoExportWorkspace({ config }: { config: IsoExportWorkspaceConfig }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(!supabase);
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<ExportForm>(emptyForm);
  const [logoPngDataUrl, setLogoPngDataUrl] = useState("");
  const [logoName, setLogoName] = useState("");
  const [aiVisuals, setAiVisuals] = useState<AiGeneratedVisual[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ExportReport | null>(null);
  const [generatedArchive, setGeneratedArchive] = useState<GeneratedArchive | null>(null);
  const [error, setError] = useState("");

  useEffect(() => () => { if (generatedArchive?.url) URL.revokeObjectURL(generatedArchive.url); }, [generatedArchive?.url]);

  useEffect(() => {
    if (supabase) return;
    const saved = window.localStorage.getItem("iso-certification-organizations-v2") ?? window.localStorage.getItem("ims-ai-organizations-v1");
    if (!saved) return;
    try {
      const local = JSON.parse(saved) as Organization[];
      setOrganizations(local.map((item) => ({
        id: item.id, name: item.name, uic: item.uic, legal_form: item.legalForm ?? "", address: item.address,
        city: item.city ?? "", manager: item.manager, founded_at: item.foundedAt ?? "",
        representative: item.representative ?? item.manager, contact_name: item.contactName ?? "",
        contact_phone: item.contactPhone ?? "", contact_email: item.contactEmail, employees_count: item.employees,
        activity: item.activity, physical_scope: item.physicalScope ?? "", system_date: item.systemDate ?? "",
        organization_context: item.organizationContext ?? "", processes_description: item.processesDescription ?? "",
        training_details: item.trainingDetails ?? "", internal_audit_date: item.internalAuditDate ?? "",
        management_review_date: item.managementReviewDate ?? "", previous_year: item.previousYear ?? null,
        current_year: item.currentYear ?? null
      })));
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
    supabase.from("organizations").select("id,name,uic,legal_form,address,city,manager,founded_at,representative,contact_name,contact_phone,contact_email,employees_count,activity,physical_scope,system_date,organization_context,processes_description,training_details,internal_audit_date,management_review_date,previous_year,current_year").order("name").then(({ data, error: loadError }) => {
      if (loadError) setError(`Неуспешно зареждане на фирмите: ${loadError.message}. Проверете дали миграция 012 е изпълнена в Supabase.`);
      else setOrganizations(data ?? []);
      setLoading(false);
    });
  }, [supabase, user]);

  function selectOrganization(id: string) {
    setSelectedId(id);
    const organization = organizations.find((item) => item.id === id);
    if (!organization) return;
    setForm((current) => ({ ...current,
      companyName: organization.name, uic: organization.uic, legalForm: organization.legal_form ?? "",
      address: organization.address ?? "", city: organization.city ?? "", manager: organization.manager ?? "",
      foundedAt: organization.founded_at ?? "",
      representative: organization.representative ?? organization.manager ?? "", contactName: organization.contact_name ?? "",
      email: organization.contact_email ?? "", phone: organization.contact_phone ?? "", employees: organization.employees_count ?? "",
      activity: organization.activity ?? "", scope: organization.activity ?? "", physicalScope: organization.physical_scope ?? "",
      systemDate: organization.system_date ?? "", organizationContext: organization.organization_context ?? "",
      processesDescription: organization.processes_description ?? "", trainingDetails: organization.training_details ?? "",
      internalAuditDate: organization.internal_audit_date ?? "", managementReviewDate: organization.management_review_date ?? "",
      previousYear: organization.previous_year ?? "", currentYear: organization.current_year ?? "",
      effectiveDate: organization.system_date ?? "", preparedBy: "", teamMember1: "", teamMember2: ""
    }));
  }

  async function chooseLogo(file?: File) {
    if (!file) return;
    setError("");
    try {
      if (file.size > 8_000_000) throw new Error("Логото е твърде голямо. Изберете изображение до 8 MB.");
      setLogoPngDataUrl(await prepareLogo(file, config.logoAspect ?? 1));
      setLogoName(file.name);
    } catch (reason) {
      setLogoPngDataUrl(""); setLogoName("");
      setError(reason instanceof Error ? reason.message : "Логото не беше заредено.");
    }
  }

  function validateForm() {
    const missing = config.fields.filter((spec) => spec.required && String(form[spec.key] ?? "").trim() === "");
    if (missing.length) {
      setError(`Попълнете задължителните полета: ${missing.map((spec) => fieldLabel(spec.key)).join(", ")}.`);
      return false;
    }
    return true;
  }

  function exportPayload() {
    return { ...form, code: config.code, logoPngDataUrl, aiVisuals: aiVisuals.map((visual) => ({ title: visual.title, type: visual.type, pngDataUrl: visual.pngDataUrl, targetHash: visual.targetHash })) };
  }

  async function requestHeaders() {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    }
    return headers;
  }

  async function preview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setGeneratedArchive(null);
    if (!validateForm()) return;
    setPreviewing(true);
    try {
      const response = await fetch("/api/iso/preview", { method: "POST", headers: await requestHeaders(), body: JSON.stringify(exportPayload()) });
      const payload = await response.json().catch(() => null) as { report?: ExportReport; error?: string } | null;
      if (!response.ok || !payload?.report) throw new Error(payload?.error ?? "Предварителната проверка не беше успешна.");
      setReport(payload.report);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Предварителната проверка не беше успешна."); }
    finally { setPreviewing(false); }
  }

  async function generate() {
    setError("");
    if (!validateForm()) return;
    setGenerating(true);
    try {
      const response = await fetch(config.apiPath, {
        method: "POST",
        headers: await requestHeaders(),
        body: JSON.stringify(exportPayload())
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "Генерирането не беше успешно.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const encodedName = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
      const filename = encodedName ? decodeURIComponent(encodedName) : `${config.code.replace(" ", "-")}-${form.companyName}.zip`;
      const url = URL.createObjectURL(blob);
      setGeneratedArchive({ url, filename, blob });
      setReport((current) => ({
        standard: config.code, companyName: form.companyName,
        totalFiles: Number(response.headers.get("x-document-count") ?? current?.totalFiles ?? 0),
        changedFiles: Number(response.headers.get("x-changed-files") ?? current?.changedFiles ?? 0),
        unchangedFiles: Number(response.headers.get("x-unchanged-files") ?? current?.unchangedFiles ?? 0),
        wordFiles: current?.wordFiles ?? 0, spreadsheetFiles: current?.spreadsheetFiles ?? 0,
        legacyFiles: Number(response.headers.get("x-legacy-files") ?? current?.legacyFiles ?? 0),
        textReplacements: Number(response.headers.get("x-text-replacements") ?? current?.textReplacements ?? 0),
        logoReplacements: Number(response.headers.get("x-logo-replacements") ?? current?.logoReplacements ?? 0),
        imageReplacements: Number(response.headers.get("x-image-replacements") ?? current?.imageReplacements ?? 0),
        renamedPaths: current?.renamedPaths ?? 0, appliedFields: current?.appliedFields ?? [],
        warnings: decodeURIComponent(response.headers.get("x-report-warnings") ?? "").split(" | ").filter(Boolean)
      }));
      if (selectedId) {
        try { await recordExportHistory(blob, filename); }
        catch (historyError) { setError(historyError instanceof Error ? historyError.message : "ZIP файлът е готов, но не беше записан в историята."); }
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Генерирането не беше успешно."); }
    finally { setGenerating(false); }
  }

  async function recordExportHistory(blob: Blob, filename: string) {
    const eventDate = new Date().toISOString();
    const details = [form.version ? `версия ${form.version}` : "", form.effectiveDate ? `дата на влизане в сила ${formatDate(form.effectiveDate)}` : "", logoPngDataUrl ? "с фирмено лого" : "", aiVisuals.length ? `${aiVisuals.length} AI визуализации` : ""].filter(Boolean);
    const description = `Генерирана е пълна ${config.code} система${details.length ? `, ${details.join(", ")}` : ""}.`;
    const entry: OrganizationHistoryEntry = { id: makeId(), organizationId: selectedId, eventType: "system_exported", description, eventDate, fileName: filename, fileSize: blob.size };
    if (supabase && user) {
      const filePath = `${selectedId}/systems/${Date.now()}-${safeFileName(filename)}`;
      const upload = await supabase.storage.from("organization-files").upload(filePath, blob, { contentType: "application/zip", upsert: false });
      if (upload.error) throw new Error(`ZIP файлът е изтеглен, но не беше запазен в историята: ${storageErrorMessage(upload.error.message)}`);
      entry.filePath = filePath;
      const { error: historyError } = await supabase.from("organization_history").insert({ id: entry.id, organization_id: selectedId, user_id: user.id, event_type: entry.eventType, description, event_date: eventDate, file_path: filePath, file_name: filename, file_size: blob.size });
      if (historyError) throw new Error(`ZIP файлът е качен, но историята не беше записана: ${historyError.message}`);
      window.dispatchEvent(new CustomEvent("iso-history-added", { detail: entry }));
      return;
    }
    const key = "iso-certification-history-v1";
    try {
      const current = JSON.parse(window.localStorage.getItem(key) ?? "[]") as OrganizationHistoryEntry[];
      current.unshift(entry); window.localStorage.setItem(key, JSON.stringify(current));
      window.dispatchEvent(new CustomEvent("iso-history-added", { detail: entry }));
    } catch { /* The ZIP was generated successfully even if local history is unavailable. */ }
  }

  const blocked = Boolean(supabase && authChecked && !user);
  const id = config.code.toLowerCase().replace(" ", "");
  const requiredFields = config.fields.filter((spec) => spec.required).map((spec) => fieldLabel(spec.key));
  const optionalFields = config.fields.filter((spec) => !spec.required).map((spec) => fieldLabel(spec.key));

  function fieldLabel(key: ExportFieldKey) {
    return key === "scope" ? config.scopeLabel : FIELD_META[key].label;
  }

  function renderField(spec: ExportFieldSpec) {
    const meta = FIELD_META[spec.key];
    const fullWidth = meta.fullWidth ? " sm:col-span-2" : "";
    const labelNode = <span>{fieldLabel(spec.key)}{spec.required ? <span className="text-red-600"> *</span> : null}{spec.hint ? <span className="ml-1 text-xs font-normal text-slate-400">· {spec.hint}</span> : null}</span>;
    const baseInput = "focus-ring h-10 rounded border border-line bg-white px-3 text-sm font-normal outline-none";
    if (meta.type === "textarea") {
      return <label className={`grid gap-1.5 text-sm font-medium text-ink${fullWidth}`} key={spec.key}>{labelNode}<textarea className="focus-ring min-h-24 rounded border border-line bg-white p-3 text-sm font-normal outline-none" placeholder={spec.key === "scope" ? config.scopePlaceholder : undefined} required={spec.required} value={form[spec.key] as string} onChange={(event) => setForm({ ...form, [spec.key]: event.target.value })} /></label>;
    }
    if (spec.key === "employees") {
      return <label className={`grid gap-1.5 text-sm font-medium text-ink${fullWidth}`} key={spec.key}>{labelNode}<input className={baseInput} min="0" required={spec.required} type="number" value={form.employees} onChange={(event) => setForm({ ...form, employees: event.target.value === "" ? "" : Number(event.target.value) })} /></label>;
    }
    return <label className={`grid gap-1.5 text-sm font-medium text-ink${fullWidth}`} key={spec.key}>{labelNode}<input className={baseInput} required={spec.required} type={meta.type} value={form[spec.key] as string} onChange={(event) => setForm({ ...form, [spec.key]: event.target.value })} /></label>;
  }

  return <div id={`${id}-system`}><div className="mb-4"><h3 className="text-base font-semibold text-ink">{config.title}</h3><p className="mt-1 text-sm text-slate-500">{config.description}</p></div>
    {blocked ? <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Влезте в приложението, за да генерирате защитения комплект документи.</div> : <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
      <form className="rounded-lg border border-line bg-white shadow-soft" onSubmit={preview}>
        <div className="border-b border-line px-5 py-4"><h3 className="text-sm font-semibold text-ink">Данни за организацията</h3><p className="mt-1 text-xs text-slate-500">Изберете съществуваща фирма или попълнете данните ръчно.</p></div>
        <div className="flex gap-3 border-b border-blue-100 bg-blue-50 px-5 py-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
          <div className="min-w-0 space-y-1 text-slate-700">
            <p className="font-semibold text-ink">Какво да попълните за {config.code}</p>
            <p><span className="font-semibold">Задължителни:</span> {requiredFields.join(", ")}</p>
            <p><span className="font-semibold">По избор:</span> {optionalFields.length ? optionalFields.join(", ") : "няма"}</p>
            <p className="text-xs text-slate-500">Непопълнените полета не променят оригиналното съдържание в документите.</p>
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2">Фирма от регистъра<select className="focus-ring h-10 rounded border border-line bg-white px-3 text-sm font-normal outline-none" disabled={loading} onChange={(event) => selectOrganization(event.target.value)} value={selectedId}><option value="">Ръчно попълване</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} · ЕИК {organization.uic}</option>)}</select></label>
          {config.fields.map((spec) => renderField(spec))}
          {config.logoAspect ? <div className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2"><span>Фирмено лого</span><div className="flex min-h-20 items-center gap-3 rounded border border-dashed border-slate-300 bg-slate-50 p-3">{logoPngDataUrl ? <img alt="Фирмено лого" className="h-14 w-24 object-contain" src={logoPngDataUrl} /> : <span className="grid h-14 w-24 place-items-center rounded bg-white text-slate-400"><ImagePlus className="h-5 w-5" /></span>}<div className="min-w-0 flex-1"><label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"><ImagePlus className="h-4 w-4" />{logoName ? "Смени логото" : "Качи лого"}<input accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void chooseLogo(event.target.files?.[0])} type="file" /></label><p className="mt-1 truncate text-xs font-normal text-slate-500">{logoName || "PNG, JPG или WebP · до 8 MB"}</p></div>{logoPngDataUrl ? <button aria-label="Премахни логото" className="focus-ring grid h-8 w-8 place-items-center rounded text-slate-500 hover:bg-white hover:text-red-600" onClick={() => { setLogoPngDataUrl(""); setLogoName(""); }} title="Премахни логото" type="button"><X className="h-4 w-4" /></button> : null}</div></div> : null}
          <AiVisualStudio companyName={form.companyName} onChange={setAiVisuals} standard={config.code} targets={config.visualTargets} value={aiVisuals} />
          {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p> : null}
        </div>
        <div className="flex justify-end border-t border-line px-5 py-4"><button className="focus-ring inline-flex items-center gap-2 rounded bg-action px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={previewing || generating || loading} type="submit">{previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}{previewing ? `Проверка на ${config.templateCount} файла...` : "Преглед и проверка"}</button></div>
      </form>

      <aside className="h-fit rounded border border-line bg-white p-4 shadow-soft"><div className="mb-4 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded bg-sky-50 text-action"><FileArchive className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold text-ink">Комплект {config.code}</h3><p className="text-xs text-slate-500">{config.edition}</p></div></div><div className="space-y-3 text-sm text-slate-600">{config.contents.map((item, index) => <p className="flex items-center gap-2" key={item}>{index === 0 ? <FolderTree className="h-4 w-4 text-slate-400" /> : index === 1 ? <ShieldCheck className="h-4 w-4 text-slate-400" /> : <Archive className="h-4 w-4 text-slate-400" />}{item}</p>)}</div><div className="mt-4 border-t border-line pt-4"><p className="text-2xl font-semibold text-ink">{config.templateCount}</p><p className="text-xs text-slate-500">редактируеми файла в един ZIP архив</p></div><p className="mt-4 text-xs leading-5 text-slate-500">ZIP архивът се изтегля и се пази в „Генерирани системи“ за избраната фирма.{config.logoAspect ? " Каченото лого заменя фирменото лого в приложимите Word шаблони." : ""}</p></aside>
    </div>}
    {report ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true"><div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg border border-line bg-white shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4"><div><p className="text-xs font-semibold uppercase text-action">{generatedArchive ? "Готов ZIP архив" : "Предварителен преглед"}</p><h3 className="mt-1 text-lg font-semibold text-ink">Проверка на {report.standard} за {report.companyName}</h3></div><button aria-label="Затвори" className="focus-ring grid h-9 w-9 place-items-center rounded hover:bg-panel" onClick={() => { setReport(null); setGeneratedArchive(null); }} type="button"><X className="h-5 w-5" /></button></div><div className="space-y-5 p-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><ReportMetric label="Общо файлове" value={report.totalFiles} /><ReportMetric label="Ще се променят" value={report.changedFiles} good /><ReportMetric label="Текстови замени" value={report.textReplacements} /><ReportMetric label="Непроменени" value={report.unchangedFiles} /></div><div className="grid gap-3 rounded border border-line bg-panel p-4 text-sm sm:grid-cols-2"><p>Word файлове: <strong>{report.wordFiles}</strong></p><p>Excel файлове: <strong>{report.spreadsheetFiles}</strong></p><p>Сменени лога: <strong>{report.logoReplacements}</strong></p><p>Сменени AI изображения: <strong>{report.imageReplacements}</strong></p><p>Преименувани заглавия: <strong>{report.renamedPaths}</strong></p><p>Стари DOC/XLS: <strong>{report.legacyFiles}</strong></p></div><div><p className="text-sm font-semibold text-ink">Данни, които ще бъдат приложени</p><div className="mt-2 flex flex-wrap gap-2">{report.appliedFields.map((field) => <span className="rounded border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800" key={field}>{field}</span>)}</div></div>{report.warnings.length ? <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Предупреждения</p>{report.warnings.map((warning) => <p key={warning}>• {warning}</p>)}</div> : <p className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"><CheckCircle2 className="h-4 w-4" />Проверката не откри проблеми.</p>}</div><div className="flex flex-wrap justify-end gap-3 border-t border-line px-5 py-4"><button className="focus-ring rounded border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink" onClick={() => { setReport(null); setGeneratedArchive(null); }} type="button">Затвори</button>{generatedArchive ? <a className="focus-ring inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700" download={generatedArchive.filename} href={generatedArchive.url}><Download className="h-4 w-4" />Свали проверения ZIP</a> : <button className="focus-ring inline-flex items-center gap-2 rounded bg-action px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60" disabled={generating} onClick={() => void generate()} type="button">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}{generating ? "Генериране..." : "Генерирай проверен ZIP"}</button>}</div></div></div> : null}
  </div>;
}

function ReportMetric({ label, value, good = false }: { label: string; value: number; good?: boolean }) {
  return <div className={`rounded border p-4 ${good ? "border-emerald-200 bg-emerald-50" : "border-line bg-white"}`}><p className="text-xs text-slate-500">{label}</p><p className={`mt-2 text-2xl font-semibold ${good ? "text-emerald-700" : "text-ink"}`}>{value}</p></div>;
}

async function prepareLogo(file: File, aspect: number) {
  const source = await fileToDataUrl(file);
  const image = await loadImage(source);
  const width = aspect > 1.5 ? 1200 : 800;
  const height = Math.round(width / aspect);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Браузърът не успя да обработи логото.");
  const padding = Math.round(Math.min(width, height) * 0.06);
  const scale = Math.min((width - padding * 2) / image.naturalWidth, (height - padding * 2) / image.naturalHeight);
  const drawWidth = Math.round(image.naturalWidth * scale); const drawHeight = Math.round(image.naturalHeight * scale);
  context.drawImage(image, Math.round((width - drawWidth) / 2), Math.round((height - drawHeight) / 2), drawWidth, drawHeight);
  return canvas.toDataURL("image/png");
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Логото не беше прочетено.")); reader.readAsDataURL(file); });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("Файлът не е валидно изображение.")); image.src = source; });
}

function makeId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `history-${Date.now()}`; }
function safeFileName(value: string) { return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 140) || "iso-system.zip"; }
function formatDate(value: string) { return value ? new Intl.DateTimeFormat("bg-BG").format(new Date(`${value}T00:00:00`)) : "не е зададена"; }
