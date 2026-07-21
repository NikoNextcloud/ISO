"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  Building2,
  FileText,
  HardDrive,
  LayoutDashboard,
  RefreshCw,
  ShieldCheck,
  Sparkles
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Табло", icon: LayoutDashboard },
  { href: "/organizations", label: "Фирми", icon: Building2 },
  { href: "/standards", label: "Стандарти", icon: ShieldCheck },
  { href: "/documents", label: "Документи", icon: FileText },
  { href: "/storage", label: "Хранилище", icon: HardDrive }
] as const;

const pageContent = {
  dashboard: {
    eyebrow: "ТАБЛО НА СОБСТВЕНИКА",
    title: "Команден център за ISO сертифициране",
    description: "Общ преглед на фирмите, сертификатите и документацията"
  },
  organizations: {
    eyebrow: "КЛИЕНТСКИ РЕГИСТЪР",
    title: "Управление на фирми",
    description: "Фирмени досиета, стандарти, сертификати и история"
  },
  standards: {
    eyebrow: "ISO СИСТЕМИ",
    title: "Стандарти и генериране",
    description: "Изберете стандарт и подгответе системата за конкретна фирма"
  },
  documents: {
    eyebrow: "ФИРМЕН АРХИВ",
    title: "Документи и файлове",
    description: "Централизирано управление на цялата ISO документация"
  },
  storage: {
    eyebrow: "SUPABASE STORAGE",
    title: "Хранилище и използвано място",
    description: "Контрол на файловете, капацитета и фирмените архиви"
  }
} as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const section = pathname.startsWith("/organizations")
    ? "organizations"
    : pathname.startsWith("/standards")
      ? "standards"
      : pathname.startsWith("/documents")
        ? "documents"
        : pathname.startsWith("/storage")
          ? "storage"
          : "dashboard";
  const page = pageContent[section];

  const nav = (compact = false) => navItems.map((item) => {
    const selected = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        aria-current={selected ? "page" : undefined}
        className={`${compact ? "shrink-0" : "w-full"} focus-ring flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-all ${selected ? "bg-[#111827] text-white shadow-[0_10px_24px_rgba(17,24,39,0.18)]" : "text-slate-600 hover:bg-slate-100 hover:text-ink"}`}
        href={item.href as Route}
        key={item.href}
      >
        <item.icon className={`h-[18px] w-[18px] shrink-0 ${selected ? "text-white" : "text-slate-500"}`} />
        {item.label}
      </Link>
    );
  });

  return (
    <div className="min-h-screen bg-[#f3f6fb]">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-72 border-r border-slate-200 bg-white px-5 py-6 lg:flex lg:flex-col">
        <Link className="focus-ring mb-8 flex items-center gap-3 rounded-lg" href="/dashboard">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[#111827] text-sm font-bold text-white shadow-lg">ISO</div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-[#111827]">ISO сертифициране</p>
            <p className="mt-0.5 text-xs text-slate-500">Управление на ISO системи</p>
          </div>
        </Link>

        <nav className="space-y-1.5">{nav()}</nav>

        <div className="mt-auto rounded-lg border border-slate-200 bg-[#f8fafc] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]"><Sparkles className="h-4 w-4 text-teal-600" />ISO работно пространство</div>
          <p className="mt-2 text-xs leading-5 text-slate-500">5 стандарта · частен фирмен архив</p>
        </div>
      </aside>

      <main className="min-h-screen lg:pl-72">
        <div className="sticky top-0 z-40 bg-[#f3f6fb]/95 px-3 pt-3 backdrop-blur sm:px-5 sm:pt-5">
          <header className="mx-auto flex max-w-[1600px] flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-[0_10px_32px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold text-blue-700">{page.eyebrow}</p>
              <h1 className="mt-1 text-xl font-bold text-[#111827] sm:text-2xl">{page.title}</h1>
              <p className="mt-1 hidden text-sm text-slate-500 md:block">{page.description}</p>
            </div>
            <button
              className="focus-ring inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:self-auto"
              onClick={() => window.location.reload()}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />Обнови
            </button>
          </header>
          <nav className="mx-auto mt-3 flex max-w-[1600px] gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 shadow-sm lg:hidden">{nav(true)}</nav>
        </div>

        <div className="mx-auto max-w-[1600px] px-3 pb-10 pt-2 sm:px-5">{children}</div>
      </main>
    </div>
  );
}
