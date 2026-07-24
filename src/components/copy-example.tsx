"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyExample({ text }: { text?: string }) {
  const [copied, setCopied] = useState(false);
  const value = cleanExample(text);
  if (!value) return null;

  async function copyExample() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex min-w-0 items-start gap-2 text-xs font-normal text-slate-500">
      <p className="min-w-0 flex-1 select-text leading-5">
        <span className="font-semibold text-slate-600">Пример: </span>
        {value}
      </p>
      <button
        aria-label={copied ? "Примерът е копиран" : "Копирай примера"}
        className={`focus-ring grid h-7 w-7 shrink-0 place-items-center rounded transition ${
          copied ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-100 hover:text-ink"
        }`}
        onClick={copyExample}
        title={copied ? "Копирано" : "Копирай примера"}
        type="button"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function cleanExample(value?: string) {
  return value?.trim().replace(/^Например:\s*/iu, "").replace(/\.{3}$/u, "").trim() ?? "";
}
