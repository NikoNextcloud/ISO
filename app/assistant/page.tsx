"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { Button, Card, inputCls } from "@/components/ui";
import { callWorkerAI, ChatMessage, HELP_TEXT, parseIntent } from "@/lib/ai";
import { IsoDocument, Risk, riskLabel, today, uid } from "@/lib/types";

interface Bubble { role: "user" | "assistant"; text: string; docId?: string }

const SUGGESTIONS = [
  "Направи политика за качество",
  "Направи процедура за управление на доставчици",
  "Добави нов риск за киберсигурност",
  "Добави KPI",
  "Какво можеш?",
];

export default function AssistantPage() {
  const { state, setState, notify } = useStore();
  const [clientId, setClientId] = useState(state.clients[0]?.id || "");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<Bubble[]>([{
    role: "assistant",
    text: "Здравей! Аз съм AI асистентът на системата. Избери клиент и ми дай команда — например „Направи политика за качество“ или „Добави нов риск за киберсигурност“. Напиши „Какво можеш?“ за пълния списък.",
  }]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const client = state.clients.find((c) => c.id === clientId);

  const pushDoc = (code: string, title: string, type: IsoDocument["type"], content: string): IsoDocument => {
    const doc: IsoDocument = {
      id: uid(), clientId, code, title, type, standards: client?.standards || [],
      version: "1.0", date: today(), author: "AI Асистент", approver: client?.contactPerson || "",
      status: "draft", content, history: [{ version: "1.0", date: today(), author: "AI Асистент", note: "Генериран от AI чат команда" }], related: [],
    };
    setState((s) => ({ ...s, documents: [...s.documents, doc] }));
    return doc;
  };

  const runLocal = (text: string): Bubble => {
    if (!client) return { role: "assistant", text: "Първо избери клиент от менюто горе." };
    const intent = parseIntent(text);
    const n = state.documents.filter((d) => d.clientId === clientId).length;
    switch (intent.kind) {
      case "help":
        return { role: "assistant", text: HELP_TEXT };
      case "create_policy": {
        const doc = pushDoc(`ПОЛ-${String(n).padStart(2, "0")}`, "Политика (генерирана от AI)", "policy",
          `# Политика\n\nРъководството на **${client.name}** декларира ангажимент към качество, съответствие и непрекъснато подобряване в дейността: ${client.activity}.\n\n- Изпълняваме изискванията на клиентите и приложимите стандарти\n- Осигуряваме ресурси и компетентен персонал\n- Измерваме и подобряваме резултатността\n\n*Чернова — прегледайте и адаптирайте преди одобрение.*`);
        notify(`AI създаде документ ${doc.code} за ${client.name}.`, "ai");
        return { role: "assistant", text: `Готово — създадох документ „${doc.title}“ (${doc.code}) в статус Чернова.`, docId: doc.id };
      }
      case "create_procedure": {
        const topic = intent.topic || "нов процес";
        const doc = pushDoc(`ПР-AI-${String(n).padStart(2, "0")}`, `Процедура за ${topic}`, "procedure",
          `# Процедура за ${topic}\n\n## 1. Цел\nДа регламентира дейностите по ${topic} в **${client.name}**.\n\n## 2. Обхват\nПрилага се за всички звена и процеси, свързани с ${topic}.\n\n## 3. Отговорности\n- Ръководството осигурява ресурси\n- Определеният отговорник изпълнява и поддържа процедурата\n\n## 4. Описание\n1. Планиране на дейността\n2. Изпълнение и контрол\n3. Документиране на записите\n4. Преглед и подобряване\n\n*Чернова — прегледайте и адаптирайте преди одобрение.*`);
        notify(`AI създаде документ ${doc.code}.`, "ai");
        return { role: "assistant", text: `Създадох „${doc.title}“ (${doc.code}) в статус Чернова — отвори я, за да я прегледаш и допълниш.`, docId: doc.id };
      }
      case "add_risk": {
        const topic = intent.topic || "нов идентифициран риск";
        const risk: Risk = {
          id: uid(), clientId, standards: client.standards, title: `Риск: ${topic}`,
          category: "AI идентифициран", probability: 3, impact: 4, controls: "Подлежи на определяне",
          measures: "Подлежи на определяне", residual: 6, owner: state.settings.userName, status: "open",
        };
        setState((s) => ({ ...s, risks: [...s.risks, risk] }));
        notify(`AI добави риск „${topic}“ (ниво 12).`, "ai");
        return { role: "assistant", text: `Добавих риск „${topic}“ с предварителна оценка В=3 × Вл=4 = ниво 12 (${riskLabel(12).label}). Отвори модул „Рискове“ на клиента, за да прецизираш оценката и мерките.` };
      }
      case "add_kpi": {
        setState((s) => ({
          ...s,
          objectives: [...s.objectives, { id: uid(), clientId, standards: client.standards, title: "Нова цел (AI)", kpi: "Показател — определете", target: "Цел — определете", deadline: `${new Date().getFullYear()}-12-31`, progress: 0 }],
        }));
        return { role: "assistant", text: "Добавих нова цел с KPI в раздел „Преглед“ на клиента — попълни показателя и целевата стойност." };
      }
      case "create_register": {
        const doc = pushDoc(`РГ-AI-${String(n).padStart(2, "0")}`, "Регистър (генериран от AI)", "register",
          `# Регистър\n\n| № | Запис | Дата | Отговорник | Статус |\n|---|---|---|---|---|\n| 1 | | | | |`);
        return { role: "assistant", text: `Създадох регистър ${doc.code} — попълни колоните според нуждите.`, docId: doc.id };
      }
      case "risk_assessment": {
        const rs = state.risks.filter((r) => r.clientId === clientId);
        const high = rs.filter((r) => r.probability * r.impact >= 15).length;
        const med = rs.filter((r) => { const l = r.probability * r.impact; return l >= 8 && l < 15; }).length;
        return { role: "assistant", text: `Текуща оценка на риска за ${client.name}: ${rs.length} риска общо — ${high} високи, ${med} средни, ${rs.length - high - med} ниски. Високите изискват незабавни мерки по ПР-04. Отвори раздел „Рискове“ за детайли.` };
      }
      default:
        return { role: "assistant", text: "Не разпознах команда. Пробвай: „Направи политика…“, „Направи процедура за…“, „Добави нов риск за…“, „Добави KPI“ или „Какво можеш?“. Ако конфигурираш AI endpoint в Настройки, ще отговарям и на свободни въпроси." };
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setChat((c) => [...c, { role: "user", text }]);
    setBusy(true);

    const intent = parseIntent(text);
    const isCommand = intent.kind !== "unknown";

    if (isCommand || !state.settings.aiEndpoint) {
      const reply = runLocal(text);
      setChat((c) => [...c, reply]);
      setBusy(false);
    } else {
      try {
        const history: ChatMessage[] = [...chat, { role: "user" as const, text }].map((b) => ({ role: b.role, content: b.text }));
        const ctx = client ? `Контекст: работим по клиент „${client.name}“ (дейност: ${client.activity}; стандарти: ${client.standards.join(", ")}).` : "";
        const answer = await callWorkerAI(state.settings, [{ role: "system", content: ctx }, ...history]);
        setChat((c) => [...c, { role: "assistant", text: answer }]);
      } catch (err) {
        setChat((c) => [...c, { role: "assistant", text: `Грешка при връзка с AI endpoint-а (${(err as Error).message}). Провери адреса в Настройки — междувременно командите работят локално.` }]);
      }
      setBusy(false);
    }
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col" style={{ minHeight: "calc(100vh - 140px)" }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">AI Асистент</h1>
          <p className="text-sm text-ink-faint">
            Изпълнява команди директно в системата · {state.settings.aiEndpoint ? "свързан с Cloudflare Workers AI" : "локален режим (без endpoint)"}
          </p>
        </div>
        <select className={`${inputCls} w-auto`} value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">— избери клиент —</option>
          {state.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <Card className="flex flex-1 flex-col">
        <div className="flex-1 space-y-3 overflow-auto px-5 py-4">
          {chat.map((b, i) => (
            <div key={i} className={`flex ${b.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${b.role === "user" ? "bg-seal text-white" : "bg-paper"}`}>
                {b.text}
                {b.docId && (
                  <div className="mt-2">
                    <Link href={`/document?id=${b.docId}`} className={`text-xs font-bold underline ${b.role === "user" ? "text-white" : "text-seal"}`}>Отвори документа →</Link>
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="flex justify-start"><div className="rounded-2xl bg-paper px-4 py-2.5 text-sm text-ink-faint">Мисля…</div></div>}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-line p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => setInput(s)} className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink-soft hover:bg-paper">{s}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Напиши команда или въпрос…" value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
            <Button onClick={send} disabled={busy}>Изпрати</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
