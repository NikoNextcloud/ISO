import type { DocumentStatus, OrganizationStatus, TaskStatus } from "./types";

export function statusLabel(status: OrganizationStatus | DocumentStatus | TaskStatus) {
  const labels: Record<string, string> = {
    draft: "Чернова",
    implementation: "Внедряване",
    ready: "Готово",
    certified: "Сертифицирана",
    attention: "Внимание",
    review: "Преглед",
    approved: "Одобрен",
    needs_update: "За актуализация",
    open: "Отворена",
    in_progress: "В процес",
    overdue: "Просрочена",
    done: "Готова"
  };
  return labels[status] ?? status;
}

export function statusClass(status: OrganizationStatus | DocumentStatus | TaskStatus) {
  if (status === "approved" || status === "ready" || status === "certified" || status === "done") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "attention" || status === "needs_update" || status === "overdue") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-sky-50 text-sky-700 border-sky-200";
}
