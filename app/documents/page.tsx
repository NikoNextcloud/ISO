"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, Empty, inputCls, StatusPill, StdChips } from "@/components/ui";
import { DOC_STATUSES, DOC_TYPES, DocStatus, DocType } from "@/lib/types";

export default function DocumentsPage() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | DocStatus>("");
  const [type, setType] = useState<"" | DocType>("");
  const [clientId, setClientId] = useState("");

  const docs = state.documents.filter((d) => {
    if (clientId && d.clientId !== clientId) return false;
    if (status && d.status !== status) return false;
    if (type && d.type !== type) return false;
    if (q && !(d.title + " " + d.code + " " + d.content).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Документи</h1>
        <p className="text-sm text-ink-faint">{state.documents.length} документа във всички системи · пълнотекстово търсене</p>
      </div>

      <Card className="px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <input className={inputCls} placeholder="Търсене по код, име или съдържание…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={inputCls} value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Всички клиенти</option>
            {state.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as DocType | "")}>
            <option value="">Всички типове</option>
            {(Object.keys(DOC_TYPES) as DocType[]).map((t) => <option key={t} value={t}>{DOC_TYPES[t]}</option>)}
          </select>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as DocStatus | "")}>
            <option value="">Всички статуси</option>
            {(Object.keys(DOC_STATUSES) as DocStatus[]).map((s) => <option key={s} value={s}>{DOC_STATUSES[s]}</option>)}
          </select>
        </div>
      </Card>

      <Card>
        <div className="divide-y divide-line">
          {docs.map((d) => {
            const c = state.clients.find((x) => x.id === d.clientId);
            return (
              <Link key={d.id} href={`/document?id=${d.id}`} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm hover:bg-paper">
                <span className="w-16 shrink-0 font-mono text-xs font-bold text-seal">{d.code}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{d.title}</div>
                  <div className="text-xs text-ink-faint">{c?.name} · {DOC_TYPES[d.type]}</div>
                </div>
                <StdChips codes={d.standards} small />
                <StatusPill status={d.status} />
                <span className="font-mono text-xs text-ink-faint">v{d.version} · {d.date}</span>
              </Link>
            );
          })}
          {docs.length === 0 && <Empty title="Няма намерени документи" sub="Променете филтрите или генерирайте система за клиент." />}
        </div>
      </Card>
    </div>
  );
}
