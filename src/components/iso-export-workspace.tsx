"use client";

import { cloneElement, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Archive, Download, FileArchive, FolderTree, ImagePlus, Loader2, ShieldCheck, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { storageErrorMessage } from "@/lib/storage-errors";
import type { Organization, OrganizationHistoryEntry } from "@/lib/types";

export type IsoExportWorkspaceConfig = {
  code: "ISO 9001" | "ISO 14001" | "ISO 27001" | "ISO 45001" | "ISO 50001" | "ISO 9-20-27" | "ISO 9-14-45" | "ISO 9-14";
  edition: string;
  apiPath: string;
  templateCount: number;
  title: string;
  description: string;
  scopeLabel: string;
  scopePlaceholder: string;
  logoAspect?: number;
  contents: string[];
};

type ExportForm = {
  companyName: string; uic: string; address: string; manager: string; representative: string;
  contactName: string; email: string; phone: string; employees: number | ""; activity: string;
  scope: string; effectiveDate: string; version: string;
};

type OrganizationRow = {
  id: string; name: string; uic: string; address: string | null; manager: string | null; representative: string | null;
  contact_name: string | null; contact_phone: string | null; contact_email: string | null; employees_count: number;
  activity: string | null;
};

const emptyForm: ExportForm = {
  companyName: "", uic: "", address: "", manager: "", representative: "", contactName: "", email: "", phone: "",
  employees: "", activity: "", scope: "", effectiveDate: "", version: ""
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
    supabase.from("organizations").select("id,name,uic,address,manager,representative,contact_name,contact_phone,contact_email,employees_count,activity").order("name").then(({ data, error: loadError }) => {
      if (loadError) setError(`Неуспешно зареждане на фирмите: ${loadError.message}`);
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
      email: organization.contact_email ?? "", phone: organization.contact_phone ?? "", employees: organization.employees_count ?? "",
      activity: organization.activity ?? "", scope: organization.activity ?? ""
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

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setGenerating(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      const response = await fetch(config.apiPath, { method: "POST", headers, body: JSON.stringify({ ...form, logoPngDataUrl }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "Генерирането не беше успешно.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const encodedName = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
      const filename = encodedName ? decodeURIComponent(encodedName) : `${config.code.replace(" ", "-")}-${form.companyName}.zip`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      URL.revokeObjectURL(url);
      if (selectedId) await recordExportHistory(blob, filename);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Генерирането не беше успешно."); }
    finally { setGenerating(false); }
  }

  async function recordExportHistory(blob: Blob, filename: string) {
    const eventDate = new Date().toISOString();
    const details = [form.version ? `версия ${form.version}` : "", form.effectiveDate ? `дата на влизане в сила ${formatDate(form.effectiveDate)}` : "", logoPngDataUrl ? "с фирмено лого" : ""].filter(Boolean);
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

  return <div id={`${id}-system`}><div className="mb-4"><h3 className="text-base font-semibold text-ink">{config.title}</h3><p className="mt-1 text-sm text-slate-500">{config.description}</p></div>
    {blocked ? <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Влезте в приложението, за да генерирате защитения комплект документи.</div> : <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
      <form className="rounded-lg border border-line bg-white shadow-soft" onSubmit={generate}>
        <div className="border-b border-line px-5 py-4"><h3 className="text-sm font-semibold text-ink">Данни за организацията</h3><p className="mt-1 text-xs text-slate-500">Изберете съществуваща фирма или попълнете данните ръчно.</p></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2">Фирма от регистъра<select className="focus-ring h-10 rounded border border-line bg-white px-3 text-sm font-normal outline-none" disabled={loading} onChange={(event) => selectOrganization(event.target.value)} value={selectedId}><option value="">Ръчно попълване</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} · ЕИК {organization.uic}</option>)}</select></label>
          <ExportField label="Име на фирмата *"><input required value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></ExportField>
          <ExportField label="ЕИК"><input value={form.uic} onChange={(event) => setForm({ ...form, uic: event.target.value })} /></ExportField>
          <ExportField label="Адрес"><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></ExportField>
          <ExportField label="Управител"><input value={form.manager} onChange={(event) => setForm({ ...form, manager: event.target.value })} /></ExportField>
          <ExportField label="Представител на ръководството"><input value={form.representative} onChange={(event) => setForm({ ...form, representative: event.target.value })} /></ExportField>
          <ExportField label="Лице за контакт"><input value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} /></ExportField>
          <ExportField label="Имейл"><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></ExportField>
          <ExportField label="Телефон"><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></ExportField>
          <ExportField label="Брой служители"><input min="0" type="number" value={form.employees} onChange={(event) => setForm({ ...form, employees: event.target.value === "" ? "" : Number(event.target.value) })} /></ExportField>
          <ExportField label="Дата на влизане в сила"><input type="date" value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} /></ExportField>
          <ExportField label="Версия"><input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} /></ExportField>
          {config.logoAspect ? <div className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2"><span>Фирмено лого</span><div className="flex min-h-20 items-center gap-3 rounded border border-dashed border-slate-300 bg-slate-50 p-3">{logoPngDataUrl ? <img alt="Фирмено лого" className="h-14 w-24 object-contain" src={logoPngDataUrl} /> : <span className="grid h-14 w-24 place-items-center rounded bg-white text-slate-400"><ImagePlus className="h-5 w-5" /></span>}<div className="min-w-0 flex-1"><label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"><ImagePlus className="h-4 w-4" />{logoName ? "Смени логото" : "Качи лого"}<input accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void chooseLogo(event.target.files?.[0])} type="file" /></label><p className="mt-1 truncate text-xs font-normal text-slate-500">{logoName || "PNG, JPG или WebP · до 8 MB"}</p></div>{logoPngDataUrl ? <button aria-label="Премахни логото" className="focus-ring grid h-8 w-8 place-items-center rounded text-slate-500 hover:bg-white hover:text-red-600" onClick={() => { setLogoPngDataUrl(""); setLogoName(""); }} title="Премахни логото" type="button"><X className="h-4 w-4" /></button> : null}</div></div> : null}
          <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2">Основна дейност<textarea className="focus-ring min-h-24 rounded border border-line bg-white p-3 text-sm font-normal outline-none" value={form.activity} onChange={(event) => setForm({ ...form, activity: event.target.value })} /></label>
          <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2">{config.scopeLabel}<textarea className="focus-ring min-h-24 rounded border border-line bg-white p-3 text-sm font-normal outline-none" placeholder={config.scopePlaceholder} value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} /></label>
          {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p> : null}
        </div>
        <div className="flex justify-end border-t border-line px-5 py-4"><button className="focus-ring inline-flex items-center gap-2 rounded bg-action px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={generating || loading} type="submit">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{generating ? `Генериране на ${config.templateCount} файла...` : "Генерирай ZIP система"}</button></div>
      </form>

      <aside className="h-fit rounded border border-line bg-white p-4 shadow-soft"><div className="mb-4 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded bg-sky-50 text-action"><FileArchive className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold text-ink">Комплект {config.code}</h3><p className="text-xs text-slate-500">{config.edition}</p></div></div><div className="space-y-3 text-sm text-slate-600">{config.contents.map((item, index) => <p className="flex items-center gap-2" key={item}>{index === 0 ? <FolderTree className="h-4 w-4 text-slate-400" /> : index === 1 ? <ShieldCheck className="h-4 w-4 text-slate-400" /> : <Archive className="h-4 w-4 text-slate-400" />}{item}</p>)}</div><div className="mt-4 border-t border-line pt-4"><p className="text-2xl font-semibold text-ink">{config.templateCount}</p><p className="text-xs text-slate-500">редактируеми файла в един ZIP архив</p></div><p className="mt-4 text-xs leading-5 text-slate-500">ZIP архивът се изтегля и се пази в „Генерирани системи“ за избраната фирма.{config.logoAspect ? " Каченото лого заменя фирменото лого в приложимите Word шаблони." : ""}</p></aside>
    </div>}
  </div>;
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

function ExportField({ label, children }: { label: string; children: React.ReactElement<{ className?: string }> }) {
  return <label className="grid gap-1.5 text-sm font-medium text-ink">{label}{cloneElement(children, { className: `focus-ring h-10 rounded border border-line bg-white px-3 text-sm font-normal outline-none ${children.props.className ?? ""}` })}</label>;
}
