import { Bell, Bot, Building2, ClipboardCheck, FileText, Gauge, LayoutTemplate, ShieldCheck } from "lucide-react";

const navItems = [
  { label: "Табло", icon: Gauge, href: "#dashboard" },
  { label: "Фирми", icon: Building2, href: "#organizations" },
  { label: "Стандарти", icon: ShieldCheck, href: "#standards" },
  { label: "Документи", icon: FileText, href: "#documents" },
  { label: "Шаблони", icon: LayoutTemplate, href: "#templates" },
  { label: "Задачи", icon: ClipboardCheck, href: "#tasks" },
  { label: "AI асистент", icon: Bot, href: "#assistant" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white px-4 py-5 lg:block">
      <div className="mb-8 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded bg-brand text-sm font-bold text-white">IMS</div><div><p className="text-sm font-semibold text-ink">IMS AI Platform</p><p className="text-xs text-slate-500">Управление на ISO системи</p></div></div>
      <nav className="space-y-1">{navItems.map((item) => <a className="flex items-center gap-3 rounded px-3 py-2 text-sm font-medium text-slate-700 hover:bg-panel hover:text-ink" href={item.href} key={item.label}><item.icon className="h-4 w-4" />{item.label}</a>)}</nav>
    </aside>
    <main className="lg:pl-64">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 px-5 py-3 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4"><div><h1 className="text-lg font-semibold text-ink">Интегрирани ISO системи</h1><p className="hidden text-sm text-slate-500 sm:block">Фирми, документи, задачи и AI генериране в един работен поток</p></div><button aria-label="Напомняния" className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded border border-line bg-white text-slate-700 shadow-sm hover:bg-panel" title="Напомняния"><Bell className="h-4 w-4" /></button></div></header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-5">{children}</div>
    </main>
  </div>;
}
