"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { Iso27001ExportWorkspace } from "@/components/iso27001-export-workspace";
import { Section } from "@/components/ui";
import { standards } from "@/lib/mock-data";

export function StandardsWorkspace() {
  const [iso27001Open, setIso27001Open] = useState(false);

  return <Section id="standards" title="Стандарти" description="Изберете стандарт, за да отворите наличната система и документация.">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {standards.map((standard) => {
        const available = standard.code === "ISO 27001";
        const selected = available && iso27001Open;
        const content = <>
          <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand" /><h3 className="text-sm font-semibold text-ink">{standard.code}</h3>{available ? (selected ? <ChevronUp className="ml-auto h-4 w-4 text-action" /> : <ChevronDown className="ml-auto h-4 w-4 text-action" />) : null}</div>
          <p className="min-h-16 text-sm text-slate-600">{standard.title}</p>
          <p className="mt-3 text-xs text-slate-500">{standard.scope}</p>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{standard.documents} документа</span><span>{standard.sharedCoverage}% общи</span></div>
        </>;

        return available
          ? <button aria-expanded={selected} className={`focus-ring min-h-[210px] w-full rounded-lg border p-5 text-left shadow-soft transition-all ${selected ? "border-blue-500 bg-blue-50 shadow-[0_14px_34px_rgba(37,99,235,0.12)]" : "border-line bg-white hover:border-blue-300 hover:shadow-lg"}`} key={standard.code} onClick={() => setIso27001Open((current) => !current)} type="button">{content}</button>
          : <div className="min-h-[210px] rounded-lg border border-line bg-white p-5 shadow-soft" key={standard.code}>{content}</div>;
      })}
    </div>
    {iso27001Open ? <div className="mt-7 border-t border-line pt-7"><Iso27001ExportWorkspace /></div> : null}
  </Section>;
}
