"use client";

import { AlertTriangle, Check, CheckCheck, FileArchive, Loader2, Pencil, Sparkles, X } from "lucide-react";
import type { AiDocumentReview, AiReviewSuggestion } from "@/lib/ai-document-review";

export type EditableAiReviewSuggestion = AiReviewSuggestion & {
  status: "pending" | "accepted" | "rejected";
};

export function AiDocumentReviewDialog({
  review,
  suggestions,
  cached,
  generating,
  onChange,
  onClose,
  onGenerate
}: {
  review: AiDocumentReview;
  suggestions: EditableAiReviewSuggestion[];
  cached: boolean;
  generating: boolean;
  onChange: (value: EditableAiReviewSuggestion[]) => void;
  onClose: () => void;
  onGenerate: () => void;
}) {
  const accepted = suggestions.filter((item) => item.status === "accepted" && item.suggested.trim() && item.suggested.trim() !== item.original).length;
  const pending = suggestions.filter((item) => item.status === "pending").length;
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
    <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-line bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div><p className="text-xs font-semibold uppercase text-teal-700">AI преглед преди генериране</p><h3 className="mt-1 text-lg font-semibold text-ink">Смислови и езикови предложения</h3></div>
        <button aria-label="Затвори AI прегледа" className="focus-ring grid h-9 w-9 place-items-center rounded hover:bg-panel" onClick={onClose} type="button"><X className="h-5 w-5" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-5">
        <AiDocumentReviewPanel cached={cached} onChange={onChange} review={review} suggestions={suggestions} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
        <p className="text-xs text-slate-600">{accepted} приети корекции{pending ? ` · ${pending} чакат решение` : ""}</p>
        <div className="flex gap-3">
          <button className="focus-ring rounded border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink" onClick={onClose} type="button">Затвори</button>
          <button className="focus-ring inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={generating} onClick={onGenerate} type="button">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}{generating ? "Генериране..." : `Генерирай ZIP с ${accepted} корекции`}</button>
        </div>
      </div>
    </div>
  </div>;
}

export function AiDocumentReviewPanel({
  review,
  suggestions,
  cached,
  onChange
}: {
  review: AiDocumentReview;
  suggestions: EditableAiReviewSuggestion[];
  cached: boolean;
  onChange: (value: EditableAiReviewSuggestion[]) => void;
}) {
  const accepted = suggestions.filter((item) => item.status === "accepted").length;
  const rejected = suggestions.filter((item) => item.status === "rejected").length;
  const pending = suggestions.length - accepted - rejected;

  function update(id: string, patch: Partial<EditableAiReviewSuggestion>) {
    onChange(suggestions.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function setAll(status: EditableAiReviewSuggestion["status"]) {
    onChange(suggestions.map((item) => ({ ...item, status })));
  }

  return <section className="overflow-hidden rounded-lg border border-teal-200 bg-white">
    <div className="border-b border-teal-200 bg-teal-50 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-teal-950"><Sparkles className="h-4 w-4" />AI смислов и езиков преглед</p>
          <p className="mt-1 text-xs text-teal-800">{review.reviewedFiles} файла · {review.reviewedSegments} текстови части · {review.model || "Cloudflare Workers AI"}{cached ? " · кеширан резултат" : ""}</p>
        </div>
        {suggestions.length ? <div className="flex gap-2">
          <button className="focus-ring inline-flex h-9 items-center gap-2 rounded border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50" onClick={() => setAll("accepted")} type="button"><CheckCheck className="h-4 w-4" />Приеми всички</button>
          <button className="focus-ring inline-flex h-9 items-center gap-2 rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setAll("rejected")} type="button"><X className="h-4 w-4" />Откажи всички</button>
        </div> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
        <span className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-700">Чакащи {pending}</span>
        <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">Приети {accepted}</span>
        <span className="rounded border border-red-200 bg-red-50 px-2 py-1 text-red-700">Отказани {rejected}</span>
      </div>
    </div>

    {review.warnings.length ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{review.warnings.map((warning) => <p className="flex items-start gap-2" key={warning}><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{warning}</p>)}</div> : null}

    {!suggestions.length ? <p className="px-4 py-6 text-center text-sm font-medium text-emerald-800">AI не откри необходими смислови или езикови корекции.</p> : <div className="max-h-[52vh] divide-y divide-slate-200 overflow-y-auto">
      {suggestions.map((item, index) => <article className={item.status === "accepted" ? "bg-emerald-50/40 p-4" : item.status === "rejected" ? "bg-slate-50 p-4 opacity-75" : "p-4"} key={item.id}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-all text-xs font-semibold text-ink">{index + 1}. {item.file}</p>
            <p className="mt-1 text-xs text-slate-500">{categoryLabel(item.category)} · увереност {Math.round(item.confidence * 100)}%</p>
          </div>
          <span className={item.status === "accepted" ? "rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800" : item.status === "rejected" ? "rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700" : "rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800"}>{statusLabel(item.status)}</span>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Оригинален текст</p>
            <div className="max-h-44 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">{item.original}</div>
          </div>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase text-teal-700"><Pencil className="h-3.5 w-3.5" />Редактируем предложен текст</span>
            <textarea className="focus-ring min-h-44 w-full rounded border border-teal-300 bg-white p-3 text-xs leading-5 text-ink outline-none" onChange={(event) => update(item.id, { suggested: event.target.value, status: item.status === "rejected" ? "pending" : item.status })} value={item.suggested} />
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-600"><span className="font-semibold text-ink">Причина:</span> {item.reason}</p>
        <div className="mt-3 flex justify-end gap-2">
          <button className="focus-ring inline-flex h-9 items-center gap-2 rounded border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50" onClick={() => update(item.id, { status: "rejected" })} type="button"><X className="h-4 w-4" />Откажи</button>
          <button className="focus-ring inline-flex h-9 items-center gap-2 rounded bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700" disabled={!item.suggested.trim() || item.suggested.trim() === item.original} onClick={() => update(item.id, { status: "accepted", suggested: item.suggested.trim() })} type="button"><Check className="h-4 w-4" />Приеми</button>
        </div>
      </article>)}
    </div>}
  </section>;
}

function categoryLabel(value: AiReviewSuggestion["category"]) {
  return ({ language: "Език", context: "Фирмен контекст", consistency: "Съгласуваност", risk: "Риск за преглед" })[value];
}

function statusLabel(value: EditableAiReviewSuggestion["status"]) {
  return ({ pending: "Чака решение", accepted: "Приета", rejected: "Отказана" })[value];
}
