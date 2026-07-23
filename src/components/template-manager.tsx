"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { CheckCircle2, Download, FileArchive, Loader2, Plus, Power, Trash2, Upload, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { IsoStandardCode } from "@/lib/types";

type TemplateVersion = {
  id: string; standard: IsoStandardCode; version: string; original_filename: string; storage_path: string;
  file_size: number; notes: string | null; is_active: boolean; created_at: string;
};

export function TemplateManager({ standard }: { standard: IsoStandardCode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [version, setVersion] = useState("1.0");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadVersions = useCallback(async () => {
    if (!supabase || !user) return;
    const result = await supabase.from("template_versions").select("*").eq("standard", standard).order("created_at", { ascending: false });
    if (result.error) setError(result.error.message.includes("template_versions") ? "Изпълнете миграция 008 в Supabase, за да активирате версиите на шаблоните." : result.error.message);
    else { setVersions((result.data ?? []) as TemplateVersion[]); setError(""); }
  }, [standard, supabase, user]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => { void loadVersions(); }, [loadVersions]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || !file || !version.trim()) return;
    if (!file.name.toLowerCase().endsWith(".zip")) return setError("Версията на шаблона трябва да бъде ZIP архив.");
    if (file.size > 50 * 1024 * 1024) return setError("ZIP архивът е по-голям от разрешените 50 MB.");
    setBusy(true); setError("");
    const id = crypto.randomUUID();
    const storagePath = `${user.id}/${safeName(standard)}/${id}/${safeName(file.name)}`;
    const stored = await supabase.storage.from("iso-templates").upload(storagePath, file, { contentType: "application/zip", upsert: false });
    if (stored.error) { setBusy(false); return setError(`Шаблонът не беше качен: ${stored.error.message}. Проверете миграция 008.`); }
    if (active) await supabase.from("template_versions").update({ is_active: false }).eq("standard", standard).eq("is_active", true);
    const inserted = await supabase.from("template_versions").insert({ id, owner_id: user.id, standard, version: version.trim(), original_filename: file.name, storage_path: storagePath, file_size: file.size, mime_type: "application/zip", notes: notes.trim() || null, is_active: active }).select().single();
    if (inserted.error) {
      await supabase.storage.from("iso-templates").remove([storagePath]);
      setBusy(false); return setError(`Версията не беше записана: ${inserted.error.message}`);
    }
    setShowForm(false); setFile(null); setNotes(""); setVersion("1.0"); setActive(false); setBusy(false);
    await loadVersions();
  }

  async function activate(item: TemplateVersion) {
    if (!supabase || item.is_active) return;
    setBusy(true); setError("");
    const cleared = await supabase.from("template_versions").update({ is_active: false }).eq("standard", standard).eq("is_active", true);
    const selected = cleared.error ? cleared : await supabase.from("template_versions").update({ is_active: true }).eq("id", item.id);
    if (selected.error) setError(`Версията не беше активирана: ${selected.error.message}`);
    await loadVersions(); setBusy(false);
  }

  async function download(item: TemplateVersion) {
    if (!supabase) return;
    const result = await supabase.storage.from("iso-templates").download(item.storage_path);
    if (result.error) return setError(`Шаблонът не може да бъде свален: ${result.error.message}`);
    const url = URL.createObjectURL(result.data); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = item.original_filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }

  async function remove(item: TemplateVersion) {
    if (!supabase || !window.confirm(`Да бъде ли изтрита версия ${item.version}?`)) return;
    setBusy(true); setError("");
    const removedFile = await supabase.storage.from("iso-templates").remove([item.storage_path]);
    const removedRow = removedFile.error ? removedFile : await supabase.from("template_versions").delete().eq("id", item.id);
    if (removedRow.error) setError(`Версията не беше изтрита: ${removedRow.error.message}`);
    await loadVersions(); setBusy(false);
  }

  return <section className="mb-6 rounded-lg border border-line bg-white shadow-soft"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4"><div><h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><FileArchive className="h-4 w-4 text-brand" />Версии на шаблоните</h3><p className="mt-1 text-xs text-slate-500">Активният ZIP заменя вградения комплект при следващо генериране.</p></div><button className="focus-ring inline-flex items-center gap-2 rounded border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-panel" onClick={() => setShowForm((value) => !value)} type="button">{showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{showForm ? "Затвори" : "Нова версия"}</button></div>
    {showForm ? <form className="grid gap-4 border-b border-line bg-panel p-5 md:grid-cols-2" onSubmit={upload}><label className="grid gap-1.5 text-sm font-medium text-ink">Версия<input className="focus-ring h-10 rounded border border-line bg-white px-3 font-normal outline-none" required value={version} onChange={(event) => setVersion(event.target.value)} /></label><label className="grid gap-1.5 text-sm font-medium text-ink">ZIP комплект<input accept=".zip,application/zip" className="focus-ring h-10 rounded border border-line bg-white px-3 py-2 text-sm font-normal" required type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><label className="grid gap-1.5 text-sm font-medium text-ink md:col-span-2">Бележки<textarea className="focus-ring min-h-20 rounded border border-line bg-white p-3 font-normal outline-none" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><label className="flex items-center gap-2 text-sm text-ink md:col-span-2"><input checked={active} onChange={(event) => setActive(event.target.checked)} type="checkbox" />Използвай тази версия веднага при генериране</label><div className="flex justify-end md:col-span-2"><button className="focus-ring inline-flex items-center gap-2 rounded bg-action px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Качи версия</button></div></form> : null}
    {error ? <p className="m-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    {supabase && user ? versions.length ? <div className="divide-y divide-line">{versions.map((item) => <div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center" key={item.id}><div className="min-w-0"><p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">Версия {item.version}{item.is_active ? <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Активна</span> : null}</p><p className="mt-1 truncate text-xs text-slate-500">{item.original_filename} · {formatSize(item.file_size)} · {new Intl.DateTimeFormat("bg-BG").format(new Date(item.created_at))}</p>{item.notes ? <p className="mt-1 text-xs text-slate-600">{item.notes}</p> : null}</div><div className="flex shrink-0 gap-2">{!item.is_active ? <button aria-label="Активирай версията" className="focus-ring grid h-9 w-9 place-items-center rounded border border-line text-emerald-700 hover:bg-emerald-50" disabled={busy} onClick={() => void activate(item)} title="Активирай" type="button"><Power className="h-4 w-4" /></button> : null}<button aria-label="Свали шаблона" className="focus-ring grid h-9 w-9 place-items-center rounded border border-line text-action hover:bg-panel" onClick={() => void download(item)} title="Свали" type="button"><Download className="h-4 w-4" /></button><button aria-label="Изтрий версията" className="focus-ring grid h-9 w-9 place-items-center rounded border border-line text-red-700 hover:bg-red-50" disabled={busy} onClick={() => void remove(item)} title="Изтрий" type="button"><Trash2 className="h-4 w-4" /></button></div></div>)}</div> : <p className="px-5 py-6 text-sm text-slate-500">Няма качени версии. Използват се вградените шаблони.</p> : <p className="px-5 py-6 text-sm text-slate-500">Версиите се пазят в Supabase след вход в приложението.</p>}
  </section>;
}

function safeName(value: string) { return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120) || "template"; }
function formatSize(value: number) { return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`; }
