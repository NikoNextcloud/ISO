"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button, Card, CardHead, Field, inputCls, StdChip } from "@/components/ui";
import { Client, StandardCode, STANDARDS, today, uid } from "@/lib/types";
import { generateSystem } from "@/lib/generator";

const GEN_STEPS = [
  "Анализ на дейността и контекста…",
  "Разпознаване на рисковете и опасностите…",
  "Обединяване на припокриващите се изисквания…",
  "Генериране на политика, наръчник и процедури…",
  "Генериране на регистри, матрици и формуляри…",
  "Създаване на цели, KPI и програми…",
  "Планиране на вътрешен одит…",
];

export default function NewClient() {
  const { state, setState, notify } = useStore();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", eik: "", address: "", contactPerson: "", phone: "", email: "",
    employees: 10, activity: "", sites: "", workingHours: "", orgStructure: "",
  });
  const [selected, setSelected] = useState<StandardCode[]>(["9001"]);
  const [integrated, setIntegrated] = useState(false);
  const [genStep, setGenStep] = useState(-1);
  const [error, setError] = useState("");

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (s: StandardCode) =>
    setSelected((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const startGeneration = async () => {
    if (!form.name.trim() || !form.eik.trim() || !form.activity.trim()) {
      setError("Задължителни полета: Име, ЕИК и Дейност.");
      return;
    }
    if (selected.length === 0) {
      setError("Изберете поне един стандарт.");
      return;
    }
    setError("");
    const client: Client = {
      id: uid(), ...form,
      employees: Number(form.employees) || 1,
      standards: [...selected].sort(),
      integrated: integrated || selected.length > 1,
      createdAt: today(),
      generated: true,
    };
    for (let i = 0; i < GEN_STEPS.length; i++) {
      setGenStep(i);
      await new Promise((r) => setTimeout(r, 420));
    }
    const bundle = generateSystem(client, state.settings.userName);
    setState((s) => ({
      ...s,
      clients: [...s.clients, client],
      documents: [...s.documents, ...bundle.documents],
      risks: [...s.risks, ...bundle.risks],
      objectives: [...s.objectives, ...bundle.objectives],
      audits: [...s.audits, ...bundle.audits],
      assets: [...s.assets, ...bundle.assets],
      energy: [...s.energy, ...bundle.energy],
      tasks: [...s.tasks, ...bundle.tasks],
    }));
    notify(`AI Wizard генерира ${bundle.documents.length} документа, ${bundle.risks.length} риска и ${bundle.objectives.length} цели за ${client.name}.`, "ai");
    router.push(`/client?id=${client.id}`);
  };

  if (genStep >= 0) {
    return (
      <div className="mx-auto max-w-lg pt-16">
        <Card className="px-6 py-8 text-center">
          <div className="mb-4 text-3xl">✦</div>
          <h1 className="text-lg font-extrabold">AI Wizard изгражда системата</h1>
          <p className="mb-6 text-sm text-ink-faint">{form.name}</p>
          <div className="space-y-2 text-left">
            {GEN_STEPS.map((s, i) => (
              <div key={s} className={`flex items-center gap-2 text-sm ${i <= genStep ? "text-ink" : "text-ink-faint/50"}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${i < genStep ? "bg-s14001 text-white" : i === genStep ? "bg-seal text-white" : "bg-line"}`}>
                  {i < genStep ? "✓" : i + 1}
                </span>
                {s}
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Нов клиент</h1>
        <p className="text-sm text-ink-faint">Кратък въпросник → един бутон → пълна система за управление.</p>
      </div>

      <Card>
        <CardHead title="1 · Данни за организацията" />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Field label="Име на фирмата *"><input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Пример ООД" /></Field>
          <Field label="ЕИК *"><input className={inputCls} value={form.eik} onChange={(e) => set("eik", e.target.value)} placeholder="123456789" /></Field>
          <Field label="Адрес"><input className={inputCls} value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="Лице за контакт"><input className={inputCls} value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} /></Field>
          <Field label="Телефон"><input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Брой служители"><input className={inputCls} type="number" min={1} value={form.employees} onChange={(e) => set("employees", Number(e.target.value))} /></Field>
          <Field label="Работно време"><input className={inputCls} value={form.workingHours} onChange={(e) => set("workingHours", e.target.value)} placeholder="Пн–Пт 9–18" /></Field>
          <div className="sm:col-span-2">
            <Field label="Дейност *" hint="AI използва дейността, за да разпознае рисковете и да адаптира документацията.">
              <textarea className={inputCls} rows={2} value={form.activity} onChange={(e) => set("activity", e.target.value)} placeholder="Например: производство на метални изделия и монтаж на конструкции" />
            </Field>
          </div>
          <Field label="Обекти"><input className={inputCls} value={form.sites} onChange={(e) => set("sites", e.target.value)} placeholder="Централен офис, производствена база…" /></Field>
          <Field label="Организационна структура"><input className={inputCls} value={form.orgStructure} onChange={(e) => set("orgStructure", e.target.value)} placeholder="Управител, отдели…" /></Field>
        </div>
      </Card>

      <Card>
        <CardHead title="2 · Стандарти" sub="Изберете самостоятелно, комбинирано или като интегрирана система" />
        <div className="px-5 py-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(STANDARDS) as StandardCode[]).map((s) => (
              <button key={s} type="button" onClick={() => toggle(s)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${selected.includes(s) ? "border-seal bg-seal-tint" : "border-line bg-white hover:bg-paper"}`}>
                <div>
                  <StdChip code={s} />
                  <div className="mt-1 text-xs text-ink-faint">{STANDARDS[s].full}</div>
                </div>
                <span className={`flex h-5 w-5 items-center justify-center rounded border text-xs font-bold ${selected.includes(s) ? "border-seal bg-seal text-white" : "border-line"}`}>
                  {selected.includes(s) ? "✓" : ""}
                </span>
              </button>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={integrated || selected.length > 1} onChange={(e) => setIntegrated(e.target.checked)} className="h-4 w-4" />
            Интегрирана система (IMS) — общи процедури за припокриващите се изисквания
          </label>
          {selected.length > 1 && (
            <p className="mt-2 rounded-lg bg-s27001-tint px-3 py-2 text-xs text-ink">
              ✦ AI ще обедини общите изисквания ({selected.length} стандарта) в единни процедури: документи, одити, CAPA, риск, преглед от ръководството, обучение и комуникация — вместо {selected.length} × дублирани документи.
            </p>
          )}
        </div>
      </Card>

      {error && <p className="rounded-lg bg-danger/10 px-4 py-2 text-sm font-semibold text-danger">{error}</p>}

      <div className="flex justify-end gap-2 pb-8">
        <Button variant="ghost" onClick={() => router.push("/clients")}>Отказ</Button>
        <Button onClick={startGeneration}>✦ Създай система</Button>
      </div>
    </div>
  );
}
