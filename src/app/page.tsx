import {
  Bot,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gauge,
  LayoutTemplate,
  Plus,
  Search,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { AppShell } from "@/components/shell";
import { Section, StandardPills, StatCard, StatusBadge } from "@/components/ui";
import { documents, organizations, standards, tasks, templates } from "@/lib/mock-data";

const readinessAverage = Math.round(organizations.reduce((sum, org) => sum + org.readiness, 0) / organizations.length);
const overdueTasks = tasks.filter((task) => task.status === "overdue").length;
const activeDocuments = documents.filter((document) => document.status !== "approved").length;

export default function Home() {
  return (
    <AppShell>
      <Section id="dashboard" title="Dashboard" description="Общ поглед върху внедряването, готовността и критичните действия.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Building2} label="Организации" value={organizations.length} />
          <StatCard icon={Gauge} label="Средна готовност" tone="success" value={`${readinessAverage}%`} />
          <StatCard icon={FileText} label="Документи за работа" value={activeDocuments} />
          <StatCard icon={CalendarClock} label="Просрочени задачи" tone="warning" value={overdueTasks} />
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded border border-line bg-white p-4 shadow-soft">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">Готовност по организации</h3>
              <button className="focus-ring inline-flex items-center gap-2 rounded border border-line bg-white px-3 py-2 text-sm text-slate-700 hover:bg-panel">
                <Plus className="h-4 w-4" />
                Нов клиент
              </button>
            </div>
            <div className="space-y-4">
              {organizations.map((organization) => (
                <div key={organization.id}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-ink">{organization.name}</span>
                    <span className="text-slate-500">{organization.readiness}%</span>
                  </div>
                  <div className="h-2 rounded bg-slate-100">
                    <div className="h-2 rounded bg-brand" style={{ width: `${organization.readiness}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded border border-line bg-white p-4 shadow-soft">
            <h3 className="mb-4 text-sm font-semibold text-ink">Следващи одити</h3>
            <div className="space-y-3">
              {organizations.map((organization) => (
                <div className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-b-0 last:pb-0" key={organization.id}>
                  <div>
                    <p className="text-sm font-medium text-ink">{organization.name}</p>
                    <p className="text-xs text-slate-500">{organization.nextAuditDate}</p>
                  </div>
                  <StatusBadge status={organization.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section id="organizations" title="Организации" description="Регистър на клиенти с избрани стандарти, дейност и статус на внедряване.">
        <div className="mb-3 flex items-center gap-2 rounded border border-line bg-white px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <input className="focus-ring w-full border-0 bg-transparent text-sm outline-none" placeholder="Търсене по фирма, ЕИК, дейност или стандарт" />
        </div>
        <div className="overflow-hidden rounded border border-line bg-white shadow-soft">
          <div className="grid grid-cols-12 gap-3 border-b border-line bg-panel px-4 py-3 text-xs font-semibold uppercase text-slate-500">
            <span className="col-span-4">Фирма</span>
            <span className="col-span-2">ЕИК</span>
            <span className="col-span-3">Стандарти</span>
            <span className="col-span-2">Готовност</span>
            <span className="col-span-1">Статус</span>
          </div>
          {organizations.map((organization) => (
            <div className="grid grid-cols-12 gap-3 border-b border-line px-4 py-4 text-sm last:border-b-0" key={organization.id}>
              <div className="col-span-4">
                <p className="font-medium text-ink">{organization.name}</p>
                <p className="text-xs text-slate-500">{organization.activity}</p>
              </div>
              <span className="col-span-2 text-slate-600">{organization.uic}</span>
              <div className="col-span-3">
                <StandardPills standards={organization.standards} />
              </div>
              <span className="col-span-2 text-slate-600">{organization.readiness}%</span>
              <div className="col-span-1">
                <StatusBadge status={organization.status} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="standards" title="Стандарти" description="База за приложимост, припокриване и специфична документация.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {standards.map((standard) => (
            <div className="rounded border border-line bg-white p-4 shadow-soft" key={standard.code}>
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand" />
                <h3 className="text-sm font-semibold text-ink">{standard.code}</h3>
              </div>
              <p className="min-h-16 text-sm text-slate-600">{standard.title}</p>
              <p className="mt-3 text-xs text-slate-500">{standard.scope}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>{standard.documents} документа</span>
                <span>{standard.sharedCoverage}% общи</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="documents" title="Документи" description="Първи регистър на генерирани и управлявани IMS документи.">
        <div className="grid gap-3">
          {documents.map((document) => (
            <div className="rounded border border-line bg-white p-4 shadow-soft" key={document.id}>
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{document.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Версия {document.version} · Собственик: {document.owner} · Обновен: {document.updatedAt}
                  </p>
                </div>
                <StatusBadge status={document.status} />
              </div>
              <div className="mt-3">
                <StandardPills standards={document.standards} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="templates" title="Шаблони" description="DOCX/PDF генераторът ще използва тези шаблони и placeholder полета.">
        <div className="grid gap-4 md:grid-cols-3">
          {templates.map((template) => (
            <div className="rounded border border-line bg-white p-4 shadow-soft" key={template.id}>
              <div className="mb-3 flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4 text-action" />
                <h3 className="text-sm font-semibold text-ink">{template.title}</h3>
              </div>
              <StandardPills standards={template.standards} />
              <div className="mt-4 flex flex-wrap gap-1.5">
                {template.placeholders.map((placeholder) => (
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600" key={placeholder}>
                    {placeholder}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="tasks" title="Задачи и напомняния" description="Контрол на срокове за одити, обучения, прегледи, CAPA и актуализации.">
        <div className="grid gap-3">
          {tasks.map((task) => {
            const organization = organizations.find((item) => item.id === task.organizationId);
            return (
              <div className="flex flex-col justify-between gap-3 rounded border border-line bg-white p-4 shadow-soft md:flex-row md:items-center" key={task.id}>
                <div>
                  <h3 className="text-sm font-semibold text-ink">{task.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {organization?.name} · Срок: {task.dueDate} · Отговорник: {task.owner}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {task.relatedStandard ? <StandardPills standards={[task.relatedStandard]} /> : null}
                  <StatusBadge status={task.status} />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="assistant" title="AI assistant" description="Placeholder за генериране на документи, анализи на риск и IMS препоръки.">
        <div className="grid gap-4 rounded border border-line bg-white p-4 shadow-soft xl:grid-cols-[0.8fr_1.2fr]">
          <div>
            <label className="text-sm font-medium text-ink" htmlFor="ai-prompt">
              Заявка
            </label>
            <textarea
              className="focus-ring mt-2 min-h-40 w-full rounded border border-line bg-panel p-3 text-sm text-ink outline-none"
              defaultValue="Генерирай оценка на риска за CNC оператор в металообработващо предприятие по ISO 45001 и ISO 9001."
              id="ai-prompt"
            />
            <button className="focus-ring mt-3 inline-flex items-center gap-2 rounded bg-action px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Sparkles className="h-4 w-4" />
              Генерирай чернова
            </button>
          </div>
          <div className="rounded border border-line bg-panel p-4">
            <div className="mb-3 flex items-center gap-2">
              <Bot className="h-4 w-4 text-brand" />
              <h3 className="text-sm font-semibold text-ink">Очакван резултат</h3>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <p>AI слойът ще получава данните за организацията, избраните стандарти, шаблон и prompt от консултанта.</p>
              <p>Първата имплементация връща чернова със секции, рискове, мерки, записи и връзки към приложимите клаузи.</p>
              <p>Следваща стъпка: server action/API route, който вика Cloudflare AI или OpenAI през общ adapter.</p>
            </div>
          </div>
        </div>
      </Section>
    </AppShell>
  );
}
