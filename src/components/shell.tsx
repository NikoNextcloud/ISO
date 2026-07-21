"use client";

import { useEffect, useState } from "react";
import { Bell, Bot, Building2, ClipboardCheck, FileArchive, FileText, Gauge, LayoutTemplate, ShieldCheck } from "lucide-react";

const navItems = [
  { id: "dashboard", label: "Табло", icon: Gauge },
  { id: "organizations", label: "Фирми", icon: Building2 },
  { id: "standards", label: "Стандарти", icon: ShieldCheck },
  { id: "documents", label: "Документи", icon: FileText },
  { id: "iso27001-system", label: "ISO 27001 система", icon: FileArchive },
  { id: "templates", label: "Шаблони", icon: LayoutTemplate },
  { id: "tasks", label: "Задачи", icon: ClipboardCheck },
  { id: "assistant", label: "AI асистент", icon: Bot }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState("dashboard");

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (navItems.some((item) => item.id === hash)) setActive(hash);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActive(visible.target.id);
    }, { rootMargin: "-18% 0px -65% 0px", threshold: [0, 0.1, 0.35] });
    navItems.forEach((item) => { const section = document.getElementById(item.id); if (section) observer.observe(section); });
    return () => observer.disconnect();
  }, []);

  const nav = (compact = false) => navItems.map((item) => {
    const selected = active === item.id;
    return <a aria-current={selected ? "page" : undefined} className={`${compact ? "shrink-0" : "w-full"} focus-ring flex items-center gap-2.5 rounded px-3 py-2 text-sm font-medium transition-colors ${selected ? "bg-action text-white shadow-sm" : "text-slate-700 hover:bg-panel hover:text-ink"}`} href={`#${item.id}`} key={item.id} onClick={() => setActive(item.id)}><item.icon className="h-4 w-4 shrink-0" />{item.label}</a>;
  });

  return <div className="min-h-screen">
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white px-4 py-5 lg:block">
      <div className="mb-8 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded bg-brand text-xs font-bold text-white">ISO</div><div><p className="text-sm font-semibold text-ink">ISO сертифициране</p><p className="text-xs text-slate-500">Управление на ISO системи</p></div></div>
      <nav className="space-y-1">{nav()}</nav>
    </aside>
    <main className="lg:pl-64">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-5"><div><h1 className="text-lg font-semibold text-ink">ISO сертифициране</h1><p className="hidden text-sm text-slate-500 sm:block">Фирми, документи, задачи и AI генериране в един работен поток</p></div><button aria-label="Напомняния" className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded border border-line bg-white text-slate-700 shadow-sm hover:bg-panel" title="Напомняния"><Bell className="h-4 w-4" /></button></div><nav className="flex gap-1 overflow-x-auto border-t border-line px-3 py-2 lg:hidden">{nav(true)}</nav></header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-5">{children}</div>
    </main>
  </div>;
}
