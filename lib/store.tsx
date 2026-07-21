"use client";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Client, Notice, Settings, today, uid } from "./types";
import { generateSystem } from "./generator";

const KEY = "ismai-state-v1";

const defaultSettings: Settings = {
  role: "consultant",
  userName: "Консултант",
  aiEndpoint: "",
  aiModel: "@cf/meta/llama-3.1-8b-instruct",
};

function emptyState(): AppState {
  return {
    clients: [], documents: [], risks: [], audits: [], ncs: [], assets: [],
    energy: [], tasks: [], objectives: [], notices: [], settings: defaultSettings,
  };
}

function seedState(): AppState {
  const state = emptyState();
  const demo: Client = {
    id: uid(),
    name: "Принт Медия ЕООД (демо)",
    eik: "201234567",
    address: "гр. Пловдив, ул. Индустриална 12",
    contactPerson: "Иван Петров",
    phone: "+359 88 123 4567",
    email: "office@printmedia.bg",
    employees: 18,
    activity: "Широкоформатен печат, брандиране и рекламни материали",
    sites: "Производствена база Пловдив",
    workingHours: "Пн–Пт 8:30–17:30",
    orgStructure: "Управител, търговски отдел, производство, монтажен екип",
    standards: ["9001", "14001", "45001"],
    integrated: true,
    createdAt: today(),
    certExpiry: (() => { const d = new Date(); d.setDate(d.getDate() + 45); return d.toISOString().slice(0, 10); })(),
    generated: true,
  };
  state.clients.push(demo);
  const bundle = generateSystem(demo, "Консултант");
  state.documents.push(...bundle.documents.map((d, i) => ({ ...d, status: i % 3 === 0 ? ("active" as const) : i % 3 === 1 ? ("review" as const) : ("draft" as const) })));
  state.risks.push(...bundle.risks);
  state.objectives.push(...bundle.objectives.map((o) => ({ ...o, progress: 30 + Math.floor(Math.random() * 40) })));
  state.audits.push(...bundle.audits);
  state.tasks.push(...bundle.tasks);
  state.ncs.push({
    id: uid(), clientId: demo.id, number: "НС-2026-001", source: "Вътрешен одит",
    category: "minor", description: "Липсват записи от проведен инструктаж за м. юни на монтажния екип.",
    fiveWhy: ["Защо липсват записи? — Инструктажът не е документиран.", "Защо не е документиран? — Отговорникът е отсъствал.", "Защо няма заместник? — Не е определен заместващ отговорник."],
    rootCause: "Не е осигурена заместимост на отговорника по инструктажите.",
    correction: "Провеждане на извънреден инструктаж с документиране.",
    correctiveAction: "Определяне на заместващ отговорник и актуализиране на ПР-06.",
    preventiveAction: "Месечна проверка на пълнотата на записите.",
    responsible: "Иван Петров", dueDate: (() => { const d = new Date(); d.setDate(d.getDate() + 10); return d.toISOString().slice(0, 10); })(),
    status: "in_progress",
  });
  state.notices.push(
    { id: uid(), date: today(), kind: "ai", text: "AI предложение: обединете процедурите за извънредни ситуации по ISO 14001 и ISO 45001 в един документ (ПР-Е-01).", read: false },
    { id: uid(), date: today(), kind: "warn", text: "Сертификатът на Принт Медия ЕООД изтича след 45 дни — планирайте надзорен одит.", read: false },
  );
  return state;
}

type StoreCtx = {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  notify: (text: string, kind?: Notice["kind"]) => void;
  ready: boolean;
};

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(emptyState);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppState;
        setState({ ...emptyState(), ...parsed, settings: { ...defaultSettings, ...parsed.settings } });
      } else {
        setState(seedState());
      }
    } catch {
      setState(seedState());
    }
    loaded.current = true;
    setReady(true);
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ }
  }, [state]);

  const notify = (text: string, kind: Notice["kind"] = "info") =>
    setState((s) => ({ ...s, notices: [{ id: uid(), date: today(), kind, text, read: false }, ...s.notices].slice(0, 50) }));

  const value = useMemo(() => ({ state, setState, notify, ready }), [state, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
