import type { LucideIcon } from "lucide-react";
import { statusClass, statusLabel } from "@/lib/format";

export function Section({
  id,
  title,
  description,
  children
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="scroll-mt-20 py-5" id={id}>
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default"
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning";
}) {
  const toneClass =
    tone === "success" ? "bg-emerald-50 text-emerald-700" : tone === "warning" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-action";

  return (
    <div className="rounded border border-line bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        <span className={`grid h-9 w-9 place-items-center rounded ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const knownStatus = status as Parameters<typeof statusClass>[0];

  return <span className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${statusClass(knownStatus)}`}>{statusLabel(knownStatus)}</span>;
}

export function StandardPills({ standards }: { standards: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {standards.map((standard) => (
        <span className="rounded border border-line bg-panel px-2 py-1 text-xs font-medium text-slate-700" key={standard}>
          {standard}
        </span>
      ))}
    </div>
  );
}
