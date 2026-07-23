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
      const payload = await response.json().catch(() => null) as { dataUrl?: string; model?: string; cached?: boolean; error?: string } | null;
      if (!response.ok || !payload?.dataUrl) throw new Error(payload?.error ?? "Cloudflare AI не върна изображение.");
      const pngDataUrl = await convertToPng(payload.dataUrl, {
        title: title.trim() || "AI визуализация",
        description: prompt.trim(),
        companyName: companyName.trim(),
        standard,
        layout,
        type,
        accent
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
      setStatus((current) => current ? { ...current, active: true, message: payload.cached ? "Изображението е заредено от кеша без нов AI разход." : "Cloudflare AI генерира изображението успешно." } : current);
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

function convertToPng(_source: string, labels: { title: string; description: string; companyName: string; standard: string; layout: string; type: string; accent: string }) {
  return new Promise<string>((resolve, reject) => {
    try {
      const dimensions = labels.layout === "portrait"
        ? { width: 1200, height: 1600 }
        : labels.layout === "square"
          ? { width: 1400, height: 1400 }
          : { width: 1600, height: 1067 };
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d");
      if (!context) { reject(new Error("Браузърът не успя да обработи AI изображението.")); return; }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      const padding = Math.round(canvas.width * 0.045);
      const headerHeight = Math.round(canvas.height * 0.14);
      const footerHeight = Math.round(canvas.height * (labels.layout === "portrait" ? 0.22 : 0.24));
      const imageBox = {
        x: padding,
        y: headerHeight,
        width: canvas.width - padding * 2,
        height: canvas.height - headerHeight - footerHeight
      };
      drawBulgarianDiagram(context, imageBox, labels.type, labels.accent);

      context.fillStyle = "#111827";
      context.font = `700 ${fitFont(context, labels.title, canvas.width - padding * 2, Math.round(canvas.width * 0.036), 28)}px "Segoe UI", Arial, sans-serif`;
      context.textBaseline = "top";
      context.fillText(labels.title, padding, Math.round(canvas.height * 0.035));
      context.fillStyle = "#475569";
      context.font = `500 ${Math.round(canvas.width * 0.019)}px "Segoe UI", Arial, sans-serif`;
      context.fillText([labels.companyName, labels.standard].filter(Boolean).join(" · "), padding, Math.round(canvas.height * 0.09));

      const footerY = canvas.height - footerHeight;
      context.strokeStyle = "#cbd5e1";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(padding, footerY + 18);
      context.lineTo(canvas.width - padding, footerY + 18);
      context.stroke();
      context.fillStyle = "#0f766e";
      context.font = `700 ${Math.round(canvas.width * 0.021)}px "Segoe UI", Arial, sans-serif`;
      context.fillText("Описание", padding, footerY + Math.round(footerHeight * 0.18));
      context.fillStyle = "#334155";
      const descriptionSize = Math.round(canvas.width * 0.018);
      context.font = `400 ${descriptionSize}px "Segoe UI", Arial, sans-serif`;
      drawWrappedText(context, labels.description, padding, footerY + Math.round(footerHeight * 0.37), canvas.width - padding * 2, Math.round(descriptionSize * 1.45), labels.layout === "portrait" ? 6 : 4);

      const result = canvas.toDataURL("image/png");
      if (result.length > 8_500_000) { reject(new Error("AI изображението е твърде голямо за документа.")); return; }
      resolve(result);
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Изображението не можа да бъде изчертано."));
    }
  });
}

type DiagramRect = { x: number; y: number; width: number; height: number };

const DIAGRAM_PALETTES: Record<string, { primary: string; secondary: string; light: string; dark: string }> = {
  "blue and teal": { primary: "#2563eb", secondary: "#0d9488", light: "#e0f2fe", dark: "#0f172a" },
  "green and charcoal": { primary: "#15803d", secondary: "#334155", light: "#dcfce7", dark: "#14532d" },
  "orange and navy": { primary: "#ea580c", secondary: "#1e3a8a", light: "#ffedd5", dark: "#172554" },
  "red and gray": { primary: "#dc2626", secondary: "#475569", light: "#fee2e2", dark: "#7f1d1d" }
};

function drawBulgarianDiagram(context: CanvasRenderingContext2D, box: DiagramRect, type: string, accent: string) {
  const palette = DIAGRAM_PALETTES[accent] ?? DIAGRAM_PALETTES["blue and teal"];
  context.fillStyle = "#f8fafc";
  roundedRect(context, box.x, box.y, box.width, box.height, 20);
  context.fill();
  context.strokeStyle = "#e2e8f0";
  context.lineWidth = 2;
  context.stroke();
  const inner = { x: box.x + box.width * 0.045, y: box.y + box.height * 0.07, width: box.width * 0.91, height: box.height * 0.86 };

  if (type === "organization-chart") drawOrganizationChart(context, inner, palette);
  else if (type === "risk-matrix") drawRiskMatrix(context, inner, palette);
  else if (type === "environment-energy") drawEnvironmentDiagram(context, inner, palette);
  else if (type === "data-chart") drawDataChart(context, inner, palette);
  else drawFlowDiagram(context, inner, type, palette);
}

function drawFlowDiagram(context: CanvasRenderingContext2D, box: DiagramRect, type: string, palette: { primary: string; secondary: string; light: string; dark: string }) {
  const labels = type === "incident-flow"
    ? ["Сигнал", "Регистриране", "Оценка", "Действие", "Проверка", "Приключване"]
    : type === "work-instruction"
      ? ["Подготовка", "Безопасност", "Изпълнение", "Контрол", "Запис"]
      : ["Вход", "Планиране", "Изпълнение", "Контрол", "Подобрение", "Резултат"];
  const vertical = box.height > box.width * 0.9;
  if (vertical) {
    const nodeWidth = box.width * 0.58;
    const nodeHeight = Math.min(112, box.height / (labels.length * 1.45));
    const gap = (box.height - nodeHeight * labels.length) / (labels.length - 1);
    labels.forEach((label, index) => {
      const x = box.x + (box.width - nodeWidth) / 2;
      const y = box.y + index * (nodeHeight + gap);
      drawNode(context, { x, y, width: nodeWidth, height: nodeHeight }, label, index === 0 || index === labels.length - 1 ? palette.primary : palette.secondary, "#ffffff");
      if (index < labels.length - 1) drawArrow(context, x + nodeWidth / 2, y + nodeHeight + 8, x + nodeWidth / 2, y + nodeHeight + gap - 8, palette.dark);
    });
    return;
  }
  const gap = box.width * 0.022;
  const nodeWidth = (box.width - gap * (labels.length - 1)) / labels.length;
  const nodeHeight = Math.min(150, box.height * 0.36);
  const y = box.y + (box.height - nodeHeight) / 2;
  labels.forEach((label, index) => {
    const x = box.x + index * (nodeWidth + gap);
    drawNode(context, { x, y, width: nodeWidth, height: nodeHeight }, label, index === 0 || index === labels.length - 1 ? palette.primary : palette.secondary, "#ffffff");
    if (index < labels.length - 1) drawArrow(context, x + nodeWidth + 5, y + nodeHeight / 2, x + nodeWidth + gap - 5, y + nodeHeight / 2, palette.dark);
  });
}

function drawOrganizationChart(context: CanvasRenderingContext2D, box: DiagramRect, palette: { primary: string; secondary: string; light: string; dark: string }) {
  const top = { x: box.x + box.width * 0.33, y: box.y, width: box.width * 0.34, height: box.height * 0.18 };
  drawNode(context, top, "Ръководство", palette.primary, "#ffffff");
  const departments = ["Качество", "Операции", "Администрация", "Поддръжка"];
  const roles = ["Отговорник по качеството", "Процесни отговорници", "Финанси и персонал", "Технически екип"];
  const gap = box.width * 0.025;
  const nodeWidth = (box.width - gap * 3) / 4;
  const rowHeight = box.height * 0.19;
  const rowOneY = box.y + box.height * 0.39;
  const rowTwoY = box.y + box.height * 0.76;
  const busY = box.y + box.height * 0.29;
  context.strokeStyle = palette.dark;
  context.lineWidth = Math.max(4, box.width * 0.004);
  context.beginPath();
  context.moveTo(top.x + top.width / 2, top.y + top.height);
  context.lineTo(top.x + top.width / 2, busY);
  context.lineTo(box.x + nodeWidth / 2, busY);
  context.moveTo(top.x + top.width / 2, busY);
  context.lineTo(box.x + box.width - nodeWidth / 2, busY);
  context.stroke();
  departments.forEach((label, index) => {
    const x = box.x + index * (nodeWidth + gap);
    context.beginPath();
    context.moveTo(x + nodeWidth / 2, busY);
    context.lineTo(x + nodeWidth / 2, rowOneY);
    context.stroke();
    drawNode(context, { x, y: rowOneY, width: nodeWidth, height: rowHeight }, label, palette.secondary, "#ffffff");
    drawArrow(context, x + nodeWidth / 2, rowOneY + rowHeight + 8, x + nodeWidth / 2, rowTwoY - 8, palette.dark);
    drawNode(context, { x, y: rowTwoY, width: nodeWidth, height: rowHeight }, roles[index], palette.light, palette.dark);
  });
}

function drawRiskMatrix(context: CanvasRenderingContext2D, box: DiagramRect, palette: { primary: string; secondary: string; light: string; dark: string }) {
  const labelSpace = Math.min(150, box.width * 0.13);
  const gridSize = Math.min(box.width - labelSpace * 1.3, box.height - labelSpace * 0.65);
  const cell = gridSize / 5;
  const x0 = box.x + (box.width - gridSize) / 2 + labelSpace * 0.2;
  const y0 = box.y + (box.height - gridSize) / 2;
  const colors = ["#dcfce7", "#bbf7d0", "#fef3c7", "#fed7aa", "#fecaca"];
  for (let row = 0; row < 5; row++) {
    for (let column = 0; column < 5; column++) {
      const level = Math.min(4, Math.floor((row + column) / 2));
      context.fillStyle = colors[level];
      context.fillRect(x0 + column * cell, y0 + (4 - row) * cell, cell, cell);
      context.strokeStyle = "#ffffff";
      context.lineWidth = 4;
      context.strokeRect(x0 + column * cell, y0 + (4 - row) * cell, cell, cell);
      drawCenteredText(context, String((row + 1) * (column + 1)), x0 + column * cell, y0 + (4 - row) * cell, cell, cell, Math.round(cell * 0.28), palette.dark, 700);
    }
  }
  drawCenteredText(context, "Въздействие", x0, y0 + gridSize + 18, gridSize, 50, 30, palette.dark, 700);
  context.save();
  context.translate(x0 - 55, y0 + gridSize / 2);
  context.rotate(-Math.PI / 2);
  drawCenteredText(context, "Вероятност", -gridSize / 2, -25, gridSize, 50, 30, palette.dark, 700);
  context.restore();
  const legend = [["Нисък", colors[0]], ["Среден", colors[2]], ["Висок", colors[3]], ["Критичен", colors[4]]] as const;
  legend.forEach(([label, color], index) => {
    const x = box.x + index * (box.width / legend.length);
    context.fillStyle = color;
    roundedRect(context, x + 8, box.y, box.width / legend.length - 16, 52, 10);
    context.fill();
    drawCenteredText(context, label, x + 8, box.y, box.width / legend.length - 16, 52, 24, palette.dark, 700);
  });
}

function drawEnvironmentDiagram(context: CanvasRenderingContext2D, box: DiagramRect, palette: { primary: string; secondary: string; light: string; dark: string }) {
  const topLabels = ["Ресурси", "Енергия", "Контрол"];
  const bottomLabels = ["Емисии", "Отпадъци", "Подобрение"];
  const nodeWidth = box.width * 0.23;
  const nodeHeight = box.height * 0.18;
  const center = { x: box.x + box.width * 0.34, y: box.y + box.height * 0.38, width: box.width * 0.32, height: box.height * 0.24 };
  const positions = [box.x + box.width * 0.04, box.x + box.width * 0.385, box.x + box.width * 0.73];
  topLabels.forEach((label, index) => {
    const node = { x: positions[index], y: box.y, width: nodeWidth, height: nodeHeight };
    drawNode(context, node, label, palette.primary, "#ffffff");
    drawArrow(context, node.x + node.width / 2, node.y + node.height + 8, center.x + center.width / 2, center.y - 8, palette.dark);
  });
  drawNode(context, center, "Организация", palette.secondary, "#ffffff");
  bottomLabels.forEach((label, index) => {
    const node = { x: positions[index], y: box.y + box.height - nodeHeight, width: nodeWidth, height: nodeHeight };
    drawArrow(context, center.x + center.width / 2, center.y + center.height + 8, node.x + node.width / 2, node.y - 8, palette.dark);
    drawNode(context, node, label, index === 2 ? palette.primary : palette.light, index === 2 ? "#ffffff" : palette.dark);
  });
}

function drawDataChart(context: CanvasRenderingContext2D, box: DiagramRect, palette: { primary: string; secondary: string; light: string; dark: string }) {
  const chart = { x: box.x + box.width * 0.09, y: box.y + box.height * 0.08, width: box.width * 0.84, height: box.height * 0.75 };
  context.strokeStyle = palette.dark;
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(chart.x, chart.y);
  context.lineTo(chart.x, chart.y + chart.height);
  context.lineTo(chart.x + chart.width, chart.y + chart.height);
  context.stroke();
  const values = [0.48, 0.72, 0.58, 0.84, 0.66, 0.91];
  const slot = chart.width / values.length;
  values.forEach((value, index) => {
    const barWidth = slot * 0.55;
    const height = chart.height * value;
    const x = chart.x + index * slot + (slot - barWidth) / 2;
    const y = chart.y + chart.height - height;
    const gradient = context.createLinearGradient(0, y, 0, y + height);
    gradient.addColorStop(0, palette.primary);
    gradient.addColorStop(1, palette.secondary);
    context.fillStyle = gradient;
    roundedRect(context, x, y, barWidth, height, 10);
    context.fill();
    drawCenteredText(context, `Данни ${index + 1}`, chart.x + index * slot, chart.y + chart.height + 15, slot, 55, 22, palette.dark, 600);
  });
}

function drawNode(context: CanvasRenderingContext2D, rect: DiagramRect, label: string, fill: string, textColor: string) {
  context.shadowColor = "rgba(15, 23, 42, 0.16)";
  context.shadowBlur = 12;
  context.shadowOffsetY = 5;
  context.fillStyle = fill;
  roundedRect(context, rect.x, rect.y, rect.width, rect.height, Math.min(18, rect.height * 0.16));
  context.fill();
  context.shadowColor = "transparent";
  drawCenteredText(context, label, rect.x + 8, rect.y + 6, rect.width - 16, rect.height - 12, Math.min(32, rect.height * 0.3), textColor, 700);
}

function drawArrow(context: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, color: string) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const head = 13;
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();
  context.beginPath();
  context.moveTo(toX, toY);
  context.lineTo(toX - head * Math.cos(angle - Math.PI / 6), toY - head * Math.sin(angle - Math.PI / 6));
  context.lineTo(toX - head * Math.cos(angle + Math.PI / 6), toY - head * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fill();
}

function drawCenteredText(context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, height: number, maxSize: number, color: string, weight: number) {
  let size = Math.max(14, Math.round(maxSize));
  let lines = wrapText(context, text, width, size, weight);
  while (size > 14 && (lines.length > 3 || lines.length * size * 1.22 > height)) {
    size -= 1;
    lines = wrapText(context, text, width, size, weight);
  }
  context.fillStyle = color;
  context.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const lineHeight = size * 1.18;
  const startY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.slice(0, 3).forEach((line, index) => context.fillText(line, x + width / 2, startY + index * lineHeight));
  context.textAlign = "start";
  context.textBaseline = "top";
}

function wrapText(context: CanvasRenderingContext2D, text: string, width: number, size: number, weight: number) {
  context.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || context.measureText(next).width <= width) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const value = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + value, y);
  context.lineTo(x + width - value, y);
  context.quadraticCurveTo(x + width, y, x + width, y + value);
  context.lineTo(x + width, y + height - value);
  context.quadraticCurveTo(x + width, y + height, x + width - value, y + height);
  context.lineTo(x + value, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - value);
  context.lineTo(x, y + value);
  context.quadraticCurveTo(x, y, x + value, y);
  context.closePath();
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
