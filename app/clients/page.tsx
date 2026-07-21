"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Card, Empty, Gauge, StdChips } from "@/components/ui";
import { clientReadiness } from "@/lib/types";

export default function ClientsPage() {
  const { state } = useStore();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Клиенти</h1>
          <p className="text-sm text-ink-faint">{state.clients.length} организации в системата</p>
        </div>
        <Link href="/clients/new" className="rounded-lg bg-seal px-4 py-2 text-sm font-semibold text-white hover:bg-seal-hover">+ Нов клиент</Link>
      </div>

      {state.clients.length === 0 ? (
        <Card>
          <Empty title="Няма клиенти" sub="Създайте първата организация и стартирайте AI Wizard, за да генерирате цялата система."
            action={<Link href="/clients/new" className="rounded-lg bg-seal px-4 py-2 text-sm font-semibold text-white">+ Нов клиент</Link>} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.clients.map((c) => {
            const docs = state.documents.filter((d) => d.clientId === c.id).length;
            const openNc = state.ncs.filter((n) => n.clientId === c.id && n.status !== "closed").length;
            return (
              <Link key={c.id} href={`/client?id=${c.id}`}>
                <Card className="h-full px-5 py-4 transition-shadow hover:shadow-pop">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[15px] font-bold">{c.name}</h2>
                      <p className="text-xs text-ink-faint">ЕИК {c.eik} · {c.employees} служители</p>
                      <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{c.activity}</p>
                    </div>
                    <Gauge value={clientReadiness(state, c.id)} size={62} />
                  </div>
                  <div className="mt-3"><StdChips codes={c.standards} small /></div>
                  <div className="mt-3 flex gap-4 border-t border-line pt-3 text-xs text-ink-faint">
                    <span><b className="text-ink">{docs}</b> документа</span>
                    <span><b className={openNc ? "text-danger" : "text-ink"}>{openNc}</b> отворени НС</span>
                    {c.integrated && <span className="ml-auto font-semibold text-seal">IMS</span>}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
