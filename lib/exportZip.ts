import JSZip from "jszip";
import { AppState, Client, DOC_STATUSES, DOC_TYPES, IsoDocument, STANDARDS } from "./types";

function docHeader(d: IsoDocument, c: Client): string {
  return `| Поле | Стойност |
|---|---|
| Код | ${d.code} |
| Документ | ${d.title} |
| Тип | ${DOC_TYPES[d.type]} |
| Организация | ${c.name} (ЕИК ${c.eik}) |
| Стандарти | ${d.standards.map((s) => STANDARDS[s].name).join(", ")} |
| Версия | ${d.version} · ${d.date} |
| Статус | ${DOC_STATUSES[d.status]} |
| Автор | ${d.author} · Одобрил: ${d.approver} |
${d.signedBy ? `| Електронен подпис | ${d.signedBy} · ${d.signedAt} |\n` : ""}
---

`;
}

export async function exportClientZip(state: AppState, client: Client): Promise<void> {
  const zip = new JSZip();
  const docs = state.documents.filter((d) => d.clientId === client.id);
  const folder = zip.folder(client.name.replace(/[\\/:*?"<>|]/g, "_"))!;
  for (const d of docs) {
    const name = `${d.code} ${d.title}`.replace(/[\\/:*?"<>|]/g, "_");
    folder.file(`${name}.md`, docHeader(d, client) + d.content);
  }
  const risks = state.risks.filter((r) => r.clientId === client.id);
  if (risks.length) {
    folder.file(
      "Регистър на рисковете.md",
      `# Регистър на рисковете — ${client.name}\n\n| Риск | Категория | В | Вл | Ниво | Контроли | Мерки | Остатъчен |\n|---|---|---|---|---|---|---|---|\n` +
        risks.map((r) => `| ${r.title} | ${r.category} | ${r.probability} | ${r.impact} | ${r.probability * r.impact} | ${r.controls} | ${r.measures} | ${r.residual} |`).join("\n")
    );
  }
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `${client.name} — ISO документация.zip`);
}

export function exportBackup(state: AppState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  triggerDownload(blob, `iso-smart-manager-backup-${new Date().toISOString().slice(0, 10)}.json`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
