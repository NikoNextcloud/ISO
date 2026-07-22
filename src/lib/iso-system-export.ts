import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { replaceWordText, writeZip, type WordLogoReplacement, type ZipEntry } from "@/lib/zip";

export type IsoExportRequest = {
  companyName: string;
  uic: string;
  address?: string;
  manager?: string;
  representative?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  employees?: number;
  activity?: string;
  scope?: string;
  effectiveDate?: string;
  version?: string;
  logoPngDataUrl?: string;
};

type NormalizedExportData = Omit<Required<IsoExportRequest>, "logoPngDataUrl"> & { logoPngDataUrl: string };

export type IsoExportConfig = {
  code: "ISO 27001" | "ISO 45001";
  edition: string;
  templateDirectory: "iso27001" | "iso45001";
  logoMode: WordLogoReplacement["mode"];
  logoSourceHashes?: string[];
  replacements: (data: NormalizedExportData) => Array<[string, string]>;
};

export const iso27001ExportConfig: IsoExportConfig = {
  code: "ISO 27001",
  edition: "ISO/IEC 27001:2022",
  templateDirectory: "iso27001",
  logoMode: "header-images",
  replacements: (data) => {
    const companyVariants = [
      "“БМ ПРОТЕКШЪН“ ЕООД", "“БМ ПРОТЕКШЪН” ЕООД", "„БМ ПРОТЕКШЪН“ ЕООД", "„БМ ПРОТЕКШЪН” ЕООД",
      "\"БМ ПРОТЕКШЪН\" ЕООД", "БМ ПРОТЕКШЪН ЕООД"
    ];
    const result: Array<[string, string]> = [
      ["Владимира  Емилова", data.manager || "Управител"], ["Владимира Емилова", data.manager || "Управител"],
      ["Георги Златков Драмов", data.manager || "Управител"], ["Лилия Каменова - Тошева", data.manager || "Управител"],
      ["13.01.2025", formatDate(data.effectiveDate)], ["02.05.2025", formatDate(data.effectiveDate)],
      ["Версия № 2", `Версия № ${data.version}`], ["Версия № 1", `Версия № ${data.version}`],
      ["Област: София (столица), Община: Столична", `Адрес: ${data.address || "Не е посочен"}`],
      ["Населено място: гр. София, п.к. 1404", ""], ["р-н Триадица", ""], ["бул./ул. Силиврия № 5 офис 1", ""],
      ["“БМ ПРОТЕКШЪН“ ЕООД е организация предоставяща услуги, свързани с охрана на имущество на физически и юридически лица. Сигнално охранителна дейност. Охрана на обекти – недвижими имоти. Охрана на мероприятия.", `${data.companyName} е организация с основна дейност: ${data.activity || "не е посочена"}.`]
    ];
    companyVariants.forEach((variant) => result.push([variant, data.companyName]));
    return result;
  }
};

export const iso45001ExportConfig: IsoExportConfig = {
  code: "ISO 45001",
  edition: "ISO 45001",
  templateDirectory: "iso45001",
  logoMode: "matching-images",
  logoSourceHashes: ["007edd5d4b66e5f0e100381691d731eba96a4b9199cc5a95cbdfd7ed23c7e4a8"],
  replacements: (data) => [
    ["„ СМП ПЛЕВЕН“ ЕООД", data.companyName], ["„СМП ПЛЕВЕН“ ЕООД", data.companyName],
    ["\"СМП ПЛЕВЕН\" ЕООД", data.companyName], ["СМП ПЛЕВЕН ЕООД", data.companyName],
    ["машинно-ремонтни дейности", data.activity || "дейността на организацията"],
    ["монтажна, машинно-ремонтна и строително-монтажна дейност", data.activity || "дейността на организацията"],
    ["АДЕЛИЯ ТОМОВА ТОДОРОВА", data.manager || "УПРАВИТЕЛ"], ["Аделия Томова Тодорова", data.manager || "Управител"],
    ["гр. Плевен", data.address || "Адресът не е посочен"],
    ["12 януари 2026 г.", formatLongDate(data.effectiveDate)], ["12 януари 2026 г", formatLongDate(data.effectiveDate)],
    ["12.01.2026 г.", formatDate(data.effectiveDate)], ["12.01.2026г.", formatDate(data.effectiveDate)],
    ["12.01.2026", formatDate(data.effectiveDate)], ["23.02.2026", formatDate(data.effectiveDate)],
    ["Версия: 01", `Версия: ${data.version}`], ["Версия: 0 1", `Версия: ${data.version}`],
    ["рев . ном .: 0 1", `рев. ном.: ${data.version}`], ["рев. ном.: 0 1", `рев. ном.: ${data.version}`]
  ]
};

export async function authorizeIsoExport(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return true;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return !error && Boolean(data.user);
}

export async function createIsoSystemArchive(body: IsoExportRequest, config: IsoExportConfig) {
  const data = normalizeRequest(body);
  const templateRoot = path.join(process.cwd(), "templates", config.templateDirectory);
  const files = await walk(templateRoot);
  if (!files.length) throw new Error(`Няма налични шаблони за ${config.code}.`);

  const logoData = decodeLogo(data.logoPngDataUrl);
  const logo = logoData ? { data: logoData, mode: config.logoMode, sourceHashes: config.logoSourceHashes } satisfies WordLogoReplacement : undefined;
  const replacements = [...baseReplacements(data), ...config.replacements(data)];
  const folder = `${config.code} - ${safeName(data.companyName)}`;
  const entries: ZipEntry[] = [];

  for (const file of files) {
    let content = await fs.readFile(file.absolute);
    if (file.relative.toLocaleLowerCase("bg").endsWith(".docx")) content = replaceWordText(content, replacements, logo);
    entries.push({ name: path.posix.join(folder, file.relative), data: content });
  }

  const summary = [
    `${config.edition} - комплект документация`, `Организация: ${data.companyName}`, `ЕИК: ${data.uic}`,
    `Адрес: ${data.address || "Не е посочен"}`, `Управител: ${data.manager || "Не е посочен"}`,
    `Дата на генериране: ${formatDate(new Date().toISOString().slice(0, 10))}`, `Документи: ${files.length}`,
    `Фирмено лого: ${logoData ? "заменено в шаблоните" : "запазено от оригиналните шаблони"}`
  ].join("\r\n");
  entries.unshift({ name: path.posix.join(folder, "README - ДАННИ ЗА ЕКСПОРТА.txt"), data: Buffer.from(summary, "utf8") });

  return {
    archive: writeZip(entries),
    filename: `${config.code.replace("ISO ", "ISO-")}-${safeName(data.companyName)}.zip`,
    documentCount: files.length
  };
}

function normalizeRequest(body: IsoExportRequest): NormalizedExportData {
  return {
    companyName: requiredText(body.companyName, "Име на фирмата"), uic: requiredText(body.uic, "ЕИК", 30),
    address: optionalText(body.address), manager: optionalText(body.manager), representative: optionalText(body.representative),
    contactName: optionalText(body.contactName), email: optionalText(body.email, 200), phone: optionalText(body.phone, 80),
    employees: Math.max(0, Number(body.employees) || 0), activity: optionalText(body.activity, 1000), scope: optionalText(body.scope, 1500),
    effectiveDate: optionalText(body.effectiveDate, 20) || new Date().toISOString().slice(0, 10),
    version: optionalText(body.version, 20) || "1", logoPngDataUrl: optionalText(body.logoPngDataUrl, 5_800_000)
  };
}

function baseReplacements(data: NormalizedExportData): Array<[string, string]> {
  return [
    ["{{COMPANY_NAME}}", data.companyName], ["{{UIC}}", data.uic], ["{{ADDRESS}}", data.address || "Не е посочен"],
    ["{{MANAGER}}", data.manager || "Не е посочен"], ["{{REPRESENTATIVE}}", data.representative || data.manager || "Не е посочен"],
    ["{{CONTACT_NAME}}", data.contactName || data.representative || data.manager || "Не е посочен"],
    ["{{EMAIL}}", data.email || "Не е посочен"], ["{{PHONE}}", data.phone || "Не е посочен"],
    ["{{EMPLOYEES}}", String(data.employees || 0)], ["{{ACTIVITY}}", data.activity || "Не е посочена"],
    ["{{SCOPE}}", data.scope || data.activity || "Не е посочен"], ["{{EFFECTIVE_DATE}}", formatDate(data.effectiveDate)],
    ["{{VERSION}}", data.version]
  ];
}

function decodeLogo(value: string) {
  if (!value) return undefined;
  const match = /^data:image\/png;base64,([a-z0-9+/=]+)$/i.exec(value);
  if (!match) throw new Error("Логото трябва да бъде валидно PNG изображение.");
  const data = Buffer.from(match[1], "base64");
  if (data.length > 4_000_000) throw new Error("Логото е твърде голямо. Максималният размер е 4 MB.");
  if (data.length < 8 || data.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("Логото не е валиден PNG файл.");
  return data;
}

async function walk(directory: string, relative = ""): Promise<Array<{ absolute: string; relative: string }>> {
  const items = await fs.readdir(directory, { withFileTypes: true });
  const result: Array<{ absolute: string; relative: string }> = [];
  for (const item of items) {
    const absolute = path.join(directory, item.name);
    const childRelative = path.posix.join(relative, item.name);
    if (item.isDirectory()) result.push(...await walk(absolute, childRelative));
    else result.push({ absolute, relative: childRelative });
  }
  return result;
}

function requiredText(value: unknown, name: string, max = 250) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} е задължително поле.`);
  return value.trim().slice(0, max);
}

function optionalText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function formatDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

function formatLongDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const months = ["януари", "февруари", "март", "април", "май", "юни", "юли", "август", "септември", "октомври", "ноември", "декември"];
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]} г.`;
}

function safeName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 70) || "Организация";
}
