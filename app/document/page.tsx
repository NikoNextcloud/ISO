"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useStore } from "@/lib/store";
import { Button, Card, CardHead, Empty, inputCls, StatusPill, StdChips } from "@/components/ui";
import { DOC_FLOW, DOC_STATUSES, DOC_TYPES, DocStatus, today } from "@/lib/types";
import { renderMarkdown } from "@/lib/markdown";

const FLOW_ACTION: Partial<Record<DocStatus, string>> = {
  draft: "Изпрати за преглед",
  review: "Одобри",
  approved: "Активирай",
  active: "Архивирай",
};

function DocumentView() {
  const params = useSearchParams();
  const { state, setState, notify } = useStore();
  const id = params.get("id") || "";
  const doc = state.documents.find((d) => d.id === id);
  const client = doc ? state.clients.find((c) => c.id === doc.clientId) : undefined;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!doc || !client) {
    return <Empty title="Документът не е намерен" action={<Link href="/documents" className="text-sm font-semibold text-seal">← Към документите</Link>} />;
  }

  const advance = () => {
    const idx = DOC_FLOW.indexOf(doc.status);
    if (idx >= DOC_FLOW.length - 1) return;
    const next = DOC_FLOW[idx + 1];
    setState((s) => ({
      ...s,
      documents: s.documents.map((d) => d.id === doc.id ? {
        ...d, status: next,
        history: [...d.history, { version: d.version, date: today(), author: s.settings.userName, note: `Статус: ${DOC_STATUSES[doc.status]} → ${DOC_STATUSES[next]}` }],
      } : d),
    }));
    notify(`${doc.code} ${doc.title}: статус „${DOC_STATUSES[next]}“.`);
  };

  const sign = () => {
    setState((s) => ({
      ...s,
      documents: s.documents.map((d) => d.id === doc.id ? {
        ...d, signedBy: s.settings.userName, signedAt: today(),
        history: [...d.history, { version: d.version, date: today(), author: s.settings.userName, note: "Електронно подписан" }],
      } : d),
    }));
    notify(`${doc.code} е електронно подписан.`);
  };

  const saveEdit = () => {
    const newVersion = (parseFloat(doc.version) + 0.1).toFixed(1);
    setState((s) => ({
      ...s,
      documents: s.documents.map((d) => d.id === doc.id ? {
        ...d, content: draft, version: newVersion, date: today(), status: "draft", signedBy: undefined, signedAt: undefined,
        history: [...d.history, { version: newVersion, date: today(), author: s.settings.userName, note: "Редакция на съдържанието (нова версия, статус Чернова)" }],
      } : d),
    }));
    setEditing(false);
    notify(`${doc.code}: записана версия ${newVersion}.`);
  };

  const related = state.documents.filter((d) => d.clientId === doc.clientId && d.id !== doc.id &&
    (doc.related.some((r) => r.startsWith(d.code)) || d.related.some((r) => r.startsWith(doc.code))));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={`/client?id=${client.id}&tab=documents`} className="text-xs font-semibold text-seal">← {client.name}</Link>
        <div className="flex flex-wrap gap-2">
          {!editing && FLOW_ACTION[doc.status] && <Button onClick={advance}>{FLOW_ACTION[doc.status]}</Button>}
          {!editing && (doc.status === "approved" || doc.status === "active") && !doc.signedBy &&
            <Button variant="subtle" onClick={sign}>✍ Електронен подпис</Button>}
          {!editing && <Button variant="ghost" onClick={() => { setDraft(doc.content); setEditing(true); }}>Редактирай</Button>}
          {!editing && <Button variant="ghost" onClick={() => window.print()}>⎙ Печат / PDF</Button>}
          {editing && <Button onClick={saveEdit}>Запази (нова версия)</Button>}
          {editing && <Button variant="ghost" onClick={() => setEditing(false)}>Отказ</Button>}
        </div>
      </div>

      <Card className="print-area">
        <div className="border-b border-line px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm font-bold text-seal">{doc.code}</span>
            <h1 className="text-lg font-extrabold">{doc.title}</h1>
            <StatusPill status={doc.status} />
          </div>
          <div className="mt-2 grid gap-x-6 gap-y-1 text-xs text-ink-faint sm:grid-cols-2">
            <span>Организация: <b className="text-ink">{client.name}</b> (ЕИК {client.eik})</span>
            <span>Тип: <b className="text-ink">{DOC_TYPES[doc.type]}</b></span>
            <span>Версия: <b className="text-ink">{doc.version}</b> · {doc.date}</span>
            <span>Автор: <b className="text-ink">{doc.author}</b> · Одобрил: <b className="text-ink">{doc.approver}</b></span>
            <span className="sm:col-span-2">Стандарти: <StdChips codes={doc.standards} small /></span>
            {doc.signedBy && <span className="font-semibold text-ok sm:col-span-2">✍ Електронно подписан от {doc.signedBy} на {doc.signedAt}</span>}
          </div>
        </div>
        <div className="px-6 py-5">
          {editing ? (
            <textarea className={`${inputCls} font-mono text-xs`} rows={26} value={draft} onChange={(e) => setDraft(e.target.value)} />
          ) : (
            <div className="doc-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.content) }} />
          )}
        </div>
      </Card>

      <div className="no-print grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title="История на версиите" />
          <div className="divide-y divide-line">
            {[...doc.history].reverse().map((h, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-2 text-sm">
                <span className="font-mono text-xs font-bold text-seal">v{h.version}</span>
                <span className="flex-1">{h.note}</span>
                <span className="text-xs text-ink-faint">{h.author} · {h.date}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHead title="Свързани документи" />
          <div className="divide-y divide-line">
            {related.map((d) => (
              <Link key={d.id} href={`/document?id=${d.id}`} className="flex items-center gap-3 px-5 py-2 text-sm hover:bg-paper">
                <span className="font-mono text-xs font-bold text-seal">{d.code}</span>
                <span className="flex-1 truncate font-semibold">{d.title}</span>
                <StatusPill status={d.status} />
              </Link>
            ))}
            {related.length === 0 && <p className="px-5 py-4 text-sm text-ink-faint">Няма свързани документи.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<p className="text-sm text-ink-faint">Зареждане…</p>}><DocumentView /></Suspense>;
}
