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
      const pngDataUrl = await convertToPng(payload.dataUrl, {
        title: title.trim() || "AI визуализация",
        description: prompt.trim(),
        companyName: companyName.trim(),
        standard,
        layout
      });
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
      <label className="grid min-w-0 gap-1.5 text-sm font-medium text-ink md:col-span-2">Съдържание и реални данни на български
        <textarea className="focus-ring min-h-28 w-full min-w-0 rounded border border-line bg-white p-3 text-sm font-normal outline-none" maxLength={1800} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        <span className="text-xs font-normal text-slate-500">Заглавието и описанието се изписват върху изображението на български.</span>
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

function convertToPng(source: string, labels: { title: string; description: string; companyName: string; standard: string; layout: string }) {
  return new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const dimensions = labels.layout === "portrait"
        ? { width: 900, height: 1200 }
        : labels.layout === "square"
          ? { width: 1000, height: 1000 }
          : { width: 1200, height: 800 };
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d");
      if (!context) { reject(new Error("Браузърът не успя да обработи AI изображението.")); return; }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      const padding = Math.round(canvas.width * 0.045);
      const headerHeight = labels.layout === "portrait" ? 150 : 130;
      const footerHeight = labels.layout === "portrait" ? 260 : 210;
      const imageBox = {
        x: padding,
        y: headerHeight,
        width: canvas.width - padding * 2,
        height: canvas.height - headerHeight - footerHeight
      };
      const scale = Math.min(imageBox.width / image.naturalWidth, imageBox.height / image.naturalHeight);
      const drawWidth = Math.round(image.naturalWidth * scale);
      const drawHeight = Math.round(image.naturalHeight * scale);
      context.drawImage(
        image,
        imageBox.x + Math.round((imageBox.width - drawWidth) / 2),
        imageBox.y + Math.round((imageBox.height - drawHeight) / 2),
        drawWidth,
        drawHeight
      );

      context.fillStyle = "#111827";
      context.font = `700 ${fitFont(context, labels.title, canvas.width - padding * 2, labels.layout === "portrait" ? 34 : 38, 24)}px "Segoe UI", Arial, sans-serif`;
      context.textBaseline = "top";
      context.fillText(labels.title, padding, 32);
      context.fillStyle = "#475569";
      context.font = `500 ${labels.layout === "portrait" ? 20 : 18}px "Segoe UI", Arial, sans-serif`;
      context.fillText([labels.companyName, labels.standard].filter(Boolean).join(" · "), padding, 82);

      const footerY = canvas.height - footerHeight;
      context.strokeStyle = "#cbd5e1";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(padding, footerY + 18);
      context.lineTo(canvas.width - padding, footerY + 18);
      context.stroke();
      context.fillStyle = "#0f766e";
      context.font = `700 ${labels.layout === "portrait" ? 22 : 20}px "Segoe UI", Arial, sans-serif`;
      context.fillText("Описание", padding, footerY + 38);
      context.fillStyle = "#334155";
      context.font = `400 ${labels.layout === "portrait" ? 21 : 19}px "Segoe UI", Arial, sans-serif`;
      drawWrappedText(context, labels.description, padding, footerY + 78, canvas.width - padding * 2, labels.layout === "portrait" ? 30 : 27, labels.layout === "portrait" ? 6 : 4);

      const result = canvas.toDataURL("image/png");
      if (result.length > 4_500_000) { reject(new Error("AI изображението е твърде голямо за документа.")); return; }
      resolve(result);
    };
    image.onerror = () => reject(new Error("Cloudflare AI върна невалидно изображение."));
    image.src = source;
  });
}

function fitFont(context: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, minimum: number) {
  let size = start;
  while (size > minimum) {
    context.font = `700 ${size}px "Segoe UI", Arial, sans-serif`;
    if (context.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const usedWords = lines.join(" ").split(" ").length;
  if (usedWords < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last && context.measureText(`${last}...`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trimEnd()}...`;
  }
  lines.forEach((value, index) => context.fillText(value, x, y + index * lineHeight));
}

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `visual-${Date.now()}`;
}

function safeFileName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9а-яА-Я._-]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "ai-visual";
}
