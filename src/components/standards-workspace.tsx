"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, ShieldCheck } from "lucide-react";
import { Iso9001ExportWorkspace } from "@/components/iso9001-export-workspace";
import { Iso14001ExportWorkspace } from "@/components/iso14001-export-workspace";
import { Iso27001ExportWorkspace } from "@/components/iso27001-export-workspace";
import { Iso45001ExportWorkspace } from "@/components/iso45001-export-workspace";
import { Iso50001ExportWorkspace } from "@/components/iso50001-export-workspace";
import { Iso902027ExportWorkspace } from "@/components/iso902027-export-workspace";
import { Iso914ExportWorkspace } from "@/components/iso914-export-workspace";
import { Iso90011400145001ExportWorkspace } from "@/components/iso90011400145001-export-workspace";
import { TemplateManager } from "@/components/template-manager";
import { Section } from "@/components/ui";
import { documents as localDocuments, standards } from "@/lib/mock-data";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { DocumentStatus, IsoStandardCode } from "@/lib/types";

type DocumentMetricRow = { standards: IsoStandardCode[]; status: DocumentStatus };
type StandardMetric = { documents: number; approvedPercent: number };
type StandardCardCode = IsoStandardCode | "ISO 9-20-27" | "ISO 9-14";

const integratedStandard = {
  code: "ISO 9-20-27" as const,
  title: "Интегрирана система за качество, услуги и информационна сигурност",
  scope: "ISO 9001, ISO/IEC 20000-1 и ISO/IEC 27001 в обща система."
};
const integrated90011400145001Standard = {
  code: "ISO 9001-14001-45001" as const,
  title: "Интегрирана система за качество, околна среда и здраве и безопасност при работа",
  scope: "Пълен комплект по ISO 9001, ISO 14001 и ISO 45001 с наръчник, процедури, записи и одитна подготовка."
};
const integrated914Standard = {
  code: "ISO 9-14" as const,
  title: "Интегрирана система за качество и околна среда",
  scope: "ISO 9001 и ISO 14001 в обща система."
};
const standardCards = [...standards, integratedStandard, integrated90011400145001Standard, integrated914Standard];
const templateCounts: Partial<Record<StandardCardCode, number>> = { "ISO 9001": 31, "ISO 14001": 12, "ISO 27001": 84, "ISO 45001": 60, "ISO 50001": 24, "ISO 9-20-27": 271, "ISO 9001-14001-45001": 63, "ISO 9-14": 34 };

export function StandardsWorkspace() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [openStandard, setOpenStandard] = useState<StandardCardCode | null>(null);
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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {standardCards.map((standard) => {
        const available = true;
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
    {openStandard ? <div className="mt-7 border-t border-line pt-7"><TemplateManager standard={openStandard} />
      {openStandard === "ISO 9001" ? <Iso9001ExportWorkspace /> : null}
      {openStandard === "ISO 14001" ? <Iso14001ExportWorkspace /> : null}
      {openStandard === "ISO 27001" ? <Iso27001ExportWorkspace /> : null}
      {openStandard === "ISO 45001" ? <Iso45001ExportWorkspace /> : null}
      {openStandard === "ISO 50001" ? <Iso50001ExportWorkspace /> : null}
      {openStandard === "ISO 9-20-27" ? <Iso902027ExportWorkspace /> : null}
      {openStandard === "ISO 9001-14001-45001" ? <Iso90011400145001ExportWorkspace /> : null}
      {openStandard === "ISO 9-14" ? <Iso914ExportWorkspace /> : null}
    </div> : null}
  </Section>;
}

function calculateMetrics(rows: DocumentMetricRow[]) {
  const result = standards.reduce((metrics, standard) => {
    const related = rows.filter((document) => document.standards?.includes(standard.code));
    const approved = related.filter((document) => document.status === "approved").length;
    metrics[standard.code] = { documents: related.length, approvedPercent: related.length ? Math.round((approved / related.length) * 100) : 0 };
    return metrics;
  }, {} as Record<StandardCardCode, StandardMetric>);
  const integrated = rows.filter((document) => document.standards?.includes("ISO 9001") && document.standards.includes("ISO 27001"));
  const approved = integrated.filter((document) => document.status === "approved").length;
  result["ISO 9-20-27"] = { documents: integrated.length, approvedPercent: integrated.length ? Math.round((approved / integrated.length) * 100) : 0 };
  const integrated90011400145001 = rows.filter((document) => document.standards?.includes("ISO 9001") && document.standards.includes("ISO 14001") && document.standards.includes("ISO 45001"));
  const approved90011400145001 = integrated90011400145001.filter((document) => document.status === "approved").length;
  result["ISO 9001-14001-45001"] = { documents: integrated90011400145001.length, approvedPercent: integrated90011400145001.length ? Math.round((approved90011400145001 / integrated90011400145001.length) * 100) : 0 };
  const integrated914 = rows.filter((document) => document.standards?.includes("ISO 9001") && document.standards.includes("ISO 14001"));
  const approved914 = integrated914.filter((document) => document.status === "approved").length;
  result["ISO 9-14"] = { documents: integrated914.length, approvedPercent: integrated914.length ? Math.round((approved914 / integrated914.length) * 100) : 0 };
  return result;
}
