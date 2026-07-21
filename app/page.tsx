"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Bar, Card, CardHead, Gauge, Stat, StdChips, StatusPill } from "@/components/ui";
import { AUDIT_TYPES, clientReadiness, riskLabel } from "@/lib/types";

export default function Dashboard() {
  const { state } = useStore();
  const { clients, audits, ncs, tasks, documents, risks, notices, objectives } = state;

  const openNc = ncs.filter((n) => n.status !== "closed");
  const openCapa = ncs.filter((n) => n.status === "in_progress");
  const openTasks = tasks.filter((t) => t.status === "open");
  const upcomingAudits = audits.filter((a) => a.status !== "done").sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  const expiring = clients.filter((c) => c.certExpiry && (new Date(c.certExpiry).getTime() - Date.now()) / 86400000 < 90);
  const avgReadiness = clients.length ? Math.round(clients.reduce((s, c) => s + clientReadiness(state, c.id), 0) / clients.length) : 0;
  const aiSuggestions = notices.filter((n) => n.kind === "ai").slice(0, 3);
  const highRisks = risks.filter((r) => r.probability * r.impact >= 15);
  const recentDocs = [...documents].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  const statusCounts = ["draft", "review", "approved", "active"].map((s) => ({
    s, n: documents.filter((d) => d.status === s).length,
  }));
  const maxCount = Math.max(1, ...statusCounts.map((x) => x.n));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Табло</h1>
          <p className="text-sm text-ink-faint">Обобщено състояние на всички системи за управление</p>
        </div>
        <Link href="/clients/new" className="rounded-lg bg-seal px-4 py-2 text-sm font-semibold text-white hover:bg-seal-hover">+ Нов клиент</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Фирми" value={clients.length} />
        <Stat label="Активни проекти" value={clients.filter((c) => c.generated).length} />
        <Stat label="Средна готовност" value={`${avgReadiness}%`} tone={avgReadiness >= 80 ? "#1E7A46" : "#A16207"} />
        <Stat label="Предстоящи одити" value={upcomingAudits.length} />
        <Stat label="Несъответствия" value={openNc.length} tone={openNc.length ? "#B42318" : "#1E7A46"} />
        <Stat label="Коригиращи действия" value={openCapa.length} />
        <Stat label="Отворени задачи" value={openTasks.length} />
        <Stat label="Изтичащи сертификати" value={expiring.length} tone={expiring.length ? "#B45309" : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHead title="Готовност по клиенти" sub="Изчислена от статуса на документацията и отворените несъответствия" />
          <div className="divide-y divide-line">
            {clients.map((c) => (
              <Link key={c.id} href={`/client?id=${c.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-paper">
                <Gauge value={clientReadiness(state, c.id)} size={64} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{c.name}</div>
                  <div className="mt-1"><StdChips codes={c.standards} small /></div>
                </div>
                <div className="hidden text-right text-xs text-ink-faint sm:block">
                  {c.employees} служители<br />{c.integrated ? "Интегрирана система" : "Отделни стандарти"}
                </div>
              </Link>
            ))}
            {clients.length === 0 && <p className="px-5 py-6 text-sm text-ink-faint">Все още няма клиенти. Създайте първия от бутона „Нов клиент“.</p>}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHead title="AI предложения" />
            <div className="space-y-2 px-5 py-3">
              {aiSuggestions.length === 0 && <p className="text-sm text-ink-faint">Няма нови предложения.</p>}
              {aiSuggestions.map((n) => (
                <p key={n.id} className="rounded-lg bg-s27001-tint px-3 py-2 text-sm text-ink"><span className="mr-1 text-s27001">✦</span>{n.text}</p>
              ))}
            </div>
          </Card>
          <Card>
            <CardHead title="Документи по статус" />
            <div className="space-y-2.5 px-5 py-4">
              {statusCounts.map(({ s, n }) => (
                <div key={s} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0 text-xs font-semibold text-ink-soft">{s === "draft" ? "Чернова" : s === "review" ? "Преглед" : s === "approved" ? "Одобрен" : "Активен"}</span>
                  <div className="flex-1"><Bar value={(n / maxCount) * 100} tone={s === "active" ? "#1E7A46" : s === "approved" ? "#2456A6" : s === "review" ? "#A16207" : "#94A3B8"} /></div>
                  <span className="w-6 text-right text-xs font-bold">{n}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHead title="Предстоящи одити" />
          <div className="divide-y divide-line">
            {upcomingAudits.slice(0, 5).map((a) => {
              const c = clients.find((x) => x.id === a.clientId);
              return (
                <Link key={a.id} href={`/client?id=${a.clientId}&tab=audits`} className="block px-5 py-3 hover:bg-paper">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{AUDIT_TYPES[a.type]}</span>
                    <span className="font-mono text-xs text-ink-faint">{a.plannedDate}</span>
                  </div>
                  <div className="text-xs text-ink-faint">{c?.name}</div>
                </Link>
              );
            })}
            {upcomingAudits.length === 0 && <p className="px-5 py-5 text-sm text-ink-faint">Няма планирани одити.</p>}
          </div>
        </Card>

        <Card>
          <CardHead title="Отворени задачи" />
          <div className="divide-y divide-line">
            {openTasks.slice(0, 5).map((t) => {
              const overdue = t.dueDate < new Date().toISOString().slice(0, 10);
              return (
                <div key={t.id} className="px-5 py-3 text-sm">
                  <div className="font-semibold">{t.title}</div>
                  <div className={`text-xs ${overdue ? "font-bold text-danger" : "text-ink-faint"}`}>
                    Срок: {t.dueDate}{overdue && " · Просрочена"} · {t.assignee}
                  </div>
                </div>
              );
            })}
            {openTasks.length === 0 && <p className="px-5 py-5 text-sm text-ink-faint">Няма отворени задачи.</p>}
          </div>
        </Card>

        <Card>
          <CardHead title="Високи рискове" sub="Ниво ≥ 15 — изискват незабавни мерки" />
          <div className="divide-y divide-line">
            {highRisks.slice(0, 5).map((r) => {
              const lvl = r.probability * r.impact;
              const { label } = riskLabel(lvl);
              return (
                <div key={r.id} className="flex items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span className="font-semibold">{r.title}</span>
                  <span className="shrink-0 rounded bg-danger/10 px-2 py-0.5 text-xs font-bold text-danger">{lvl} · {label}</span>
                </div>
              );
            })}
            {highRisks.length === 0 && <p className="px-5 py-5 text-sm text-ink-faint">Няма високи рискове. Отлично.</p>}
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Последни промени по документи" />
        <div className="divide-y divide-line">
          {recentDocs.map((d) => (
            <Link key={d.id} href={`/document?id=${d.id}`} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm hover:bg-paper">
              <span className="font-mono text-xs font-semibold text-seal">{d.code}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{d.title}</span>
              <StatusPill status={d.status} />
              <span className="font-mono text-xs text-ink-faint">v{d.version} · {d.date}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
