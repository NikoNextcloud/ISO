"use client";

import { cloneElement, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Copy, Download, Edit3, FilePlus2, FileText, Loader2, Search, Trash2, Upload, X } from "lucide-react";
import { Section, StandardPills, StatusBadge } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { storageErrorMessage } from "@/lib/storage-errors";
import type { DocumentStatus, ImsDocument, IsoStandardCode, Organization } from "@/lib/types";

const DOCUMENTS_KEY = "iso-certification-documents-v1";
const ORGANIZATIONS_KEY = "iso-certification-organizations-v2";
const LEGACY_ORGANIZATIONS_KEY = "ims-ai-organizations-v1";
const standardOptions: IsoStandardCode[] = ["ISO 9001", "ISO 14001", "ISO 45001", "ISO 27001", "ISO 50001"];
const typeOptions: { value: ImsDocument["type"]; label: string }[] = [
  { value: "policy", label: "Политика" }, { value: "procedure", label: "Процедура" },
  { value: "register", label: "Регистър" }, { value: "plan", label: "План" },
  { value: "report", label: "Доклад" }, { value: "matrix", label: "Матрица" }, { value: "form", label: "Формуляр" }
];
const statusOptions: { value: DocumentStatus; label: string }[] = [
  { value: "draft", label: "Чернова" }, { value: "review", label: "За преглед" },
  { value: "approved", label: "Одобрен" }, { value: "needs_update", label: "За актуализация" }
];
const localOrganizations = [
  { id: "org-1", name: "Метал Форм АД" }, { id: "org-2", name: "Дигитал Сейф ООД" }, { id: "org-3", name: "Енерго Плант ЕООД" }
];
const initialDocuments: ImsDocument[] = [
  { id: "a405f248-7076-42b4-9394-fc6b68243816", organizationId: "org-1", title: "Интегрирана политика по качество, околна среда и ЗБУТ", type: "policy", standards: ["ISO 9001", "ISO 14001", "ISO 45001"], owner: "Управител", status: "approved", version: "1.0", updatedAt: "2026-07-21", content: "Ръководството се ангажира да поддържа и подобрява интегрираната система за управление." },
  { id: "0d09ecb5-373b-45bb-88b2-7f4495f07521", organizationId: "org-2", title: "Регистър на информационните активи", type: "register", standards: ["ISO 27001"], owner: "Отговорник ИС", status: "review", version: "0.9", updatedAt: "2026-07-20", content: "Регистърът съдържа информационните активи, собствениците им, класификация и приложими контроли." }
];

const emptyDocument: ImsDocument = { id: "", organizationId: "", title: "", type: "procedure", standards: ["ISO 9001"], owner: "", status: "draft", version: "0.1", updatedAt: "", content: "" };

function makeId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `doc-${Date.now()}`; }
function today() { return new Date().toISOString().slice(0, 10); }

export function DocumentWorkspace() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(!supabase);
  const [documents, setDocuments] = useState<ImsDocument[]>(supabase ? [] : initialDocuments);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>(supabase ? [] : localOrganizations);
  const [editing, setEditing] = useState<ImsDocument | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(supabase));
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  useEffect(() => {
    if (supabase) return;
    const savedDocuments = window.localStorage.getItem(DOCUMENTS_KEY);
    const savedOrganizations = window.localStorage.getItem(ORGANIZATIONS_KEY) ?? window.localStorage.getItem(LEGACY_ORGANIZATIONS_KEY);
    if (savedDocuments) try { setDocuments(JSON.parse(savedDocuments) as ImsDocument[]); } catch { window.localStorage.removeItem(DOCUMENTS_KEY); }
    if (savedOrganizations) try { setOrganizations((JSON.parse(savedOrganizations) as Organization[]).map(({ id, name }) => ({ id, name }))); } catch { /* Keep demo organizations. */ }
  }, [supabase]);

  useEffect(() => { if (!supabase) window.localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents)); }, [documents, supabase]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setAuthChecked(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) { if (supabase) setLoading(false); return; }
    setLoading(true);
    Promise.all([
      supabase.from("organizations").select("id,name").order("name"),
      supabase.from("documents").select("*").order("updated_at", { ascending: false })
    ]).then(([organizationResult, documentResult]) => {
      if (organizationResult.error) setError(organizationResult.error.message);
      else setOrganizations(organizationResult.data ?? []);
      if (documentResult.error) setError(documentResult.error.message);
      else setDocuments((documentResult.data ?? []).map(fromDatabase));
      setLoading(false);
    });
  }, [supabase, user]);

  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("bg");
    if (!value) return documents;
    return documents.filter((document) => [document.title, document.fileName, document.owner, document.version, document.content, ...document.standards].join(" ").toLocaleLowerCase("bg").includes(value));
  }, [documents, query]);

  function openNew() {
    setError("");
    setPendingFile(null);
    setEditing({ ...emptyDocument, id: makeId(), organizationId: organizations[0]?.id ?? "", updatedAt: today(), standards: [...emptyDocument.standards] });
  }

  function openEdit(document: ImsDocument) { setError(""); setPendingFile(null); setEditing({ ...document, standards: [...document.standards] }); }

  async function saveDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    if (!editing.title.trim() || !editing.organizationId) return setError("Заглавието и фирмата са задължителни.");
    if (!editing.standards.length) return setError("Изберете поне един ISO стандарт.");
    let value = { ...editing, updatedAt: today() };
    const exists = documents.some((document) => document.id === value.id);
    if (supabase && user) {
      setLoading(true);
      let uploadedPath = "";
      if (pendingFile) {
        if (pendingFile.size > 50 * 1024 * 1024) { setLoading(false); return setError("Файлът е по-голям от разрешените 50 MB."); }
        const filePath = `${value.organizationId}/documents/${value.id}/${Date.now()}-${safeFileName(pendingFile.name)}`;
        const upload = await supabase.storage.from("organization-files").upload(filePath, pendingFile, { contentType: pendingFile.type || "application/octet-stream", upsert: false });
        if (upload.error) { setLoading(false); return setError(`Файлът не беше качен: ${storageErrorMessage(upload.error.message)}`); }
        uploadedPath = filePath;
        value = { ...value, filePath, fileName: pendingFile.name, fileSize: pendingFile.size, mimeType: pendingFile.type || "application/octet-stream" };
      }
      const payload = toDatabase(value);
      const result = exists
        ? await supabase.from("documents").update(payload).eq("id", value.id).select().single()
        : await supabase.from("documents").insert({ id: value.id, ...payload }).select().single();
      setLoading(false);
      if (result.error) {
        if (uploadedPath) await supabase.storage.from("organization-files").remove([uploadedPath]);
        return setError(`Supabase отказа записа: ${result.error.message}`);
      }
      if (uploadedPath && editing.filePath && editing.filePath !== uploadedPath) await supabase.storage.from("organization-files").remove([editing.filePath]);
      const saved = fromDatabase(result.data);
      setDocuments((current) => exists ? current.map((document) => document.id === saved.id ? saved : document) : [saved, ...current]);
      if (pendingFile) await supabase.from("organization_history").insert({ organization_id: saved.organizationId, user_id: user.id, event_type: "document_uploaded", description: `Качен документ „${pendingFile.name}“ (${formatFileSize(pendingFile.size)}).`, event_date: new Date().toISOString() });
    } else {
      if (pendingFile) return setError("Качването на файлове изисква активна връзка със Supabase.");
      setDocuments((current) => exists ? current.map((document) => document.id === value.id ? value : document) : [value, ...current]);
    }
    setPendingFile(null);
    setEditing(null);
  }

  async function removeDocument(document: ImsDocument) {
    if (!window.confirm(`Да бъде ли изтрит документът „${document.title}“?`)) return;
    if (supabase && user) {
      setLoading(true);
      const { error } = await supabase.from("documents").delete().eq("id", document.id);
      if (!error && document.filePath) await supabase.storage.from("organization-files").remove([document.filePath]);
      setLoading(false);
      if (error) return setError(`Supabase отказа изтриването: ${error.message}`);
      await supabase.from("organization_history").insert({ organization_id: document.organizationId, user_id: user.id, event_type: "document_removed", description: `Изтрит документ „${document.title}“.`, event_date: new Date().toISOString() });
    }
    setDocuments((current) => current.filter((item) => item.id !== document.id));
  }

  function duplicateDocument(document: ImsDocument) {
    setPendingFile(null);
    setEditing({ ...document, id: makeId(), title: `${document.title} - копие`, version: "0.1", status: "draft", updatedAt: today(), standards: [...document.standards], filePath: undefined, fileName: undefined, fileSize: undefined, mimeType: undefined });
  }

  async function downloadDocument(item: ImsDocument) {
    if (!supabase || !user || !item.filePath || !item.fileName) return;
    const { data, error } = await supabase.storage.from("organization-files").download(item.filePath);
    if (error) return setError(`Файлът не може да бъде изтеглен: ${error.message}`);
    const url = URL.createObjectURL(data); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = item.fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }

  return <Section id="documents" title="Документи" description="Пълен регистър с редактиране на съдържание, версии, статуси и приложими стандарти.">
    {supabase && authChecked && !user ? <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Влезте в приложението, за да управлявате документите в Supabase.</div> : <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row"><div className="flex h-11 flex-1 items-center gap-2 rounded-lg border border-line bg-white px-3 shadow-sm"><Search className="h-4 w-4 text-slate-400" /><input aria-label="Търсене на документи" className="focus-ring w-full border-0 bg-transparent text-sm outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Търсене по заглавие, файл, собственик, версия или стандарт" value={query} /></div><button className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-action px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50" disabled={!organizations.length} onClick={openNew} type="button"><FilePlus2 className="h-4 w-4" />Добави документ</button></div>
      {error ? <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {!organizations.length && !loading ? <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Първо добавете поне една фирма.</p> : null}
      {loading ? <p className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Синхронизиране...</p> : null}
      <div className="grid gap-3">{filtered.map((document) => <article className="rounded-lg border border-line bg-white p-5 shadow-soft transition-shadow hover:shadow-lg" key={document.id}>
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div className="min-w-0"><div className="mb-1 flex items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-action" /><h3 className="truncate text-sm font-semibold text-ink">{document.title}</h3></div><p className="text-xs text-slate-500">{organizations.find((organization) => organization.id === document.organizationId)?.name ?? "Фирма"} · Версия {document.version} · {document.owner || "Без собственик"} · {document.updatedAt}{document.fileName ? ` · ${document.fileName} · ${formatFileSize(document.fileSize ?? 0)}` : ""}</p></div><div className="flex items-center gap-1"><StatusBadge status={document.status} />{document.filePath ? <button aria-label="Изтегли" className="focus-ring grid h-9 w-9 place-items-center rounded text-action hover:bg-panel" onClick={() => downloadDocument(document)} title="Изтегли файла" type="button"><Download className="h-4 w-4" /></button> : null}<button aria-label="Копирай" className="focus-ring grid h-9 w-9 place-items-center rounded text-slate-500 hover:bg-panel hover:text-action" onClick={() => duplicateDocument(document)} title="Създай копие" type="button"><Copy className="h-4 w-4" /></button><button aria-label="Редактирай" className="focus-ring grid h-9 w-9 place-items-center rounded text-slate-500 hover:bg-panel hover:text-action" onClick={() => openEdit(document)} title="Редактирай" type="button"><Edit3 className="h-4 w-4" /></button><button aria-label="Изтрий" className="focus-ring grid h-9 w-9 place-items-center rounded text-slate-500 hover:bg-red-50 hover:text-red-700" onClick={() => removeDocument(document)} title="Изтрий" type="button"><Trash2 className="h-4 w-4" /></button></div></div>
        <div className="mt-3"><StandardPills standards={document.standards} /></div>{document.content ? <p className="mt-3 line-clamp-3 whitespace-pre-line border-t border-line pt-3 text-sm leading-6 text-slate-600">{document.content}</p> : null}
      </article>)}</div>
      {!filtered.length && !loading ? <div className="rounded border border-dashed border-line bg-white py-10 text-center text-sm text-slate-500">Няма намерени документи.</div> : null}
    </>}

    {editing ? <div aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-5" role="dialog"><form className="max-h-[96vh] w-full overflow-y-auto rounded-t-lg bg-white shadow-xl sm:max-w-4xl sm:rounded-lg" onSubmit={saveDocument}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4"><div><h2 className="font-semibold text-ink">{documents.some((document) => document.id === editing.id) ? "Редактиране на документ" : "Нов документ"}</h2><p className="text-xs text-slate-500">Всички промени се записват в регистъра.</p></div><button aria-label="Затвори" className="focus-ring grid h-9 w-9 place-items-center rounded hover:bg-panel" onClick={() => setEditing(null)} type="button"><X className="h-5 w-5" /></button></div>
      <div className="grid gap-4 p-5 sm:grid-cols-2"><DocField label="Заглавие *"><input autoFocus required value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></DocField><DocField label="Фирма *"><select required value={editing.organizationId} onChange={(event) => setEditing({ ...editing, organizationId: event.target.value })}>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></DocField><DocField label="Вид документ"><select value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value as ImsDocument["type"] })}>{typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></DocField><DocField label="Статус"><select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value as DocumentStatus })}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></DocField><DocField label="Версия"><input required value={editing.version} onChange={(event) => setEditing({ ...editing, version: event.target.value })} /></DocField><DocField label="Собственик"><input value={editing.owner} onChange={(event) => setEditing({ ...editing, owner: event.target.value })} /></DocField>
        <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-medium text-ink">ISO стандарти *</legend><div className="grid gap-2 sm:grid-cols-3">{standardOptions.map((standard) => <label className="flex cursor-pointer items-center gap-2 rounded border border-line px-3 py-2 text-sm hover:bg-panel" key={standard}><input checked={editing.standards.includes(standard)} className="h-4 w-4 accent-blue-600" onChange={(event) => setEditing({ ...editing, standards: event.target.checked ? [...editing.standards, standard] : editing.standards.filter((item) => item !== standard) })} type="checkbox" />{standard}</label>)}</div></fieldset>
        <label className="sm:col-span-2"><span className="mb-2 block text-sm font-medium text-ink">Прикачен файл</span><span className="flex min-h-12 cursor-pointer items-center gap-3 rounded border border-dashed border-line bg-panel px-4 py-3 text-sm text-slate-600 hover:border-action"><Upload className="h-5 w-5 text-action" /><span>{pendingFile ? `${pendingFile.name} · ${formatFileSize(pendingFile.size)}` : editing.fileName ? `Текущ файл: ${editing.fileName} · Изберете нов за замяна` : "Изберете PDF, DOCX, XLSX, снимка, ZIP или друг фирмен файл"}</span><input className="sr-only" onChange={(event) => { const file = event.target.files?.[0] ?? null; setPendingFile(file); if (file && !editing.title.trim()) setEditing({ ...editing, title: file.name }); }} type="file" /></span></label>
        <label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-2">Съдържание<textarea className="focus-ring min-h-72 w-full rounded border border-line bg-white p-3 text-sm font-normal leading-6 outline-none" onChange={(event) => setEditing({ ...editing, content: event.target.value })} placeholder="Въведете или поставете пълния текст на документа..." value={editing.content} /></label>{error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p> : null}
      </div><div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-white px-5 py-4"><button className="focus-ring rounded border border-line px-4 py-2 text-sm font-medium hover:bg-panel" onClick={() => setEditing(null)} type="button">Отказ</button><button className="focus-ring rounded bg-action px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={loading} type="submit">Запази документа</button></div>
    </form></div> : null}
  </Section>;
}

function DocField({ label, children }: { label: string; children: React.ReactElement<{ className?: string }> }) { return <label className="grid gap-1.5 text-sm font-medium text-ink">{label}{cloneElement(children, { className: `focus-ring h-10 w-full rounded border border-line bg-white px-3 text-sm font-normal outline-none ${children.props.className ?? ""}` })}</label>; }

type DocumentRow = { id: string; organization_id: string; title: string; document_type: ImsDocument["type"]; standards: IsoStandardCode[]; owner: string | null; status: DocumentStatus; version: string; content: { body?: string } | string | null; updated_at: string; file_path: string | null; original_filename: string | null; file_size: number | null; mime_type: string | null };
function fromDatabase(value: DocumentRow): ImsDocument { return { id: value.id, organizationId: value.organization_id, title: value.title, type: value.document_type, standards: value.standards ?? [], owner: value.owner ?? "", status: value.status, version: value.version, updatedAt: value.updated_at.slice(0, 10), content: typeof value.content === "string" ? value.content : value.content?.body ?? "", filePath: value.file_path ?? undefined, fileName: value.original_filename ?? undefined, fileSize: value.file_size ?? undefined, mimeType: value.mime_type ?? undefined }; }
function toDatabase(value: ImsDocument) { return { organization_id: value.organizationId, title: value.title.trim(), document_type: value.type, standards: value.standards, owner: value.owner.trim() || null, status: value.status, version: value.version.trim(), content: { body: value.content ?? "" }, file_path: value.filePath ?? null, original_filename: value.fileName ?? null, file_size: value.fileSize ?? null, mime_type: value.mimeType ?? null }; }
function safeFileName(value: string) { return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 140) || "file"; }
function formatFileSize(value: number) { if (!value) return "0 KB"; if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`; return `${(value / 1024 / 1024).toFixed(1)} MB`; }
