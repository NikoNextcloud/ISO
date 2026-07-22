"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Download, Image, Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export type AiVisualTarget = {
  sourceHash: string;
  label: string;
};

export type AiGeneratedVisual = {
  id: string;
  title: string;
  type: string;
  prompt: string;
  pngDataUrl: string;
  targetHash: string;
  targetLabel: string;
};

type AiStatus = {
  active: boolean;
  configured: boolean;
  model: string;
  message: string;
};

const VISUAL_TYPES = [
  { value: "process-map", label: "Процесна карта", prompt: "Покажи основните управленски, оперативни и поддържащи процеси и връзките между тях." },
  { value: "organization-chart", label: "Организационна схема", prompt: "Покажи ясна йерархична организационна структура с ръководство, отговорници и основни отдели." },
  { value: "risk-matrix", label: "Матрица на риска", prompt: "Създай матрица вероятност по въздействие с нисък, среден, висок и критичен риск." },
  { value: "incident-flow", label: "Процес при инцидент", prompt: "Покажи последователност от откриване и регистриране до анализ, действие, проверка и приключване." },
  { value: "environment-energy", label: "Екология и енергия", prompt: "Покажи потоците на ресурси, енергия, емисии, отпадъци, контрол и подобрение." },
  { value: "data-chart", label: "Графика по данни", prompt: "Създай ясна управленска графика само по посочените реални стойности и периоди." },
  { value: "work-instruction", label: "Работна инструкция", prompt: "Покажи последователни безопасни стъпки за изпълнение на описаната дейност." }
] as const;

const ACCENTS = [
  { value: "blue and teal", label: "Синьо и тюркоаз" },
  { value: "green and charcoal", label: "Зелено и графит" },
  { value: "orange and navy", label: "Оранжево и тъмносиньо" },
  { value: "red and gray", label: "Червено и сиво" }
];

export function AiVisualStudio({
  standard,
  companyName,
  targets = [],
  value,
  onChange
}: {
  standard: string;
  companyName: string;
  targets?: AiVisualTarget[];
  value: AiGeneratedVisual[];
  onChange: (visuals: AiGeneratedVisual[]) => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [type, setType] = useState<(typeof VISUAL_TYPES)[number]["value"]>("process-map");
  const [title, setTitle] = useState("Процесна карта");
  const [prompt, setPrompt] = useState<string>(VISUAL_TYPES[0].prompt);
  const [accent, setAccent] = useState(ACCENTS[0].value);
  const [layout, setLayout] = useState("landscape");
  const [targetHash, setTargetHash] = useState("");
  const [generationError, setGenerationError] = useState("");

  useEffect(() => { void checkStatus(); }, []);

  async function authHeaders(json = false) {
    const headers: Record<string, string> = {};
    if (json) headers["Content-Type"] = "application/json";
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    }
    return headers;
  }

  async function checkStatus() {
    setChecking(true);
    try {
      const response = await fetch("/api/ai/status", { headers: await authHeaders(), cache: "no-store" });
      const payload = await response.json().catch(() => null) as AiStatus | null;
      setStatus(payload ?? { active: false, configured: false, model: "", message: "Неуспешна проверка на Cloudflare AI." });
    } catch (error) {
      setStatus({ active: false, configured: false, model: "", message: error instanceof Error ? error.message : "Неуспешна проверка на Cloudflare AI." });
    } finally {
      setChecking(false);
    }
  }

  function selectType(nextType: (typeof VISUAL_TYPES)[number]["value"]) {
    const option = VISUAL_TYPES.find((item) => item.value === nextType)!;
    setType(nextType);
    setTitle(option.label);
    setPrompt(option.prompt);
  }

  async function generateVisual() {
    setGenerationError("");
    if (!prompt.trim()) { setGenerationError("Опишете съдържанието на визуализацията."); return; }
    if (value.length >= 4 && !targetHash) { setGenerationError("В един ZIP могат да се включат до 4 AI визуализации."); return; }
    setGenerating(true);
    try {
      const response = await fetch("/api/ai/generate-visual", {
        method: "POST",
        headers: await authHeaders(true),
        body: JSON.stringify({ type, prompt, companyName, standard, accent, layout })
      });
      const payload = await response.json().catch(() => null) as { dataUrl?: string; model?: string; error?: string } | null;
      if (!response.ok || !payload?.dataUrl) throw new Error(payload?.error ?? "Cloudflare AI не върна изображение.");
      const pngDataUrl = await convertToPng(payload.dataUrl);
      const targetLabel = targets.find((item) => item.sourceHash === targetHash)?.label ?? "Нов PNG файл в ZIP";
      const visual: AiGeneratedVisual = {
        id: makeId(), title: title.trim() || "AI визуализация", type, prompt: prompt.trim(),
        pngDataUrl, targetHash, targetLabel
      };
      const next = targetHash
        ? [...value.filter((item) => item.targetHash !== targetHash), visual]
        : [...value, visual];
      onChange(next.slice(-4));
      setStatus((current) => current ? { ...current, active: true, message: "Cloudflare AI генерира изображението успешно." } : current);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI визуализацията не беше генерирана.";
      setGenerationError(message);
      setStatus((current) => ({ active: false, configured: current?.configured ?? true, model: current?.model ?? "", message }));
    } finally {
      setGenerating(false);
    }
  }

  function removeVisual(id: string) {
    onChange(value.filter((item) => item.id !== id));
  }

  const statusActive = status?.active && !checking;
  const statusProblem = status && !status.active && !checking;

  return <section className="min-w-0 sm:col-span-2 rounded border border-line bg-slate-50">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div>
        <h4 className="flex items-center gap-2 text-sm font-semibold text-ink"><Sparkles className="h-4 w-4 text-teal-600" />AI визуализации</h4>
        <p className="mt-1 text-xs font-normal text-slate-500">Cloudflare Workers AI</p>
      </div>
      <div className="w-full min-w-0 text-left sm:w-auto sm:max-w-sm sm:text-right">
        <button
          className={`focus-ring inline-flex h-9 max-w-full items-center gap-2 rounded border px-3 text-sm font-semibold transition ${statusActive ? "border-emerald-500 bg-emerald-500 text-white shadow-[0_0_18px_rgba(16,185,129,0.45)]" : statusProblem ? "border-red-500 bg-red-500 text-white shadow-[0_0_18px_rgba(239,68,68,0.35)]" : "border-amber-300 bg-amber-50 text-amber-800"}`}
          disabled={checking}
          onClick={() => void checkStatus()}
          type="button"
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : statusActive ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {checking ? "Проверка..." : statusActive ? "AI активно" : "AI проблем"}
          {!checking ? <RefreshCw className="h-3.5 w-3.5" /> : null}
        </button>
        {status?.message ? <p className={`mt-1.5 break-all text-xs font-normal ${statusActive ? "text-emerald-700" : "text-red-700"}`}>{status.message}</p> : null}
      </div>
    </div>

    <div className="grid min-w-0 gap-4 p-4 md:grid-cols-2">
      <label className="grid min-w-0 gap-1.5 text-sm font-medium text-ink">Тип визуализация
        <select className="focus-ring h-10 w-full min-w-0 rounded border border-line bg-white px-3 text-sm font-normal outline-none" value={type} onChange={(event) => selectType(event.target.value as (typeof VISUAL_TYPES)[number]["value"])}>
          {VISUAL_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label className="grid min-w-0 gap-1.5 text-sm font-medium text-ink">Заглавие
        <input className="focus-ring h-10 w-full min-w-0 rounded border border-line bg-white px-3 text-sm font-normal outline-none" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="grid min-w-0 gap-1.5 text-sm font-medium text-ink">Цветова схема
        <select className="focus-ring h-10 w-full min-w-0 rounded border border-line bg-white px-3 text-sm font-normal outline-none" value={accent} onChange={(event) => setAccent(event.target.value)}>
          {ACCENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <fieldset className="grid min-w-0 gap-1.5 text-sm font-medium text-ink"><legend>Ориентация</legend>
        <div className="grid h-10 w-full min-w-0 grid-cols-3 overflow-hidden rounded border border-line bg-white">
          {[["landscape", "Хоризонтална"], ["portrait", "Вертикална"], ["square", "Квадратна"]].map(([key, label]) =>
            <button className={`text-xs font-medium ${layout === key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`} key={key} onClick={() => setLayout(key)} type="button">{label}</button>
          )}
        </div>
      </fieldset>
      <label className="grid min-w-0 gap-1.5 text-sm font-medium text-ink md:col-span-2">Къде да бъде използвана
        <select className="focus-ring h-10 w-full min-w-0 rounded border border-line bg-white px-3 text-sm font-normal outline-none" value={targetHash} onChange={(event) => setTargetHash(event.target.value)}>
          <option value="">Добави като нов PNG в папка „AI визуализации“</option>
          {targets.map((item) => <option key={item.sourceHash} value={item.sourceHash}>Замени: {item.label}</option>)}
        </select>
      </label>
      <label className="grid min-w-0 gap-1.5 text-sm font-medium text-ink md:col-span-2">Съдържание и реални данни
        <textarea className="focus-ring min-h-28 w-full min-w-0 rounded border border-line bg-white p-3 text-sm font-normal outline-none" maxLength={1800} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
      </label>
      {generationError ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-normal text-red-700 md:col-span-2">{generationError}</p> : null}
      <div className="flex min-w-0 justify-end md:col-span-2">
        <button className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto" disabled={!statusActive || generating} onClick={() => void generateVisual()} type="button">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? "AI генерира..." : "Генерирай с AI"}
        </button>
      </div>
    </div>

    {value.length ? <div className="border-t border-line px-4 py-4">
      <div className="mb-3 flex items-center justify-between"><h5 className="text-sm font-semibold text-ink">Включени визуализации</h5><span className="text-xs text-slate-500">{value.length}/4</span></div>
      <div className="grid gap-3 lg:grid-cols-2">
        {value.map((visual) => <article className="grid min-w-0 gap-3 rounded border border-line bg-white p-3 sm:grid-cols-[112px_1fr_auto]" key={visual.id}>
          <img alt={visual.title} className="h-32 w-full rounded border border-line bg-white object-contain sm:h-20 sm:w-28" src={visual.pngDataUrl} />
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{visual.title}</p><p className="mt-1 line-clamp-2 text-xs font-normal text-slate-500">{visual.targetLabel}</p></div>
          <div className="flex flex-col gap-1">
            <a aria-label="Свали визуализацията" className="focus-ring grid h-8 w-8 place-items-center rounded text-slate-500 hover:bg-slate-100 hover:text-action" download={`${safeFileName(visual.title)}.png`} href={visual.pngDataUrl} title="Свали"><Download className="h-4 w-4" /></a>
            <button aria-label="Премахни визуализацията" className="focus-ring grid h-8 w-8 place-items-center rounded text-slate-500 hover:bg-red-50 hover:text-red-600" onClick={() => removeVisual(visual.id)} title="Премахни" type="button"><Trash2 className="h-4 w-4" /></button>
          </div>
        </article>)}
      </div>
    </div> : <div className="flex items-center gap-2 border-t border-line px-4 py-3 text-xs font-normal text-slate-500"><Image className="h-4 w-4" />Няма добавени AI визуализации.</div>}
  </section>;
}

function convertToPng(source: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const maxDimension = 1100;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) { reject(new Error("Браузърът не успя да обработи AI изображението.")); return; }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL("image/png");
      if (result.length > 4_500_000) { reject(new Error("AI изображението е твърде голямо за документа.")); return; }
      resolve(result);
    };
    image.onerror = () => reject(new Error("Cloudflare AI върна невалидно изображение."));
    image.src = source;
  });
}

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `visual-${Date.now()}`;
}

function safeFileName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9а-яА-Я._-]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "ai-visual";
}
