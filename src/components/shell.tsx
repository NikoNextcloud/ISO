"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FileText, Gauge, ShieldCheck } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Табло", icon: Gauge },
  { href: "/organizations", label: "Фирми", icon: Building2 },
  { href: "/standards", label: "Стандарти", icon: ShieldCheck },
  { href: "/documents", label: "Документи", icon: FileText }
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const nav = (compact = false) => navItems.map((item) => {
    const selected = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return <Link aria-current={selected ? "page" : undefined} className={`${compact ? "shrink-0" : "w-full"} focus-ring flex items-center gap-2.5 rounded px-3 py-2 text-sm font-medium transition-colors ${selected ? "bg-action text-white shadow-sm" : "text-slate-700 hover:bg-panel hover:text-ink"}`} href={item.href} key={item.href}><item.icon className="h-4 w-4 shrink-0" />{item.label}</Link>;
  });

  return <div className="min-h-screen">
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white px-4 py-5 lg:block">
      <Link className="mb-8 flex items-center gap-3 rounded focus-ring" href="/dashboard"><div className="grid h-10 w-10 place-items-center rounded bg-brand text-xs font-bold text-white">ISO</div><div><p className="text-sm font-semibold text-ink">ISO сертифициране</p><p className="text-xs text-slate-500">Управление на ISO системи</p></div></Link>
      <nav className="space-y-1">{nav()}</nav>
    </aside>
    <main className="lg:pl-64">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur"><div className="mx-auto max-w-7xl px-4 py-3 sm:px-5"><h1 className="text-lg font-semibold text-ink">ISO сертифициране</h1><p className="hidden text-sm text-slate-500 sm:block">Фирми, сертификати, история и документация в един работен процес</p></div><nav className="flex gap-1 overflow-x-auto border-t border-line px-3 py-2 lg:hidden">{nav(true)}</nav></header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-5">{children}</div>
    </main>
  </div>;
}
