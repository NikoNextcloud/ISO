"use client";

import { cloneElement, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { AlertTriangle, ArrowLeft, Award, Building2, CalendarClock, CheckCircle2, Circle, ClipboardCheck, Download, FileArchive, FileText, History, Loader2, Plus, Save, Trash2, Upload } from "lucide-react";
import { StandardPills, StatusBadge } from "@/components/ui";
import { buildOrganizationChecklists } from "@/lib/compliance-checklist";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { storageErrorMessage } from "@/lib/storage-errors";
import type { DocumentStatus, ImsDocument, IsoStandardCode, Organization, OrganizationCertificate, OrganizationHistoryEntry, OrganizationStatus } from "@/lib/types";

const ORGANIZATIONS_KEY = "iso-certification-organizations-v2";
const LEGACY_ORGANIZATIONS_KEY = "ims-ai-organizations-v1";
const CERTIFICATES_KEY = "iso-certification-certificates-v1";
const HISTORY_KEY = "iso-certification-history-v1";
const DOCUMENTS_KEY = "iso-certification-documents-v1";
const standardOptions: IsoStandardCode[] = [
  "ISO 9001", "ISO 14001", "ISO 45001", "ISO 27001", "ISO 50001",
  "ISO 9-20-27", "ISO 9001-14001-45001", "ISO 9-14"
];

const emptyCertificate = {
  standard: "ISO 9001" as IsoStandardCode,
  certificateNumber: "",
  certificationBody: "",
  issuedAt: "",
  validUntil: "",
  nextCertificationDate: "",
  notes: ""
};

export function OrganizationDetailWorkspace({ organizationId }: { organizationId: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(!supabase);
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [certificates, setCertificates] = useState<OrganizationCertificate[]>([]);
  const [history, setHistory] = useState<OrganizationHistoryEntry[]>([]);
  const [documents, setDocuments] = useState<ImsDocument[]>([]);
  const [showCertificateForm, setShowCertificateForm] = useState(false);
  const [certificateDraft, setCertificateDraft] = useState({ ...emptyCertificate });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setAuthChecked(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (supabase) return;
    try {
      const organizations = JSON.parse(window.localStorage.getItem(ORGANIZATIONS_KEY) ?? window.localStorage.getItem(LEGACY_ORGANIZATIONS_KEY) ?? "[]") as Organization[];
      const localCertificates = JSON.parse(window.localStorage.getItem(CERTIFICATES_KEY) ?? "[]") as OrganizationCertificate[];
      const localHistory = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]") as OrganizationHistoryEntry[];
      const localDocuments = JSON.parse(window.localStorage.getItem(DOCUMENTS_KEY) ?? "[]") as ImsDocument[];
      setOrganization(organizations.find((item) => item.id === organizationId) ?? null);
      setCertificates(localCertificates.filter((item) => item.organizationId === organizationId));
      setHistory(localHistory.filter((item) => item.organizationId === organizationId));
      setDocuments(localDocuments.filter((item) => item.organizationId === organizationId));
    } catch { setError("Локалните данни на фирмата не могат да бъдат прочетени."); }
    setLoading(false);
  }, [organizationId, supabase]);

  useEffect(() => {
    if (!supabase || !authChecked || !user) { if (supabase && authChecked) setLoading(false); return; }
    setLoading(true);
    Promise.all([
      supabase.from("organizations").select("*").eq("id", organizationId).single(),
      supabase.from("organization_certificates").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
      supabase.from("organization_history").select("*").eq("organization_id", organizationId).order("event_date", { ascending: false }),
      supabase.from("documents").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false })
    ]).then(([organizationResult, certificateResult, historyResult, documentResult]) => {
      const problem = organizationResult.error ?? certificateResult.error ?? historyResult.error ?? documentResult.error;
      if (problem) setError(`Досието не може да бъде заредено: ${problem.message}`);
      else {
        setOrganization(organizationFromDatabase(organizationResult.data));
        setCertificates((certificateResult.data ?? []).map(certificateFromDatabase));
        setHistory((historyResult.data ?? []).map(historyFromDatabase));
        setDocuments((documentResult.data ?? []).map(documentFromDatabase));
      }
      setLoading(false);
    });
  }, [authChecked, organizationId, supabase, user]);

  const sortedCertificates = [...certificates].sort((a, b) => (a.nextCertificationDate || "9999").localeCompare(b.nextCertificationDate || "9999"));
  const sortedHistory = [...history].sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  const generatedSystems = sortedHistory.filter((item) => item.eventType === "system_exported");
  const nextCertification = sortedCertificates.find((item) => item.nextCertificationDate)?.nextCertificationDate ?? "";
  const checklist = organization ? buildOrganizationChecklists(organization, certificates, history, documents) : null;

  async function addCertificate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !certificateDraft.certificateNumber.trim()) return setError("Въведете номер на сертификата.");
    setSaving(true);
    setError("");
    const certificate: OrganizationCertificate = { ...certificateDraft, id: makeId(), organizationId, createdAt: new Date().toISOString() };
    if (supabase && user) {
      const { data, error } = await supabase.from("organization_certificates").insert(certificateToDatabase(certificate)).select().single();
      if (error) { setSaving(false); return setError(`Сертификатът не беше записан: ${error.message}`); }
      setCertificates((current) => [certificateFromDatabase(data), ...current]);
    } else {
      const all = JSON.parse(window.localStorage.getItem(CERTIFICATES_KEY) ?? "[]") as OrganizationCertificate[];
      window.localStorage.setItem(CERTIFICATES_KEY, JSON.stringify([certificate, ...all]));
      setCertificates((current) => [certificate, ...current]);
    }

    if (!organization.standards.includes(certificate.standard)) {
      const standards = [...organization.standards, certificate.standard];
      const updated = { ...organization, standards };
      setOrganization(updated);
      if (supabase && user) await supabase.from("organizations").update({ standards }).eq("id", organizationId);
      else updateLocalOrganization(updated);
    }
    await addHistory(`Добавен сертификат ${certificate.standard}, № ${certificate.certificateNumber}. Следваща сертификация: ${formatDate(certificate.nextCertificationDate)}.`, "certificate_added");
    setCertificateDraft({ ...emptyCertificate, standard: organization.standards[0] ?? "ISO 9001" });
    setShowCertificateForm(false);
    setSaving(false);
  }

  async function removeCertificate(certificate: OrganizationCertificate) {
    if (!window.confirm(`Да бъде ли изтрит сертификат ${certificate.standard} № ${certificate.certificateNumber}?`)) return;
    if (supabase && user) {
      const { error } = await supabase.from("organization_certificates").delete().eq("id", certificate.id);
      if (error) return setError(`Сертификатът не беше изтрит: ${error.message}`);
    } else {
      const all = JSON.parse(window.localStorage.getItem(CERTIFICATES_KEY) ?? "[]") as OrganizationCertificate[];
      window.localStorage.setItem(CERTIFICATES_KEY, JSON.stringify(all.filter((item) => item.id !== certificate.id)));
    }
    setCertificates((current) => current.filter((item) => item.id !== certificate.id));
    await addHistory(`Изтрит сертификат ${certificate.standard}, № ${certificate.certificateNumber}.`, "certificate_removed");
  }

  async function addHistory(description: string, eventType: OrganizationHistoryEntry["eventType"]) {
    const entry: OrganizationHistoryEntry = { id: makeId(), organizationId, description, eventType, eventDate: new Date().toISOString() };
    if (supabase && user) {
      const { data } = await supabase.from("organization_history").insert({ id: entry.id, organization_id: organizationId, user_id: user.id, description, event_type: eventType, event_date: entry.eventDate }).select().single();
      if (data) setHistory((current) => [historyFromDatabase(data), ...current]);
    } else {
      const all = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]") as OrganizationHistoryEntry[];
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...all]));
      setHistory((current) => [entry, ...current]);
    }
  }

  async function uploadCompanyDocument(file: File) {
    if (!organization) return;
    if (!supabase || !user) return setError("Качването на файлове изисква активна връзка със Supabase.");
    if (file.size > 50 * 1024 * 1024) return setError("Файлът е по-голям от разрешените 50 MB.");
    setSaving(true);
    setError("");
    const id = makeId();
    const filePath = `${organizationId}/documents/${id}/${Date.now()}-${safeFileName(file.name)}`;
    const upload = await supabase.storage.from("organization-files").upload(filePath, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upload.error) { setSaving(false); return setError(`Файлът не беше качен: ${storageErrorMessage(upload.error.message)}`); }
    const document: ImsDocument = { id, organizationId, title: file.name, type: "form", standards: organization.standards.length ? [...organization.standards] : ["ISO 9001"], owner: organization.manager, status: "draft", version: "1.0", updatedAt: new Date().toISOString().slice(0, 10), content: "Качен фирмен файл", filePath, fileName: file.name, fileSize: file.size, mimeType: file.type || "application/octet-stream" };
    const result = await supabase.from("documents").insert(documentToDatabase(document)).select().single();
    if (result.error) {
      await supabase.storage.from("organization-files").remove([filePath]);
      setSaving(false);
      return setError(`Документът не беше записан: ${result.error.message}`);
    }
    setDocuments((current) => [documentFromDatabase(result.data), ...current]);
    await addHistory(`Качен документ „${file.name}“ (${formatFileSize(file.size)}).`, "document_uploaded");
    setSaving(false);
  }

  async function downloadStoredFile(filePath: string, fileName: string) {
    if (!supabase || !user) return setError("Изтеглянето на защитени файлове изисква вход в Supabase.");
    setError("");
    const { data, error } = await supabase.storage.from("organization-files").download(filePath);
    if (error) return setError(`Файлът не може да бъде изтеглен: ${error.message}`);
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    URL.revokeObjectURL(url);
  }

  function updateLocalOrganization(updated: Organization) {
    const all = JSON.parse(window.localStorage.getItem(ORGANIZATIONS_KEY) ?? window.localStorage.getItem(LEGACY_ORGANIZATIONS_KEY) ?? "[]") as Organization[];
    window.localStorage.setItem(ORGANIZATIONS_KEY, JSON.stringify(all.map((item) => item.id === updated.id ? updated : item)));
  }

  if (loading || (supabase && !authChecked)) return <div className="grid min-h-[50vh] place-items-center"><p className="inline-flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-5 w-5 animate-spin text-action" />Зареждане на фирменото досие...</p></div>;
  if (supabase && !user) return <Notice title="Необходим е вход" text="Влезте през страницата „Фирми“, за да отворите защитеното фирмено досие." />;
  if (!organization) return <Notice title="Фирмата не е намерена" text="Записът може да е изтрит или да нямате достъп до него." />;

  return <div className="space-y-7 py-3">
    <div><Link className="focus-ring mb-4 inline-flex items-center gap-2 rounded text-sm font-medium text-action hover:underline" href="/organizations"><ArrowLeft className="h-4 w-4" />Всички фирми</Link><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-xl font-semibold text-ink">{organization.name}</h2><p className="mt-1 text-sm text-slate-500">Фирмено досие · ЕИК {organization.uic}</p></div><StatusBadge status={organization.status} /></div></div>

    {error ? <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Summary icon={Building2} label="Избрани стандарти" value={organization.standards.length} /><Summary icon={Award} label="Сертификати" value={certificates.length} /><Summary icon={CalendarClock} label="Следваща сертификация" value={formatDate(nextCertification)} /><Summary icon={FileText} label="Документи" value={documents.length} /><Summary icon={ClipboardCheck} label="Реална готовност" value={`${checklist?.percent ?? 0}%`} /></div>

    <section className="border-t border-line pt-6"><h3 className="mb-4 text-base font-semibold text-ink">Основни данни</h3><dl className="grid gap-x-8 gap-y-4 rounded border border-line bg-white p-5 text-sm shadow-soft sm:grid-cols-2 xl:grid-cols-3">
      <Data label="Име на фирмата" value={organization.name} />
      <Data label="ЕИК" value={organization.uic} />
      <Data label="Правна форма" value={organization.legalForm} />
      <Data label="Седалище/адрес" value={organization.address} />
      <Data label="Град" value={organization.city} />
      <Data label="Управител" value={organization.manager} />
      <Data label="Дата на създаване" value={formatOptionalDate(organization.foundedAt)} />
      <Data label="Телефон" value={organization.contactPhone} />
      <Data label="Имейл" value={organization.contactEmail} />
      <Data label="Обхват на дейност" value={organization.activity} />
      <Data label="Физически обхват" value={organization.physicalScope} />
      <Data label="Дата на системата" value={formatOptionalDate(organization.systemDate)} />
      <Data label="Контекст на организацията" value={organization.organizationContext} />
      <Data label="Процеси" value={organization.processesDescription} />
      <Data label="Обучения" value={organization.trainingDetails} />
      <Data label="Вътрешен одит" value={formatOptionalDate(organization.internalAuditDate)} />
      <Data label="Преглед от ръководството" value={formatOptionalDate(organization.managementReviewDate)} />
      <Data label="Предходна година" value={organization.previousYear ? String(organization.previousYear) : ""} />
      <Data label="Настояща година" value={organization.currentYear ? String(organization.currentYear) : ""} />
      <Data label="Представител" value={organization.representative} />
      <Data label="Лице за контакт" value={organization.contactName} />
      <Data label="Служители" value={String(organization.employees)} />
      <Data label="Обекти" value={String(organization.sites)} />
    </dl></section>

    <section className="border-t border-line pt-6"><h3 className="mb-4 text-base font-semibold text-ink">Избрани ISO стандарти</h3><div className="rounded border border-line bg-white p-5 shadow-soft"><StandardPills standards={organization.standards} /></div></section>

    <section className="border-t border-line pt-6"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h3 className="flex items-center gap-2 text-base font-semibold text-ink"><ClipboardCheck className="h-5 w-5 text-brand" />Контролен списък и реална готовност</h3><p className="mt-1 text-sm text-slate-500">Изчислява се от реалните фирмени данни, файлове, одобрения, системи и сертификати.</p></div><div className="text-right"><p className="text-2xl font-semibold text-ink">{checklist?.percent ?? 0}%</p><p className="text-xs text-slate-500">{checklist?.missing ?? 0} незавършени точки</p></div></div><div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${checklist?.percent ?? 0}%` }} /></div>{checklist?.checklists.length ? <div className="grid gap-4 xl:grid-cols-2">{checklist.checklists.map((standard) => <div className="rounded border border-line bg-white p-4 shadow-soft" key={standard.standard}><div className="mb-3 flex items-center justify-between gap-3"><h4 className="text-sm font-semibold text-ink">{standard.standard}</h4><span className={`rounded px-2 py-1 text-xs font-semibold ${standard.percent >= 80 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{standard.percent}%</span></div><div className="space-y-2">{standard.items.map((item) => <div className="flex items-start gap-2 rounded bg-panel px-3 py-2" key={item.id}>{item.complete ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}<div><p className="text-sm font-medium text-ink">{item.label}</p><p className="mt-0.5 text-xs text-slate-500">{item.detail}</p></div></div>)}</div></div>)}</div> : <div className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><AlertTriangle className="h-4 w-4" />Изберете поне един ISO стандарт за фирмата.</div>}</section>

    <section className="border-t border-line pt-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-ink">Сертификати</h3><p className="mt-1 text-sm text-slate-500">Всички издадени сертификати и бъдещи дати.</p></div><button className="focus-ring inline-flex items-center gap-2 rounded bg-action px-3 py-2 text-sm font-medium text-white" onClick={() => { setShowCertificateForm((current) => !current); setError(""); }} type="button"><Plus className="h-4 w-4" />Добави сертификат</button></div>
      {showCertificateForm ? <form className="mb-5 grid gap-4 border-y border-line bg-panel px-4 py-4 sm:grid-cols-3" onSubmit={addCertificate}><Field label="Стандарт *"><select value={certificateDraft.standard} onChange={(event) => setCertificateDraft({ ...certificateDraft, standard: event.target.value as IsoStandardCode })}>{standardOptions.map((standard) => <option key={standard}>{standard}</option>)}</select></Field><Field label="Номер *"><input required value={certificateDraft.certificateNumber} onChange={(event) => setCertificateDraft({ ...certificateDraft, certificateNumber: event.target.value })} /></Field><Field label="Сертифициращ орган"><input value={certificateDraft.certificationBody} onChange={(event) => setCertificateDraft({ ...certificateDraft, certificationBody: event.target.value })} /></Field><Field label="Издаден на"><input type="date" value={certificateDraft.issuedAt} onChange={(event) => setCertificateDraft({ ...certificateDraft, issuedAt: event.target.value })} /></Field><Field label="Валиден до"><input type="date" value={certificateDraft.validUntil} onChange={(event) => setCertificateDraft({ ...certificateDraft, validUntil: event.target.value })} /></Field><Field label="Следваща сертификация"><input type="date" value={certificateDraft.nextCertificationDate} onChange={(event) => setCertificateDraft({ ...certificateDraft, nextCertificationDate: event.target.value })} /></Field><label className="grid gap-1.5 text-sm font-medium text-ink sm:col-span-3">Бележки<textarea className="focus-ring min-h-20 rounded border border-line bg-white p-3 font-normal outline-none" value={certificateDraft.notes} onChange={(event) => setCertificateDraft({ ...certificateDraft, notes: event.target.value })} /></label><div className="flex justify-end gap-2 sm:col-span-3"><button className="rounded border border-line bg-white px-3 py-2 text-sm" onClick={() => setShowCertificateForm(false)} type="button">Отказ</button><button className="inline-flex items-center gap-2 rounded bg-action px-3 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving} type="submit">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Запази</button></div></form> : null}
      {sortedCertificates.length ? <div className="overflow-hidden rounded border border-line bg-white shadow-soft"><div className="hidden grid-cols-12 gap-3 border-b border-line bg-panel px-4 py-3 text-xs font-semibold uppercase text-slate-500 md:grid"><span className="col-span-2">Стандарт</span><span className="col-span-2">Номер</span><span className="col-span-2">Издаден</span><span className="col-span-2">Валиден до</span><span className="col-span-3">Следваща</span><span /></div>{sortedCertificates.map((certificate) => <div className="grid gap-2 border-b border-line px-4 py-3 text-sm last:border-0 md:grid-cols-12 md:items-center md:gap-3" key={certificate.id}><span className="font-medium text-ink md:col-span-2">{certificate.standard}</span><span className="text-slate-600 md:col-span-2">№ {certificate.certificateNumber}</span><span className="text-slate-600 md:col-span-2">{formatDate(certificate.issuedAt)}</span><span className="text-slate-600 md:col-span-2">{formatDate(certificate.validUntil)}</span><span className="font-medium text-ink md:col-span-3">{formatDate(certificate.nextCertificationDate)}</span><button aria-label="Изтрий сертификата" className="focus-ring grid h-8 w-8 place-items-center justify-self-end rounded text-red-700 hover:bg-red-50" onClick={() => removeCertificate(certificate)} type="button"><Trash2 className="h-4 w-4" /></button></div>)}</div> : <Empty text="Все още няма добавени сертификати." />}
    </section>

    <section className="border-t border-line pt-6"><h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink"><FileArchive className="h-5 w-5 text-brand" />Генерирани системи</h3>{generatedSystems.length ? <div className="divide-y divide-line overflow-hidden rounded border border-line bg-white shadow-soft">{generatedSystems.map((entry) => <div className="flex flex-col justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center" key={entry.id}><div><p className="text-sm text-ink">{entry.description}</p><p className="mt-1 text-xs text-slate-500">{formatDateTime(entry.eventDate)}{entry.fileName ? ` · ${entry.fileName} · ${formatFileSize(entry.fileSize ?? 0)}` : " · Стар запис без запазен ZIP файл"}</p></div>{entry.filePath && entry.fileName ? <button className="focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded border border-line px-3 py-2 text-sm font-medium text-action hover:bg-panel" onClick={() => downloadStoredFile(entry.filePath!, entry.fileName!)} type="button"><Download className="h-4 w-4" />Изтегли ZIP</button> : null}</div>)}</div> : <Empty text="Все още няма генерирани системи за тази фирма." />}</section>

    <section className="border-t border-line pt-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-base font-semibold text-ink"><FileText className="h-5 w-5 text-brand" />Документи</h3><label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded bg-action px-3 py-2 text-sm font-medium text-white"><Upload className="h-4 w-4" />{saving ? "Качване..." : "Качи файл"}<input className="sr-only" disabled={saving} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCompanyDocument(file); event.target.value = ""; }} type="file" /></label></div>{documents.length ? <div className="divide-y divide-line overflow-hidden rounded border border-line bg-white shadow-soft">{documents.map((document) => <div className="flex flex-col justify-between gap-2 px-4 py-3 sm:flex-row sm:items-center" key={document.id}><div><p className="text-sm font-medium text-ink">{document.title}</p><p className="mt-1 text-xs text-slate-500">Версия {document.version} · Обновен {formatDate(document.updatedAt)}{document.fileName ? ` · ${formatFileSize(document.fileSize ?? 0)}` : ""}</p></div><div className="flex items-center gap-2"><StandardPills standards={document.standards} /><StatusBadge status={document.status} />{document.filePath && document.fileName ? <button aria-label="Изтегли файла" className="focus-ring grid h-9 w-9 place-items-center rounded border border-line text-action hover:bg-panel" onClick={() => downloadStoredFile(document.filePath!, document.fileName!)} title="Изтегли файла" type="button"><Download className="h-4 w-4" /></button> : null}</div></div>)}</div> : <Empty text="Няма документи, свързани с тази фирма." />}</section>

    <section className="border-t border-line pt-6"><h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink"><History className="h-5 w-5 text-brand" />История на промените</h3>{sortedHistory.length ? <ol className="border-l border-line pl-5">{sortedHistory.map((entry) => <li className="relative pb-5 last:pb-0" key={entry.id}><span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-brand" /><p className="text-sm text-ink">{entry.description}</p><p className="mt-1 text-xs text-slate-500">{formatDateTime(entry.eventDate)}</p></li>)}</ol> : <Empty text="Историята ще започне при следващото записано действие." />}</section>
  </div>;
}

function Summary({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string | number }) { return <div className="min-h-[110px] rounded-lg border border-line bg-white p-5 shadow-soft"><div className="mb-4 flex items-center justify-between"><p className="text-sm text-slate-500">{label}</p><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-action"><Icon className="h-4 w-4" /></span></div><p className="text-xl font-bold text-ink">{value}</p></div>; }
function Data({ label, value }: { label: string; value?: string }) { return <div><dt className="text-xs font-medium uppercase text-slate-500">{label}</dt><dd className="mt-1 text-ink">{value || "Не е посочено"}</dd></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded border border-dashed border-line bg-white py-8 text-center text-sm text-slate-500">{text}</div>; }
function Notice({ title, text }: { title: string; text: string }) { return <div className="mx-auto max-w-xl py-20 text-center"><h2 className="text-lg font-semibold text-ink">{title}</h2><p className="mt-2 text-sm text-slate-500">{text}</p><Link className="mt-5 inline-flex items-center gap-2 rounded bg-action px-4 py-2 text-sm font-medium text-white" href="/organizations"><ArrowLeft className="h-4 w-4" />Към фирмите</Link></div>; }
function Field({ label, children }: { label: string; children: React.ReactElement<{ className?: string }> }) { return <label className="grid gap-1.5 text-sm font-medium text-ink">{label}{cloneElement(children, { className: `focus-ring h-10 rounded border border-line bg-white px-3 font-normal outline-none ${children.props.className ?? ""}` })}</label>; }
function makeId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `record-${Date.now()}`; }
function formatDate(value: string) { return value ? new Intl.DateTimeFormat("bg-BG").format(new Date(`${value}T00:00:00`)) : "Не е зададена"; }
function formatOptionalDate(value?: string) { return value ? formatDate(value) : ""; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatFileSize(value: number) { if (!value) return "0 KB"; if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`; return `${(value / 1024 / 1024).toFixed(1)} MB`; }
function safeFileName(value: string) { return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 140) || "file"; }

type OrganizationRow = {
  id: string; name: string; uic: string; legal_form: string | null; address: string | null; city: string | null;
  manager: string | null; founded_at: string | null; representative: string | null; contact_name: string | null;
  contact_phone: string | null; contact_email: string | null; employees_count: number; activity: string | null;
  physical_scope: string | null; system_date: string | null; organization_context: string | null;
  processes_description: string | null; products_services: string | null; environmental_aspects: string | null;
  occupational_risks: string | null; external_parties: string | null; waste_management: string | null;
  design_development: Organization["designDevelopment"] | null; post_delivery_activities: string | null;
  training_details: string | null; internal_audit_date: string | null;
  management_review_date: string | null; previous_year: number | null; current_year: number | null;
  sites_count: number; standards: IsoStandardCode[] | null; status: OrganizationStatus; readiness_percent: number;
  next_audit_date: string | null;
};
type CertificateRow = { id: string; organization_id: string; standard: IsoStandardCode; certificate_number: string | null; certification_body: string | null; issued_at: string | null; valid_until: string | null; next_certification_date: string | null; notes: string | null; created_at: string };
type HistoryRow = { id: string; organization_id: string; event_type: OrganizationHistoryEntry["eventType"]; description: string; event_date: string; file_path: string | null; file_name: string | null; file_size: number | null };
type DocumentRow = { id: string; organization_id: string; title: string; document_type: ImsDocument["type"]; standards: IsoStandardCode[]; owner: string | null; status: DocumentStatus; version: string; content: { body?: string } | string | null; updated_at: string; file_path: string | null; original_filename: string | null; file_size: number | null; mime_type: string | null };

function organizationFromDatabase(value: OrganizationRow): Organization {
  return {
    id: value.id, name: value.name, uic: value.uic, legalForm: value.legal_form ?? "", address: value.address ?? "",
    city: value.city ?? "", manager: value.manager ?? "", foundedAt: value.founded_at ?? "",
    representative: value.representative ?? "", contactName: value.contact_name ?? "",
    contactPhone: value.contact_phone ?? "", contactEmail: value.contact_email ?? "",
    employees: value.employees_count ?? 0, activity: value.activity ?? "", physicalScope: value.physical_scope ?? "",
    systemDate: value.system_date ?? "", organizationContext: value.organization_context ?? "",
    processesDescription: value.processes_description ?? "", productsServices: value.products_services ?? "",
    environmentalAspects: value.environmental_aspects ?? "", occupationalRisks: value.occupational_risks ?? "",
    externalParties: value.external_parties ?? "", wasteManagement: value.waste_management ?? "",
    designDevelopment: value.design_development ?? "", postDeliveryActivities: value.post_delivery_activities ?? "",
    trainingDetails: value.training_details ?? "",
    internalAuditDate: value.internal_audit_date ?? "", managementReviewDate: value.management_review_date ?? "",
    previousYear: value.previous_year ?? undefined, currentYear: value.current_year ?? undefined,
    sites: value.sites_count ?? 1, standards: value.standards ?? [], status: value.status,
    readiness: value.readiness_percent ?? 0, nextAuditDate: value.next_audit_date ?? ""
  };
}
function certificateFromDatabase(value: CertificateRow): OrganizationCertificate { return { id: value.id, organizationId: value.organization_id, standard: value.standard, certificateNumber: value.certificate_number ?? "", certificationBody: value.certification_body ?? "", issuedAt: value.issued_at ?? "", validUntil: value.valid_until ?? "", nextCertificationDate: value.next_certification_date ?? "", notes: value.notes ?? "", createdAt: value.created_at }; }
function certificateToDatabase(value: OrganizationCertificate) { return { id: value.id, organization_id: value.organizationId, standard: value.standard, certificate_number: value.certificateNumber.trim(), certification_body: value.certificationBody.trim() || null, issued_at: value.issuedAt || null, valid_until: value.validUntil || null, next_certification_date: value.nextCertificationDate || null, notes: value.notes.trim() || null, created_at: value.createdAt }; }
function historyFromDatabase(value: HistoryRow): OrganizationHistoryEntry { return { id: value.id, organizationId: value.organization_id, eventType: value.event_type, description: value.description, eventDate: value.event_date, filePath: value.file_path ?? undefined, fileName: value.file_name ?? undefined, fileSize: value.file_size ?? undefined }; }
function documentFromDatabase(value: DocumentRow): ImsDocument { return { id: value.id, organizationId: value.organization_id, title: value.title, type: value.document_type, standards: value.standards ?? [], owner: value.owner ?? "", status: value.status, version: value.version, updatedAt: value.updated_at.slice(0, 10), content: typeof value.content === "string" ? value.content : value.content?.body ?? "", filePath: value.file_path ?? undefined, fileName: value.original_filename ?? undefined, fileSize: value.file_size ?? undefined, mimeType: value.mime_type ?? undefined }; }
function documentToDatabase(value: ImsDocument) { return { id: value.id, organization_id: value.organizationId, title: value.title.trim(), document_type: value.type, standards: value.standards, owner: value.owner.trim() || null, status: value.status, version: value.version, content: { body: value.content ?? "" }, file_path: value.filePath ?? null, original_filename: value.fileName ?? null, file_size: value.fileSize ?? null, mime_type: value.mimeType ?? null }; }
