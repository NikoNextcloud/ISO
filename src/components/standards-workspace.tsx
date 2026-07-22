"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, ShieldCheck } from "lucide-react";
import { Iso27001ExportWorkspace } from "@/components/iso27001-export-workspace";
import { Iso45001ExportWorkspace } from "@/components/iso45001-export-workspace";
import { Section } from "@/components/ui";
import { documents as localDocuments, standards } from "@/lib/mock-data";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { DocumentStatus, IsoStandardCode } from "@/lib/types";

type DocumentMetricRow = { standards: IsoStandardCode[]; status: DocumentStatus };
type StandardMetric = { documents: number; approvedPercent: number };

const templateCounts: Partial<Record<IsoStandardCode, number>> = { "ISO 27001": 84, "ISO 45001": 60 };

export function StandardsWorkspace() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [openStandard, setOpenStandard] = useState<IsoStandardCode | null>(null);
  const [metrics, setMetrics] = useState(() => calculateMetrics(localDocuments));
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { setLoading(false); return; }
      const result = await supabase.from("documents").select("standards,status");
      if (result.error) setError(`Реалната статистика не беше заредена: ${result.error.message}`);
      else setMetrics(calculateMetrics((result.data ?? []) as DocumentMetricRow[]));
      setLoading(false);
    });
  }, [supabase]);

  return <Section id="standards" title="Стандарти" description="Реални данни от документите в Supabase и наличните системни шаблони.">
    {error ? <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {standards.map((standard) => {
        const available = standard.code === "ISO 27001" || standard.code === "ISO 45001";
        const selected = available && openStandard === standard.code;
        const metric = metrics[standard.code] ?? { documents: 0, approvedPercent: 0 };
        const templates = templateCounts[standard.code] ?? 0;
        const content = <>
          <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand" /><h3 className="text-sm font-semibold text-ink">{standard.code}</h3>{available ? (selected ? <ChevronUp className="ml-auto h-4 w-4 text-action" /> : <ChevronDown className="ml-auto h-4 w-4 text-action" />) : null}</div>
          <p className="min-h-16 text-sm text-slate-600">{standard.title}</p>
          <p className="mt-3 text-xs text-slate-500">{standard.scope}</p>
          {templates ? <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700"><CheckCircle2 className="h-3.5 w-3.5" />{templates} налични шаблона</p> : <p className="mt-3 text-xs font-medium text-slate-400">Няма добавени шаблони</p>}
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-slate-500"><span>{metric.documents} {metric.documents === 1 ? "документ" : "документа"}</span><span className="font-semibold text-ink">{metric.approvedPercent}% одобрени</span></div>
        </>;

        return available
          ? <button aria-expanded={selected} className={`focus-ring min-h-[235px] w-full rounded-lg border p-5 text-left shadow-soft transition-all ${selected ? "border-blue-500 bg-blue-50 shadow-[0_14px_34px_rgba(37,99,235,0.12)]" : "border-line bg-white hover:border-blue-300 hover:shadow-lg"}`} key={standard.code} onClick={() => setOpenStandard((current) => current === standard.code ? null : standard.code)} type="button">{content}</button>
          : <div className="min-h-[235px] rounded-lg border border-line bg-white p-5 shadow-soft" key={standard.code}>{content}</div>;
      })}
    </div>
    {loading ? <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Обновяване на реалната статистика...</p> : null}
    {openStandard === "ISO 27001" ? <div className="mt-7 border-t border-line pt-7"><Iso27001ExportWorkspace /></div> : null}
    {openStandard === "ISO 45001" ? <div className="mt-7 border-t border-line pt-7"><Iso45001ExportWorkspace /></div> : null}
  </Section>;
}

function calculateMetrics(rows: DocumentMetricRow[]) {
  return standards.reduce((result, standard) => {
    const related = rows.filter((document) => document.standards?.includes(standard.code));
    const approved = related.filter((document) => document.status === "approved").length;
    result[standard.code] = { documents: related.length, approvedPercent: related.length ? Math.round((approved / related.length) * 100) : 0 };
    return result;
  }, {} as Record<IsoStandardCode, StandardMetric>);
}
