"use client";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { Button, Card, CardHead, Field, inputCls } from "@/components/ui";
import { AppState, Role, ROLES } from "@/lib/types";
import { exportBackup } from "@/lib/exportZip";

const WORKER_EXAMPLE = `export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const { model, messages } = await request.json();
    const result = await env.AI.run(model || "@cf/meta/llama-3.1-8b-instruct", { messages });
    return Response.json({ response: result.response }, { headers: cors });
  },
};
// wrangler.toml:  [ai]  binding = "AI"`;

export default function SettingsPage() {
  const { state, setState, notify } = useStore();
  const s = state.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [showWorker, setShowWorker] = useState(false);

  const upd = (patch: Partial<typeof s>) =>
    setState((st) => ({ ...st, settings: { ...st.settings, ...patch } }));

  const importBackup = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppState;
        if (!parsed.clients || !parsed.documents) throw new Error("invalid");
        setState(parsed);
        notify("Резервното копие е възстановено успешно.");
      } catch {
        notify("Файлът не е валидно резервно копие на системата.", "warn");
      }
    };
    reader.readAsText(f);
  };

  const reset = () => {
    if (confirm("Това ще изтрие всички локални данни и ще върне демо клиента. Продължаваме?")) {
      localStorage.removeItem("ismai-state-v1");
      location.reload();
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Настройки</h1>
        <p className="text-sm text-ink-faint">Профил, роли, AI интеграция и данни</p>
      </div>

      <Card>
        <CardHead title="Профил и роля" sub="Ролята определя гледната точка в системата (пълният контрол на достъпа идва със Supabase бекенда)" />
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <Field label="Име"><input className={inputCls} value={s.userName} onChange={(e) => upd({ userName: e.target.value })} /></Field>
          <Field label="Роля">
            <select className={inputCls} value={s.role} onChange={(e) => upd({ role: e.target.value as Role })}>
              {(Object.keys(ROLES) as Role[]).map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHead title="AI интеграция (Cloudflare Workers AI)" sub="Безплатен слой: ~10 000 неврона дневно. Без endpoint асистентът работи в локален команден режим." />
        <div className="space-y-4 px-5 py-4">
          <Field label="Worker endpoint URL" hint="Например: https://iso-ai.твоят-акаунт.workers.dev">
            <input className={inputCls} placeholder="https://…workers.dev" value={s.aiEndpoint} onChange={(e) => upd({ aiEndpoint: e.target.value })} />
          </Field>
          <Field label="Модел">
            <input className={inputCls} value={s.aiModel} onChange={(e) => upd({ aiModel: e.target.value })} />
          </Field>
          <button className="text-xs font-bold text-seal" onClick={() => setShowWorker((v) => !v)}>
            {showWorker ? "▾ Скрий" : "▸ Покажи"} примерен код за Worker-а
          </button>
          {showWorker && (
            <pre className="overflow-auto rounded-lg bg-ink p-4 font-mono text-[11px] leading-relaxed text-white">{WORKER_EXAMPLE}</pre>
          )}
        </div>
      </Card>

      <Card>
        <CardHead title="Данни" sub="Всичко се съхранява локално в браузъра (localStorage). Следваща фаза: Supabase бекенд с мулти-тенант достъп." />
        <div className="flex flex-wrap gap-2 px-5 py-4">
          <Button onClick={() => exportBackup(state)}>⇩ Резервно копие (JSON)</Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>⇪ Възстанови от копие</Button>
          <input ref={fileRef} type="file" hidden accept="application/json" onChange={(e) => importBackup(e.target.files)} />
          <Button variant="danger" onClick={reset}>Нулирай до демо данни</Button>
        </div>
      </Card>

      <p className="pb-8 text-center text-xs text-ink-faint">
        ISO Smart Manager AI · MVP v0.1 · локални данни · следваща фаза: Supabase + Cloudflare Workers AI
      </p>
    </div>
  );
}
