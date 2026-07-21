import { Bot, LayoutTemplate, ShieldCheck, Sparkles } from "lucide-react";
import { AppShell } from "@/components/shell";
import { DocumentWorkspace } from "@/components/document-workspace";
import { OrganizationWorkspace } from "@/components/organization-workspace";
import { Section, StandardPills, StatusBadge } from "@/components/ui";
import { documents, organizations, standards, tasks, templates } from "@/lib/mock-data";

const overdueTasks = tasks.filter((task) => task.status === "overdue").length;
const activeDocuments = documents.filter((document) => document.status !== "approved").length;

export default function Home() {
  return <AppShell>
    <OrganizationWorkspace activeDocuments={activeDocuments} overdueTasks={overdueTasks} />

    <Section id="standards" title="Стандарти" description="База за приложимост, припокриване и специфична документация.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{standards.map((standard) => <div className="rounded border border-line bg-white p-4 shadow-soft" key={standard.code}><div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand" /><h3 className="text-sm font-semibold text-ink">{standard.code}</h3></div><p className="min-h-16 text-sm text-slate-600">{standard.title}</p><p className="mt-3 text-xs text-slate-500">{standard.scope}</p><div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{standard.documents} документа</span><span>{standard.sharedCoverage}% общи</span></div></div>)}</div>
    </Section>

    <DocumentWorkspace />

    <Section id="templates" title="Шаблони" description="Шаблони и полета за бъдещия DOCX/PDF генератор.">
      <div className="grid gap-4 md:grid-cols-3">{templates.map((template) => <div className="rounded border border-line bg-white p-4 shadow-soft" key={template.id}><div className="mb-3 flex items-center gap-2"><LayoutTemplate className="h-4 w-4 text-action" /><h3 className="text-sm font-semibold text-ink">{template.title}</h3></div><StandardPills standards={template.standards} /><div className="mt-4 flex flex-wrap gap-1.5">{template.placeholders.map((placeholder) => <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600" key={placeholder}>{placeholder}</span>)}</div></div>)}</div>
    </Section>

    <Section id="tasks" title="Задачи и напомняния" description="Контрол на срокове за одити, обучения, CAPA и актуализации.">
      <div className="grid gap-3">{tasks.map((task) => { const organization = organizations.find((item) => item.id === task.organizationId); return <div className="flex flex-col justify-between gap-3 rounded border border-line bg-white p-4 shadow-soft md:flex-row md:items-center" key={task.id}><div><h3 className="text-sm font-semibold text-ink">{task.title}</h3><p className="mt-1 text-xs text-slate-500">{organization?.name} · Срок: {task.dueDate} · Отговорник: {task.owner}</p></div><div className="flex items-center gap-2">{task.relatedStandard ? <StandardPills standards={[task.relatedStandard]} /> : null}<StatusBadge status={task.status} /></div></div>; })}</div>
    </Section>

    <Section id="assistant" title="AI асистент" description="Генериране на документи, анализ на риск и IMS препоръки.">
      <div className="grid gap-4 rounded border border-line bg-white p-4 shadow-soft xl:grid-cols-[0.8fr_1.2fr]"><div><label className="text-sm font-medium text-ink" htmlFor="ai-prompt">Заявка</label><textarea className="focus-ring mt-2 min-h-40 w-full rounded border border-line bg-panel p-3 text-sm text-ink outline-none" defaultValue="Генерирай оценка на риска за CNC оператор по ISO 45001 и ISO 9001." id="ai-prompt" /><button className="focus-ring mt-3 inline-flex items-center gap-2 rounded bg-action px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Sparkles className="h-4 w-4" />Генерирай чернова</button></div><div className="rounded border border-line bg-panel p-4"><div className="mb-3 flex items-center gap-2"><Bot className="h-4 w-4 text-brand" /><h3 className="text-sm font-semibold text-ink">Очакван резултат</h3></div><div className="space-y-3 text-sm text-slate-600"><p>AI слоят ще използва данните за организацията, избраните стандарти, шаблона и заявката.</p><p>Резултатът ще съдържа секции, рискове, мерки, записи и връзки към приложимите клаузи.</p></div></div></div>
    </Section>
  </AppShell>;
}
