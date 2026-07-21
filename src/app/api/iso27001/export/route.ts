import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { replaceWordText, writeZip, type ZipEntry } from "@/lib/zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportRequest = {
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
};

async function authorize(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return true;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return !error && Boolean(data.user);
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

function safeName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 70) || "Организация";
}

function replacementMap(data: Required<ExportRequest>): Array<[string, string]> {
  const companyVariants = [
    "“БМ ПРОТЕКШЪН“ ЕООД", "“БМ ПРОТЕКШЪН” ЕООД", "„БМ ПРОТЕКШЪН“ ЕООД", "„БМ ПРОТЕКШЪН” ЕООД",
    "\"БМ ПРОТЕКШЪН\" ЕООД", "БМ ПРОТЕКШЪН ЕООД"
  ];
  const map: Array<[string, string]> = [
    ["{{COMPANY_NAME}}", data.companyName], ["{{UIC}}", data.uic], ["{{ADDRESS}}", data.address || "Не е посочен"],
    ["{{MANAGER}}", data.manager || "Не е посочен"], ["{{REPRESENTATIVE}}", data.representative || data.manager || "Не е посочен"],
    ["{{CONTACT_NAME}}", data.contactName || data.representative || data.manager || "Не е посочен"], ["{{EMAIL}}", data.email || "Не е посочен"],
    ["{{PHONE}}", data.phone || "Не е посочен"], ["{{EMPLOYEES}}", String(data.employees || 0)],
    ["{{ACTIVITY}}", data.activity || "Не е посочена"], ["{{SCOPE}}", data.scope || data.activity || "Не е посочен"],
    ["{{EFFECTIVE_DATE}}", formatDate(data.effectiveDate)], ["{{VERSION}}", data.version],
    ["Владимира  Емилова", data.manager || "Управител"], ["Владимира Емилова", data.manager || "Управител"],
    ["Георги Златков Драмов", data.manager || "Управител"], ["Лилия Каменова - Тошева", data.manager || "Управител"],
    ["13.01.2025", formatDate(data.effectiveDate)], ["02.05.2025", formatDate(data.effectiveDate)],
    ["Версия № 2", `Версия № ${data.version}`], ["Версия № 1", `Версия № ${data.version}`],
    ["Област: София (столица), Община: Столична", `Адрес: ${data.address || "Не е посочен"}`],
    ["Населено място: гр. София, п.к. 1404", ""], ["р-н Триадица", ""], ["бул./ул. Силиврия № 5 офис 1", ""],
    ["“БМ ПРОТЕКШЪН“ ЕООД е организация предоставяща услуги, свързани с охрана на имущество на физически и юридически лица. Сигнално охранителна дейност. Охрана на обекти – недвижими имоти. Охрана на мероприятия.", `${data.companyName} е организация с основна дейност: ${data.activity || "не е посочена"}.`]
  ];
  companyVariants.forEach((variant) => map.push([variant, data.companyName]));
  return map;
}

export async function POST(request: NextRequest) {
  try {
    if (!await authorize(request)) return Response.json({ error: "Необходим е вход в приложението." }, { status: 401 });
    const body = await request.json() as ExportRequest;
    const data: Required<ExportRequest> = {
      companyName: requiredText(body.companyName, "Име на фирмата"),
      uic: requiredText(body.uic, "ЕИК", 30),
      address: optionalText(body.address), manager: optionalText(body.manager), representative: optionalText(body.representative),
      contactName: optionalText(body.contactName), email: optionalText(body.email, 200), phone: optionalText(body.phone, 80),
      employees: Math.max(0, Number(body.employees) || 0), activity: optionalText(body.activity, 1000), scope: optionalText(body.scope, 1500),
      effectiveDate: optionalText(body.effectiveDate, 20) || new Date().toISOString().slice(0, 10), version: optionalText(body.version, 20) || "1"
    };
    const templateRoot = path.join(process.cwd(), "templates", "iso27001");
    const files = await walk(templateRoot);
    const folder = `ISO 27001 - ${safeName(data.companyName)}`;
    const replacements = replacementMap(data);
    const entries: ZipEntry[] = [];
    for (const file of files) {
      let content = await fs.readFile(file.absolute);
      if (file.relative.toLocaleLowerCase("bg").endsWith(".docx")) content = replaceWordText(content, replacements);
      entries.push({ name: path.posix.join(folder, file.relative), data: content });
    }
    const summary = [
      "ISO/IEC 27001:2022 - комплект документация", `Организация: ${data.companyName}`, `ЕИК: ${data.uic}`,
      `Адрес: ${data.address}`, `Управител: ${data.manager}`, `Дата на генериране: ${formatDate(new Date().toISOString().slice(0, 10))}`,
      `Документи: ${files.length}`, "", "Забележка: Файлът NISU PRILOJENIE 1- Org, Chart.doc е в стар DOC формат и е включен без автоматична замяна."
    ].join("\r\n");
    entries.unshift({ name: path.posix.join(folder, "README - ДАННИ ЗА ЕКСПОРТА.txt"), data: Buffer.from(summary, "utf8") });
    const archive = writeZip(entries);
    const filename = `ISO-27001-${safeName(data.companyName)}.zip`;
    return new Response(new Uint8Array(archive), { headers: {
      "Content-Type": "application/zip", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store", "X-Document-Count": String(files.length)
    } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неуспешно генериране на системата.";
    return Response.json({ error: message }, { status: 500 });
  }
}
