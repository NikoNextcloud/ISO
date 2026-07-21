"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { Bar, Button, Card, CardHead, Empty, Field, Gauge, inputCls, Modal, StatusPill, StdChips } from "@/components/ui";
import {
  AUDIT_TYPES, AuditType, clientReadiness, NC_CATEGORIES, NcCategory, Nonconformity,
  Risk, riskLabel, StandardCode, today, uid,
} from "@/lib/types";
import { exportClientZip } from "@/lib/exportZip";

function ClientDetail() {
  const params = useSearchParams();
  const router = useRouter();
  const { state, setState, notify } = useStore();
  const id = params.get("id") || "";
  const client = state.clients.find((c) => c.id === id);
  const [tab, setTab] = useState(params.get("tab") || "overview");

  const docs = useMemo(() => state.documents.filter((d) => d.clientId === id), [state.documents, id]);
  const risks = state.risks.filter((r) => r.clientId === id);
  const audits = state.audits.filter((a) => a.clientId === id);
  const ncs = state.ncs.filter((n) => n.clientId === id);
  const assets = state.assets.filter((a) => a.clientId === id);
  const energy = state.energy.filter((e) => e.clientId === id);
  const objectives = state.objectives.filter((o) => o.clientId === id);
  const tasks = state.tasks.filter((t) => t.clientId === id);

  const [riskModal, setRiskModal] = useState(false);
  const [ncModal, setNcModal] = useState(false);
  const [auditModal, setAuditModal] = useState(false);
  const [analysis, setAnalysis] = useState<string[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!client) {
    return <Empty title="Клиентът не е намерен" action={<Link href="/clients" className="text-sm font-semibold text-seal">← Към клиентите</Link>} />;
  }

  const TABS = [
    { k: "overview", l: "Преглед" },
    { k: "documents", l: `Документи (${docs.length})` },
    { k: "risks", l: `Рискове (${risks.length})` },
    { k: "audits", l: `Одити (${audits.length})` },
    { k: "nc", l: `НС / CAPA (${ncs.length})` },
    ...(client.standards.includes("27001") ? [{ k: "27001", l: "ISO 27001" }] : []),
    ...(client.standards.includes("50001") ? [{ k: "50001", l: "ISO 50001" }] : []),
  ];

  const analyzeFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    const names = Array.from(files).map((f) => f.name);
    const findings = [
      `Прочетени ${names.length} файла: ${names.join(", ")}.`,
      "Открита липса: няма актуален списък на нормативните изисквания — препоръчва се създаване на регистър.",
      "Откритата организационна структура е добавена към контекста на организацията.",
      "Старите документи използват различна номерация — препоръчва се уеднаквяване по РГ-01.",
      "Предложение: актуализирайте оценката на риска с данните от длъжностните характеристики.",
    ];
    setAnalysis(findings);
    notify(`AI анализира ${names.length} качени документа за ${client.name} и откри 2 липси.`, "ai");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/clients" className="text-xs font-semibold text-seal">← Клиенти</Link>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{client.name}</h1>
          <p className="text-sm text-ink-faint">ЕИК {client.eik} · {client.address || "—"} · {client.employees} служители</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StdChips codes={client.standards} />
            {client.integrated && <span className="rounded bg-seal-tint px-2 py-0.5 text-xs font-bold text-seal">Интегрирана система</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Gauge value={clientReadiness(state, id)} size={84} label="готовност" />
          <div className="flex flex-col gap-2">
            <Button onClick={() => exportClientZip(state, client)}>⇩ Експорт ZIP</Button>
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>⇪ AI анализ на документи</Button>
            <input ref={fileRef} type="file" multiple hidden accept=".doc,.docx,.xls,.xlsx,.pdf,.png,.jpg,.jpeg" onChange={(e) => analyzeFiles(e.target.files)} />
          </div>
        </div>
      </div>

      {analysis && (
        <Card className="border-s27001/30 bg-s27001-tint/40">
          <CardHead title="✦ Резултат от AI анализа" right={<button className="text-xs font-semibold text-seal" onClick={() => setAnalysis(null)}>Затвори</button>} />
          <ul className="list-disc space-y-1 px-9 py-3 text-sm">{analysis.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </Card>
      )}

      <nav className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`whitespace-nowrap border-b-2 px-3.5 py-2 text-sm font-semibold ${tab === t.k ? "border-seal text-seal" : "border-transparent text-ink-faint hover:text-ink"}`}>
            {t.l}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHead title="Цели и KPI" />
            <div className="space-y-3 px-5 py-4">
              {objectives.map((o) => (
                <div key={o.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{o.title}</span>
                    <span className="text-xs text-ink-faint">{o.kpi} · цел {o.target}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1"><Bar value={o.progress} tone="#2456A6" /></div>
                    <input type="number" min={0} max={100} value={o.progress}
                      onChange={(e) => setState((s) => ({ ...s, objectives: s.objectives.map((x) => x.id === o.id ? { ...x, progress: Number(e.target.value) } : x) }))}
                      className="w-16 rounded border border-line px-1.5 py-0.5 text-right text-xs" />
                    <span className="text-xs">%</span>
                  </div>
                </div>
              ))}
              {objectives.length === 0 && <p className="text-sm text-ink-faint">Няма цели.</p>}
            </div>
          </Card>
          <Card>
            <CardHead title="Задачи" />
            <div className="divide-y divide-line">
              {tasks.map((t) => (
                <label key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <input type="checkbox" checked={t.status === "done"} className="h-4 w-4"
                    onChange={() => setState((s) => ({ ...s, tasks: s.tasks.map((x) => x.id === t.id ? { ...x, status: x.status === "done" ? "open" : "done" } : x) }))} />
                  <span className={`flex-1 ${t.status === "done" ? "text-ink-faint line-through" : "font-semibold"}`}>{t.title}</span>
                  <span className="font-mono text-xs text-ink-faint">{t.dueDate}</span>
                </label>
              ))}
              {tasks.length === 0 && <p className="px-5 py-4 text-sm text-ink-faint">Няма задачи.</p>}
            </div>
          </Card>
          <Card className="lg:col-span-2">
            <CardHead title="Профил" />
            <dl className="grid gap-x-8 gap-y-2 px-5 py-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-semibold uppercase text-ink-faint">Дейност</dt><dd>{client.activity}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-ink-faint">Обекти</dt><dd>{client.sites || "—"}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-ink-faint">Контакт</dt><dd>{client.contactPerson} · {client.phone} · {client.email}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-ink-faint">Работно време</dt><dd>{client.workingHours || "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-ink-faint">Структура</dt><dd>{client.orgStructure || "—"}</dd></div>
            </dl>
          </Card>
        </div>
      )}

      {tab === "documents" && (
        <Card>
          <CardHead title="Документация на системата" sub="Общите процедури покриват всички избрани стандарти — един документ вместо няколко." />
          <div className="divide-y divide-line">
            {docs.map((d) => (
              <Link key={d.id} href={`/document?id=${d.id}`} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm hover:bg-paper">
                <span className="w-16 shrink-0 font-mono text-xs font-bold text-seal">{d.code}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{d.title}</span>
                <StdChips codes={d.standards} small />
                <StatusPill status={d.status} />
                <span className="font-mono text-xs text-ink-faint">v{d.version}</span>
              </Link>
            ))}
            {docs.length === 0 && <Empty title="Няма документи" sub="Системата за този клиент все още не е генерирана." />}
          </div>
        </Card>
      )}

      {tab === "risks" && (
        <Card>
          <CardHead title="Оценка на рисковете" sub="Обща методика по ПР-04 за всички стандарти" right={<Button onClick={() => setRiskModal(true)}>+ Нов риск</Button>} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase text-ink-faint">
                <th className="px-5 py-2">Риск</th><th className="px-2 py-2">Стандарти</th><th className="px-2 py-2 text-center">В</th><th className="px-2 py-2 text-center">Вл</th><th className="px-2 py-2 text-center">Ниво</th><th className="px-2 py-2">Контроли / мерки</th><th className="px-2 py-2 text-center">Остатъчен</th>
              </tr></thead>
              <tbody>
                {risks.sort((a, b) => b.probability * b.impact - a.probability * a.impact).map((r) => {
                  const lvl = r.probability * r.impact;
                  const { label, tone } = riskLabel(lvl);
                  const toneCls = tone === "danger" ? "bg-danger/10 text-danger" : tone === "warn" ? "bg-warn/10 text-warn" : "bg-ok/10 text-ok";
                  return (
                    <tr key={r.id} className="border-b border-line align-top">
                      <td className="px-5 py-2.5"><div className="font-semibold">{r.title}</div><div className="text-xs text-ink-faint">{r.category} · {r.owner}</div></td>
                      <td className="px-2 py-2.5"><StdChips codes={r.standards} small /></td>
                      <td className="px-2 py-2.5 text-center font-mono">{r.probability}</td>
                      <td className="px-2 py-2.5 text-center font-mono">{r.impact}</td>
                      <td className="px-2 py-2.5 text-center"><span className={`rounded px-2 py-0.5 text-xs font-bold ${toneCls}`}>{lvl} {label}</span></td>
                      <td className="px-2 py-2.5 text-xs">{r.controls}<br /><span className="text-ink-faint">{r.measures}</span></td>
                      <td className="px-2 py-2.5 text-center font-mono">{r.residual}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {risks.length === 0 && <Empty title="Няма регистрирани рискове" />}
          </div>
        </Card>
      )}

      {tab === "audits" && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => setAuditModal(true)}>+ Нов одит</Button></div>
          {audits.map((a) => (
            <Card key={a.id}>
              <CardHead title={`${AUDIT_TYPES[a.type]} · ${a.plannedDate}`} sub={`Одитор: ${a.auditor} · Статус: ${a.status === "planned" ? "Планиран" : a.status === "in_progress" ? "В процес" : "Приключен"}`}
                right={a.status !== "done" && (
                  <Button variant="subtle" onClick={() => setState((s) => ({ ...s, audits: s.audits.map((x) => x.id === a.id ? { ...x, status: x.status === "planned" ? "in_progress" : "done" } : x) }))}>
                    {a.status === "planned" ? "Стартирай" : "Приключи"}
                  </Button>
                )} />
              <div className="px-5 py-3">
                <p className="mb-2 text-xs font-semibold uppercase text-ink-faint">Контролен списък (клаузи 4–10)</p>
                <div className="space-y-1.5">
                  {a.checklist.map((c, ci) => (
                    <div key={ci} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="w-6 shrink-0 font-mono text-xs font-bold text-seal">{c.clause}</span>
                      <span className="min-w-0 flex-1">{c.text}</span>
                      <select value={c.result} disabled={a.status === "done"}
                        onChange={(e) => setState((s) => ({ ...s, audits: s.audits.map((x) => x.id === a.id ? { ...x, checklist: x.checklist.map((cc, j) => j === ci ? { ...cc, result: e.target.value as any } : cc) } : x) }))}
                        className="rounded border border-line px-2 py-1 text-xs">
                        <option value="pending">—</option>
                        <option value="conform">Съответствие</option>
                        <option value="observation">Наблюдение</option>
                        <option value="nc">Несъответствие</option>
                      </select>
                    </div>
                  ))}
                </div>
                <Field label="Констатации / доклад">
                  <textarea className={inputCls} rows={2} value={a.findings} disabled={a.status === "done"}
                    onChange={(e) => setState((s) => ({ ...s, audits: s.audits.map((x) => x.id === a.id ? { ...x, findings: e.target.value } : x) }))} />
                </Field>
                {a.checklist.some((c) => c.result === "nc") && a.status !== "done" && (
                  <Button className="mt-2" variant="danger" onClick={() => { setNcModal(true); }}>Регистрирай несъответствие →</Button>
                )}
              </div>
            </Card>
          ))}
          {audits.length === 0 && <Card><Empty title="Няма одити" /></Card>}
        </div>
      )}

      {tab === "nc" && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => setNcModal(true)}>+ Ново несъответствие</Button></div>
          {ncs.map((n) => (
            <Card key={n.id}>
              <CardHead title={`${n.number} · ${NC_CATEGORIES[n.category]}`} sub={`Източник: ${n.source} · Отговорник: ${n.responsible} · Срок: ${n.dueDate}`}
                right={
                  <select value={n.status}
                    onChange={(e) => setState((s) => ({ ...s, ncs: s.ncs.map((x) => x.id === n.id ? { ...x, status: e.target.value as any, closedDate: e.target.value === "closed" ? today() : undefined } : x) }))}
                    className="rounded border border-line px-2 py-1 text-xs font-semibold">
                    <option value="open">Отворено</option>
                    <option value="in_progress">В процес</option>
                    <option value="closed">Закрито</option>
                  </select>
                } />
              <div className="grid gap-4 px-5 py-4 text-sm lg:grid-cols-2">
                <div>
                  <p className="font-semibold">{n.description}</p>
                  <p className="mt-2 text-xs font-semibold uppercase text-ink-faint">Анализ 5 Защо</p>
                  <ol className="list-decimal pl-5 text-xs">{n.fiveWhy.map((w, i) => <li key={i}>{w}</li>)}</ol>
                  <p className="mt-2 text-xs"><b>Първопричина:</b> {n.rootCause}</p>
                </div>
                <div className="space-y-1 text-xs">
                  <p><b>Корекция:</b> {n.correction}</p>
                  <p><b>Коригиращо действие:</b> {n.correctiveAction}</p>
                  <p><b>Превантивно действие:</b> {n.preventiveAction || "—"}</p>
                  {n.status === "closed" && <p className="font-semibold text-ok">✓ Закрито на {n.closedDate}</p>}
                </div>
              </div>
            </Card>
          ))}
          {ncs.length === 0 && <Card><Empty title="Няма несъответствия" sub="Регистрирайте констатации от одити или сигнали." /></Card>}
        </div>
      )}

      {tab === "27001" && (
        <Card>
          <CardHead title="Информационни активи и оценка на риска (ISO 27001)" sub="C-I-A класификация, заплахи, уязвимости и контроли по Annex A · SoA: СП-И-01 · RTP: ПЛ-И-01" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase text-ink-faint">
                <th className="px-5 py-2">Актив</th><th className="px-2 py-2">Собственик</th><th className="px-2 py-2 text-center">C·I·A</th><th className="px-2 py-2">Заплахи / уязвимости</th><th className="px-2 py-2">Annex A</th><th className="px-2 py-2 text-center">Риск</th><th className="px-2 py-2">Третиране</th>
              </tr></thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id} className="border-b border-line align-top">
                    <td className="px-5 py-2.5"><b>{a.name}</b><div className="text-xs text-ink-faint">{a.type}</div></td>
                    <td className="px-2 py-2.5 text-xs">{a.owner}</td>
                    <td className="px-2 py-2.5 text-center font-mono text-xs">{a.c}·{a.i}·{a.a}</td>
                    <td className="px-2 py-2.5 text-xs">{a.threats}<br /><span className="text-ink-faint">{a.vulnerabilities}</span></td>
                    <td className="px-2 py-2.5 font-mono text-xs">{a.controls}</td>
                    <td className="px-2 py-2.5 text-center"><span className={`rounded px-2 py-0.5 text-xs font-bold ${a.riskLevel >= 15 ? "bg-danger/10 text-danger" : "bg-warn/10 text-warn"}`}>{a.riskLevel}</span></td>
                    <td className="px-2 py-2.5 text-xs">{a.treatment === "mitigate" ? "Смекчаване" : a.treatment === "accept" ? "Приемане" : a.treatment === "transfer" ? "Прехвърляне" : "Избягване"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "50001" && (
        <Card>
          <CardHead title="Енергийни показатели (ISO 50001)" sub="EnPI спрямо базова линия · Енергиен преглед: АН-ЕН-01" />
          <div className="space-y-4 px-5 py-4">
            {energy.map((e) => {
              const improvement = ((e.baseline - e.current) / e.baseline) * 100;
              const toTarget = Math.min(100, Math.max(0, ((e.baseline - e.current) / Math.max(0.0001, e.baseline - e.target)) * 100));
              return (
                <div key={e.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">{e.name}</span>
                    <span className="font-mono text-xs text-ink-faint">база {e.baseline} → сега <b className="text-ink">{e.current}</b> → цел {e.target} {e.unit}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1"><Bar value={toTarget} tone="#A16207" /></div>
                    <span className={`text-xs font-bold ${improvement >= 0 ? "text-ok" : "text-danger"}`}>{improvement >= 0 ? "−" : "+"}{Math.abs(improvement).toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <RiskModal open={riskModal} onClose={() => setRiskModal(false)} clientId={id} standards={client.standards} />
      <NcModal open={ncModal} onClose={() => setNcModal(false)} clientId={id} count={ncs.length} />
      <AuditModal open={auditModal} onClose={() => setAuditModal(false)} clientId={id} standards={client.standards} />
    </div>
  );
}

function RiskModal({ open, onClose, clientId, standards }: { open: boolean; onClose: () => void; clientId: string; standards: StandardCode[] }) {
  const { setState, notify, state } = useStore();
  const [f, setF] = useState({ title: "", category: "Организационен", p: 3, i: 3, controls: "", measures: "" });
  const submit = () => {
    if (!f.title.trim()) return;
    const risk: Risk = {
      id: uid(), clientId, standards, title: f.title, category: f.category,
      probability: f.p, impact: f.i, controls: f.controls, measures: f.measures,
      residual: Math.max(1, Math.round(f.p * f.i * 0.5)), owner: state.settings.userName, status: "open",
    };
    setState((s) => ({ ...s, risks: [...s.risks, risk] }));
    notify(`Добавен нов риск: „${f.title}“ (ниво ${f.p * f.i}).`);
    setF({ title: "", category: "Организационен", p: 3, i: 3, controls: "", measures: "" });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Нов риск">
      <div className="space-y-3">
        <Field label="Описание на риска *"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Категория"><input className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Вероятност: ${f.p}`}><input type="range" min={1} max={5} value={f.p} onChange={(e) => setF({ ...f, p: +e.target.value })} className="w-full" /></Field>
          <Field label={`Влияние: ${f.i}`}><input type="range" min={1} max={5} value={f.i} onChange={(e) => setF({ ...f, i: +e.target.value })} className="w-full" /></Field>
        </div>
        <p className="text-sm">Ниво: <b>{f.p * f.i}</b> · {riskLabel(f.p * f.i).label}</p>
        <Field label="Съществуващи контроли"><input className={inputCls} value={f.controls} onChange={(e) => setF({ ...f, controls: e.target.value })} /></Field>
        <Field label="Мерки"><input className={inputCls} value={f.measures} onChange={(e) => setF({ ...f, measures: e.target.value })} /></Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Отказ</Button><Button onClick={submit}>Добави риска</Button></div>
      </div>
    </Modal>
  );
}

function NcModal({ open, onClose, clientId, count }: { open: boolean; onClose: () => void; clientId: string; count: number }) {
  const { setState, notify } = useStore();
  const [f, setF] = useState({ source: "Вътрешен одит", category: "minor" as NcCategory, description: "", why: ["", "", ""], rootCause: "", correction: "", corrective: "", responsible: "", dueDate: today() });
  const submit = () => {
    if (!f.description.trim()) return;
    const nc: Nonconformity = {
      id: uid(), clientId, number: `НС-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`,
      source: f.source, category: f.category, description: f.description,
      fiveWhy: f.why.filter(Boolean), rootCause: f.rootCause, correction: f.correction,
      correctiveAction: f.corrective, preventiveAction: "", responsible: f.responsible, dueDate: f.dueDate, status: "open",
    };
    setState((s) => ({ ...s, ncs: [...s.ncs, nc] }));
    notify(`Регистрирано несъответствие ${nc.number}.`, "warn");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Ново несъответствие" wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Източник">
          <select className={inputCls} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
            {["Вътрешен одит", "Външен одит", "Рекламация", "Инцидент", "Мониторинг", "Друго"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Категория">
          <select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as NcCategory })}>
            {(Object.keys(NC_CATEGORIES) as NcCategory[]).map((k) => <option key={k} value={k}>{NC_CATEGORIES[k]}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2"><Field label="Описание *"><textarea className={inputCls} rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field></div>
        <div className="sm:col-span-2">
          <Field label="Анализ 5 Защо" hint="Попълнете последователните въпроси „Защо?“ до достигане на първопричината.">
            <div className="space-y-1.5">
              {f.why.map((w, i) => (
                <input key={i} className={inputCls} placeholder={`Защо №${i + 1}…`} value={w}
                  onChange={(e) => setF({ ...f, why: f.why.map((x, j) => j === i ? e.target.value : x) })} />
              ))}
            </div>
          </Field>
        </div>
        <div className="sm:col-span-2"><Field label="Първопричина (Root Cause)"><input className={inputCls} value={f.rootCause} onChange={(e) => setF({ ...f, rootCause: e.target.value })} /></Field></div>
        <Field label="Корекция"><input className={inputCls} value={f.correction} onChange={(e) => setF({ ...f, correction: e.target.value })} /></Field>
        <Field label="Коригиращо действие"><input className={inputCls} value={f.corrective} onChange={(e) => setF({ ...f, corrective: e.target.value })} /></Field>
        <Field label="Отговорник"><input className={inputCls} value={f.responsible} onChange={(e) => setF({ ...f, responsible: e.target.value })} /></Field>
        <Field label="Срок"><input type="date" className={inputCls} value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Отказ</Button><Button onClick={submit}>Регистрирай</Button></div>
    </Modal>
  );
}

function AuditModal({ open, onClose, clientId, standards }: { open: boolean; onClose: () => void; clientId: string; standards: StandardCode[] }) {
  const { setState, notify, state } = useStore();
  const [type, setType] = useState<AuditType>("internal");
  const [date, setDate] = useState(today());
  const submit = () => {
    setState((s) => ({
      ...s,
      audits: [...s.audits, {
        id: uid(), clientId, type, standards, plannedDate: date, auditor: state.settings.userName,
        status: "planned",
        checklist: ["4", "5", "6", "7", "8", "9", "10"].map((cl) => ({ clause: cl, text: `Проверка на съответствието по клауза ${cl}`, result: "pending" as const, evidence: "" })),
        findings: "", ncIds: [],
      }],
    }));
    notify(`Планиран е ${AUDIT_TYPES[type].toLowerCase()} за ${date}.`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Нов одит">
      <div className="space-y-3">
        <Field label="Вид одит">
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as AuditType)}>
            {(Object.keys(AUDIT_TYPES) as AuditType[]).map((k) => <option key={k} value={k}>{AUDIT_TYPES[k]}</option>)}
          </select>
        </Field>
        <Field label="Планирана дата"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Отказ</Button><Button onClick={submit}>Планирай</Button></div>
      </div>
    </Modal>
  );
}

export default function Page() {
  return <Suspense fallback={<p className="text-sm text-ink-faint">Зареждане…</p>}><ClientDetail /></Suspense>;
}
