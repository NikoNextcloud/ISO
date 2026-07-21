"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { ROLES } from "@/lib/types";

const NAV = [
  { href: "/", label: "Табло", icon: "▦" },
  { href: "/clients", label: "Клиенти", icon: "▤" },
  { href: "/documents", label: "Документи", icon: "▧" },
  { href: "/assistant", label: "AI Асистент", icon: "✦" },
  { href: "/settings", label: "Настройки", icon: "⚙" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, setState, ready } = useStore();
  const [showNotices, setShowNotices] = useState(false);
  const unread = state.notices.filter((n) => !n.read).length;

  return (
    <div className="flex min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-line bg-white md:flex">
        <div className="px-5 py-5">
          <Link href="/" className="block">
            <div className="text-[17px] font-extrabold leading-tight tracking-tight">ISO Smart<br />Manager <span className="text-seal">AI</span></div>
            <div className="mt-1 text-[11px] text-ink-faint">Интегрирани системи за управление</div>
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${active ? "bg-seal-tint text-seal" : "text-ink-soft hover:bg-paper"}`}>
                <span className="w-4 text-center">{n.icon}</span>{n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line px-5 py-4">
          <div className="text-sm font-bold">{state.settings.userName}</div>
          <div className="text-xs text-ink-faint">{ROLES[state.settings.role]}</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:pl-56">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-3 md:hidden">
            <Link href="/" className="font-extrabold">ISO SM <span className="text-seal">AI</span></Link>
          </div>
          <div className="hidden text-sm text-ink-faint md:block">
            {new Date().toLocaleDateString("bg-BG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="relative flex items-center gap-2">
            <button onClick={() => setShowNotices((v) => !v)}
              className="relative rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold hover:bg-paper">
              Известия
              {unread > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">{unread}</span>}
            </button>
            {showNotices && (
              <div className="absolute right-0 top-11 w-80 rounded-xl border border-line bg-white p-2 shadow-pop">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-sm font-bold">Известия</span>
                  <button className="text-xs text-seal font-semibold"
                    onClick={() => setState((s) => ({ ...s, notices: s.notices.map((n) => ({ ...n, read: true })) }))}>
                    Маркирай прочетени
                  </button>
                </div>
                <div className="max-h-80 overflow-auto">
                  {state.notices.length === 0 && <p className="px-2 py-4 text-sm text-ink-faint">Няма известия.</p>}
                  {state.notices.map((n) => (
                    <div key={n.id} className={`rounded-lg px-2 py-2 text-sm ${n.read ? "text-ink-faint" : ""}`}>
                      <span className={`mr-1.5 ${n.kind === "warn" ? "text-warn" : n.kind === "ai" ? "text-s27001" : "text-seal"}`}>
                        {n.kind === "warn" ? "⚠" : n.kind === "ai" ? "✦" : "ℹ"}
                      </span>
                      {n.text}
                      <div className="mt-0.5 text-[11px] text-ink-faint">{n.date}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        <nav className="no-print flex gap-1 overflow-x-auto border-b border-line bg-white px-2 py-1.5 md:hidden">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold ${active ? "bg-seal-tint text-seal" : "text-ink-soft"}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 px-4 py-6 md:px-8">{ready ? children : <p className="text-sm text-ink-faint">Зареждане…</p>}</main>
      </div>
    </div>
  );
}
