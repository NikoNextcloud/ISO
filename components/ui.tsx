"use client";
import React from "react";
import { DOC_STATUSES, DocStatus, StandardCode, STANDARDS } from "@/lib/types";

export const STD_COLORS: Record<StandardCode, { bg: string; text: string; dot: string }> = {
  "9001": { bg: "bg-s9001-tint", text: "text-s9001", dot: "bg-s9001" },
  "14001": { bg: "bg-s14001-tint", text: "text-s14001", dot: "bg-s14001" },
  "45001": { bg: "bg-s45001-tint", text: "text-s45001", dot: "bg-s45001" },
  "27001": { bg: "bg-s27001-tint", text: "text-s27001", dot: "bg-s27001" },
  "50001": { bg: "bg-s50001-tint", text: "text-s50001", dot: "bg-s50001" },
};

export function StdChip({ code, small }: { code: StandardCode; small?: boolean }) {
  const c = STD_COLORS[code];
  return (
    <span className={`inline-flex items-center gap-1 rounded ${c.bg} ${c.text} font-semibold ${small ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {STANDARDS[code].name}
    </span>
  );
}

export function StdChips({ codes, small }: { codes: StandardCode[]; small?: boolean }) {
  return <span className="inline-flex flex-wrap gap-1">{codes.map((c) => <StdChip key={c} code={c} small={small} />)}</span>;
}

const STATUS_STYLE: Record<DocStatus, string> = {
  draft: "bg-paper text-ink-faint border border-line",
  review: "bg-s50001-tint text-s50001",
  approved: "bg-s9001-tint text-s9001",
  active: "bg-s14001-tint text-s14001",
  archived: "bg-line text-ink-faint",
};

export function StatusPill({ status }: { status: DocStatus }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>{DOC_STATUSES[status]}</span>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-white shadow-card ${className}`}>{children}</div>;
}

export function CardHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
      <div>
        <h2 className="text-[15px] font-bold">{title}</h2>
        {sub && <p className="text-xs text-ink-faint mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Button({ children, onClick, variant = "primary", type = "button", disabled, className = "" }: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger" | "subtle";
  type?: "button" | "submit"; disabled?: boolean; className?: string;
}) {
  const v =
    variant === "primary" ? "bg-seal text-white hover:bg-seal-hover" :
    variant === "danger" ? "bg-danger text-white hover:opacity-90" :
    variant === "subtle" ? "bg-seal-tint text-seal hover:bg-seal/15" :
    "bg-white border border-line text-ink hover:bg-paper";
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${v} ${className}`}>
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm placeholder:text-ink-faint";

export function Gauge({ value, size = 92, label }: { value: number; size?: number; label?: string }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  const tone = value >= 80 ? "#1E7A46" : value >= 50 ? "#A16207" : "#B42318";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E7EE" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <div className="absolute text-center">
        <div className="text-lg font-extrabold leading-none">{value}%</div>
        {label && <div className="text-[10px] text-ink-faint mt-0.5">{label}</div>}
      </div>
    </div>
  );
}

export function Bar({ value, tone = "#17456E" }: { value: number; tone?: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-line">
      <div className="h-2 rounded-full" style={{ width: `${Math.min(100, value)}%`, background: tone }} />
    </div>
  );
}

export function Empty({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="text-2xl">◻</div>
      <p className="font-semibold">{title}</p>
      {sub && <p className="max-w-sm text-sm text-ink-faint">{sub}</p>}
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className={`max-h-[88vh] w-full ${wide ? "max-w-3xl" : "max-w-lg"} overflow-auto rounded-xl bg-white p-5 shadow-pop`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-ink-faint hover:bg-paper" aria-label="Затвори">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <Card className="px-4 py-3">
      <div className="text-[26px] font-extrabold leading-tight" style={tone ? { color: tone } : undefined}>{value}</div>
      <div className="text-xs font-medium text-ink-faint">{label}</div>
    </Card>
  );
}
