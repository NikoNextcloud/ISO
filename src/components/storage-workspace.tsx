"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Archive, Building2, Database, Download, FileText, Gauge, HardDrive, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import { Section, StatCard } from "@/components/ui";
import { storageErrorMessage } from "@/lib/storage-errors";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type StoredFile = {
  id: string;
  organizationId: string;
  title: string;
  name: string;
  path: string;
  size: number;
  updatedAt: string;
  category: "document" | "system";
};

type StoragePlan = "free" | "pro" | "custom";
type OrganizationOption = { id: string; name: string };
type DocumentFileRow = { id: string; organization_id: string; title: string; file_path: string | null; original_filename: string | null; file_size: number | null; updated_at: string };
type SystemFileRow = { id: string; organization_id: string; description: string; file_path: string | null; file_name: string | null; file_size: number | null; event_date: string };

const SETTINGS_KEY = "iso-certification-storage-plan-v1";
const GIB = 1024 ** 3;

export function StorageWorkspace() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(!supabase);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [plan, setPlan] = useState<StoragePlan>("free");
  const [customLimit, setCustomLimit] = useState(10);
  const [category, setCategory] = useState<"all" | StoredFile["category"]>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "largest">("recent");
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null") as { plan?: StoragePlan; customLimit?: number } | null;
      if (saved?.plan) setPlan(saved.plan);
      if (saved?.customLimit) setCustomLimit(saved.customLimit);
    } catch { window.localStorage.removeItem(SETTINGS_KEY); }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ plan, customLimit }));
  }, [plan, customLimit]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setAuthChecked(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const loadStorage = useCallback(async () => {
    if (!supabase || !user) { setLoading(false); return; }
    setLoading(true); setError("");
    const [organizationResult, documentResult, systemResult] = await Promise.all([
      supabase.from("organizations").select("id,name").order("name"),
      supabase.from("documents").select("id,organization_id,title,file_path,original_filename,file_size,updated_at").not("file_path", "is", null),
      supabase.from("organization_history").select("id,organization_id,description,file_path,file_name,file_size,event_date").eq("event_type", "system_exported").not("file_path", "is", null)
    ]);
    const firstError = organizationResult.error ?? documentResult.error ?? systemResult.error;
    if (firstError) setError(`Статистиката не може да бъде заредена: ${firstError.message}. Проверете миграции 005 и 006.`);
    setOrganizations((organizationResult.data ?? []) as OrganizationOption[]);
    const documentFiles = ((documentResult.data ?? []) as DocumentFileRow[]).filter((item) => item.file_path).map((item) => ({
      id: item.id, organizationId: item.organization_id, title: item.title, name: item.original_filename ?? item.title, path: item.file_path!, size: item.file_size ?? 0, updatedAt: item.updated_at, category: "document" as const
    }));
    const systemFiles = ((systemResult.data ?? []) as SystemFileRow[]).filter((item) => item.file_path).map((item) => ({
      id: item.id, organizationId: item.organization_id, title: item.description, name: item.file_name ?? "ISO система.zip", path: item.file_path!, size: item.file_size ?? 0, updatedAt: item.event_date, category: "system" as const
    }));
    setFiles([...systemFiles, ...documentFiles]);
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => { void loadStorage(); }, [loadStorage]);

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const systemFiles = files.filter((file) => file.category === "system");
  const documentFiles = files.filter((file) => file.category === "document");
  const limitBytes = plan === "free" ? GIB : plan === "pro" ? 100 * GIB : Math.max(0.1, customLimit) * GIB;
  const usedPercent = Math.min(100, limitBytes ? (totalBytes / limitBytes) * 100 : 0);
  const availableBytes = Math.max(0, limitBytes - totalBytes);

  const visibleFiles = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("bg");
    return files.filter((file) => {
      const organization = organizations.find((item) => item.id === file.organizationId)?.name ?? "";
      return (category === "all" || file.category === category) && (!search || `${file.name} ${file.title} ${organization}`.toLocaleLowerCase("bg").includes(search));
    }).sort((a, b) => sort === "largest" ? b.size - a.size : b.updatedAt.localeCompare(a.updatedAt));
  }, [category, files, organizations, query, sort]);

  const companyUsage = useMemo(() => organizations.map((organization) => ({
    ...organization,
    files: files.filter((file) => file.organizationId === organization.id),
    bytes: files.filter((file) => file.organizationId === organization.id).reduce((sum, file) => sum + file.size, 0)
  })).filter((item) => item.files.length).sort((a, b) => b.bytes - a.bytes), [files, organizations]);

  async function downloadFile(file: StoredFile) {
    if (!supabase || !user) return;
    setError("");
    const { data, error } = await supabase.storage.from("organization-files").download(file.path);
    if (error) return setError(`Файлът не може да бъде изтеглен: ${storageErrorMessage(error.message)}`);
    const url = URL.createObjectURL(data); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = file.name; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }

  async function deleteFile(file: StoredFile) {
    if (!supabase || !user || !window.confirm(`Да бъде ли изтрит файлът „${file.name}“ от Supabase? Историята на действието ще остане.`)) return;
    setLoading(true); setError("");
    const removed = await supabase.storage.from("organization-files").remove([file.path]);
    if (removed.error) { setLoading(false); return setError(`Файлът не беше изтрит: ${storageErrorMessage(removed.error.message)}`); }
    const cleared = file.category === "document"
      ? await supabase.from("documents").update({ file_path: null, original_filename: null, file_size: null, mime_type: null }).eq("id", file.id)
      : await supabase.from("organization_history").update({ file_path: null, file_name: null, file_size: null }).eq("id", file.id);
    if (cleared.error) setError(`Файлът е изтрит, но регистърът не беше обновен: ${cleared.error.message}`);
    setFiles((current) => current.filter((item) => item.path !== file.path));
    setLoading(false);
  }

  if (supabase && !authChecked) return <LoadingState />;
  if (!supabase) return <Notice text="Добавете Supabase настройките, за да виждате използваното облачно място." />;
  if (!user) return <Notice text="Влезте през таб „Фирми“, за да отворите защитената статистика за хранилището." />;

  return <Section id="storage" title="Хранилище" description="Използвано място от ZIP системите и документите, записани през приложението.">
    <div className="mb-5 flex flex-col gap-3 rounded-lg border border-line bg-white p-4 shadow-soft md:flex-row md:items-center md:justify-between">
      <div><p className="text-sm font-semibold text-ink">Лимит на Supabase плана</p><p className="mt-1 text-xs text-slate-500">Изберете плана, за да се изчисли процентът на запълване.</p></div>
      <div className="flex flex-wrap items-center gap-2"><div className="inline-flex rounded-lg border border-line bg-panel p-1">{(["free", "pro", "custom"] as StoragePlan[]).map((item) => <button className={`h-8 rounded-md px-3 text-xs font-semibold ${plan === item ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"}`} key={item} onClick={() => setPlan(item)} type="button">{item === "free" ? "Free · 1 GB" : item === "pro" ? "Pro · 100 GB" : "Друг"}</button>)}</div>{plan === "custom" ? <label className="flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold text-slate-600"><input className="w-20 border-0 bg-transparent text-right outline-none" min="0.1" onChange={(event) => setCustomLimit(Number(event.target.value))} step="0.1" type="number" value={customLimit} />GB</label> : null}<button aria-label="Обнови статистиката" className="focus-ring grid h-10 w-10 place-items-center rounded-lg border border-line text-slate-600 hover:bg-panel" onClick={() => void loadStorage()} title="Обнови" type="button"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
    </div>

    {error ? <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard icon={HardDrive} label="Използвано място" value={formatBytes(totalBytes)} /><StatCard icon={Gauge} label="Свободно място" tone="success" value={formatBytes(availableBytes)} /><StatCard icon={Archive} label="ZIP системи" value={systemFiles.length} /><StatCard icon={FileText} label="Качени документи" value={documentFiles.length} /></div>

    <div className="mt-5 rounded-lg border border-line bg-white p-5 shadow-soft"><div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold text-ink">Запълване на лимита</span><span className="font-bold text-ink">{usedPercent.toFixed(2)}%</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${usedPercent >= 90 ? "bg-red-500" : usedPercent >= 70 ? "bg-amber-500" : "bg-blue-600"}`} style={{ width: `${Math.max(usedPercent, totalBytes ? 0.4 : 0)}%` }} /></div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{formatBytes(totalBytes)} използвани</span><span>{formatBytes(limitBytes)} лимит</span></div></div>

    <div className="mt-5 grid gap-5 xl:grid-cols-2"><div className="rounded-lg border border-line bg-white p-5 shadow-soft"><h3 className="mb-4 flex items-center gap-2 text-base font-bold text-ink"><Database className="h-5 w-5 text-blue-600" />Разпределение по тип</h3><UsageBar label="Генерирани ZIP системи" bytes={systemFiles.reduce((sum, file) => sum + file.size, 0)} total={totalBytes} tone="bg-teal-600" /><UsageBar label="Качени документи" bytes={documentFiles.reduce((sum, file) => sum + file.size, 0)} total={totalBytes} tone="bg-blue-600" /></div><div className="rounded-lg border border-line bg-white p-5 shadow-soft"><h3 className="mb-4 flex items-center gap-2 text-base font-bold text-ink"><Building2 className="h-5 w-5 text-teal-600" />Използване по фирми</h3>{companyUsage.length ? <div className="space-y-4">{companyUsage.slice(0, 8).map((company) => <UsageBar bytes={company.bytes} key={company.id} label={`${company.name} · ${company.files.length} файла`} total={totalBytes} tone="bg-slate-700" />)}</div> : <p className="py-5 text-center text-sm text-slate-500">Все още няма файлове.</p>}</div></div>

    <div className="mt-5"><div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center"><div className="flex h-11 flex-1 items-center gap-2 rounded-lg border border-line bg-white px-3 shadow-sm"><Search className="h-4 w-4 text-slate-400" /><input className="w-full border-0 bg-transparent text-sm outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Търсене по файл или фирма" value={query} /></div><div className="inline-flex self-start rounded-lg border border-line bg-white p-1">{(["all", "system", "document"] as const).map((item) => <button className={`h-9 rounded-md px-3 text-xs font-semibold ${category === item ? "bg-[#111827] text-white" : "text-slate-500 hover:bg-panel"}`} key={item} onClick={() => setCategory(item)} type="button">{item === "all" ? "Всички" : item === "system" ? "ZIP системи" : "Документи"}</button>)}</div><select className="h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-slate-600 outline-none" onChange={(event) => setSort(event.target.value as "recent" | "largest")} value={sort}><option value="recent">Най-нови</option><option value="largest">Най-големи</option></select></div>
      {loading ? <p className="inline-flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Обновяване на статистиката...</p> : visibleFiles.length ? <div className="overflow-hidden rounded-lg border border-line bg-white shadow-soft"><div className="hidden grid-cols-12 gap-3 border-b border-line bg-panel px-4 py-3 text-xs font-semibold uppercase text-slate-500 md:grid"><span className="col-span-4">Файл</span><span className="col-span-3">Фирма</span><span className="col-span-2">Тип</span><span className="col-span-2">Размер</span><span /></div>{visibleFiles.map((file) => <div className="grid gap-3 border-b border-line px-4 py-4 text-sm last:border-0 md:grid-cols-12 md:items-center" key={file.path}><div className="min-w-0 md:col-span-4"><p className="truncate font-semibold text-ink">{file.name}</p><p className="mt-1 text-xs text-slate-500">{formatDateTime(file.updatedAt)}</p></div><Link className="truncate text-action hover:underline md:col-span-3" href={`/organizations/${file.organizationId}`}>{organizations.find((item) => item.id === file.organizationId)?.name ?? "Фирма"}</Link><span className="text-slate-600 md:col-span-2">{file.category === "system" ? "ZIP система" : "Документ"}</span><span className="font-semibold text-ink md:col-span-2">{formatBytes(file.size)}</span><div className="flex justify-end gap-1"><button aria-label="Свали файла" className="focus-ring grid h-9 w-9 place-items-center rounded-lg text-action hover:bg-blue-50" onClick={() => void downloadFile(file)} title="Свали" type="button"><Download className="h-4 w-4" /></button><button aria-label="Изтрий файла" className="focus-ring grid h-9 w-9 place-items-center rounded-lg text-red-600 hover:bg-red-50" onClick={() => void deleteFile(file)} title="Изтрий от Supabase" type="button"><Trash2 className="h-4 w-4" /></button></div></div>)}</div> : <div className="rounded-lg border border-dashed border-line bg-white py-10 text-center text-sm text-slate-500">Няма файлове, които отговарят на филтъра.</div>}
    </div>
  </Section>;
}

function UsageBar({ label, bytes, total, tone }: { label: string; bytes: number; total: number; tone: string }) { const percent = total ? (bytes / total) * 100 : 0; return <div className="mb-4 last:mb-0"><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="truncate font-medium text-ink">{label}</span><span className="shrink-0 text-slate-500">{formatBytes(bytes)}</span></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${tone}`} style={{ width: `${percent}%` }} /></div></div>; }
function LoadingState() { return <div className="grid min-h-[45vh] place-items-center"><p className="inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-action" />Зареждане на хранилището...</p></div>; }
function Notice({ text }: { text: string }) { return <div className="mx-auto max-w-xl py-20 text-center"><HardDrive className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">{text}</p></div>; }
function formatBytes(value: number) { if (!value) return "0 MB"; if (value < 1024) return `${value} B`; if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`; if (value < GIB) return `${(value / 1024 ** 2).toFixed(1)} MB`; return `${(value / GIB).toFixed(2)} GB`; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
