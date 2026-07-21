export type StandardCode = "9001" | "14001" | "45001" | "27001" | "50001";

export const STANDARDS: Record<StandardCode, { name: string; full: string }> = {
  "9001": { name: "ISO 9001", full: "Система за управление на качеството" },
  "14001": { name: "ISO 14001", full: "Система за управление на околната среда" },
  "45001": { name: "ISO 45001", full: "Здраве и безопасност при работа" },
  "27001": { name: "ISO 27001", full: "Сигурност на информацията" },
  "50001": { name: "ISO 50001", full: "Управление на енергията" },
};

export type Role = "admin" | "consultant" | "auditor" | "client" | "readonly";

export const ROLES: Record<Role, string> = {
  admin: "Администратор",
  consultant: "Консултант",
  auditor: "Одитор",
  client: "Клиент",
  readonly: "Само четене",
};

export interface Client {
  id: string;
  name: string;
  eik: string;
  address: string;
  contactPerson: string;
  phone: string;
  email: string;
  employees: number;
  activity: string;
  sites: string;
  workingHours: string;
  orgStructure: string;
  standards: StandardCode[];
  integrated: boolean;
  createdAt: string;
  certExpiry?: string; // ISO date
  generated: boolean;
}

export type DocType =
  | "manual" | "policy" | "objective" | "procedure" | "instruction"
  | "record" | "form" | "register" | "matrix" | "plan" | "report" | "analysis";

export const DOC_TYPES: Record<DocType, string> = {
  manual: "Наръчник",
  policy: "Политика",
  objective: "Цели и програми",
  procedure: "Процедура",
  instruction: "Работна инструкция",
  record: "Запис",
  form: "Формуляр",
  register: "Регистър",
  matrix: "Матрица",
  plan: "План",
  report: "Доклад",
  analysis: "Анализ",
};

export type DocStatus = "draft" | "review" | "approved" | "active" | "archived";

export const DOC_STATUSES: Record<DocStatus, string> = {
  draft: "Чернова",
  review: "Преглед",
  approved: "Одобрен",
  active: "Активен",
  archived: "Архив",
};

export const DOC_FLOW: DocStatus[] = ["draft", "review", "approved", "active", "archived"];

export interface DocHistoryEntry {
  version: string;
  date: string;
  author: string;
  note: string;
}

export interface IsoDocument {
  id: string;
  clientId: string;
  code: string; // e.g. ПР-03
  title: string;
  type: DocType;
  standards: StandardCode[];
  version: string;
  date: string;
  author: string;
  approver: string;
  status: DocStatus;
  content: string; // markdown-ish
  history: DocHistoryEntry[];
  related: string[]; // doc codes
  signedBy?: string; // electronic signature
  signedAt?: string;
}

export interface Risk {
  id: string;
  clientId: string;
  standards: StandardCode[];
  title: string;
  category: string;
  probability: number; // 1-5
  impact: number; // 1-5
  controls: string;
  measures: string;
  residual: number; // 1-25
  owner: string;
  status: "open" | "treated" | "accepted";
}

export type AuditType = "internal" | "external" | "certification" | "surveillance" | "recert";

export const AUDIT_TYPES: Record<AuditType, string> = {
  internal: "Вътрешен одит",
  external: "Външен одит",
  certification: "Сертификационен одит",
  surveillance: "Надзорен одит",
  recert: "Ресертификация",
};

export interface ChecklistItem {
  clause: string;
  text: string;
  result: "pending" | "conform" | "nc" | "observation";
  evidence: string;
}

export interface Audit {
  id: string;
  clientId: string;
  type: AuditType;
  standards: StandardCode[];
  plannedDate: string;
  auditor: string;
  status: "planned" | "in_progress" | "done";
  checklist: ChecklistItem[];
  findings: string;
  ncIds: string[];
}

export type NcCategory = "major" | "minor" | "observation";

export const NC_CATEGORIES: Record<NcCategory, string> = {
  major: "Голямо несъответствие",
  minor: "Малко несъответствие",
  observation: "Наблюдение",
};

export interface Nonconformity {
  id: string;
  clientId: string;
  number: string;
  source: string;
  category: NcCategory;
  description: string;
  fiveWhy: string[];
  rootCause: string;
  correction: string;
  correctiveAction: string;
  preventiveAction: string;
  responsible: string;
  dueDate: string;
  status: "open" | "in_progress" | "closed";
  closedDate?: string;
}

export interface InfoAsset {
  id: string;
  clientId: string;
  name: string;
  type: string;
  owner: string;
  c: number; i: number; a: number; // 1-3
  threats: string;
  vulnerabilities: string;
  controls: string; // Annex A refs
  riskLevel: number;
  treatment: "mitigate" | "accept" | "transfer" | "avoid";
}

export interface EnergyIndicator {
  id: string;
  clientId: string;
  name: string;
  unit: string;
  baseline: number;
  current: number;
  target: number;
  period: string;
}

export interface Task {
  id: string;
  clientId: string;
  title: string;
  dueDate: string;
  assignee: string;
  status: "open" | "done";
}

export interface Notice {
  id: string;
  date: string;
  kind: "info" | "warn" | "ai";
  text: string;
  read: boolean;
}

export interface Objective {
  id: string;
  clientId: string;
  standards: StandardCode[];
  title: string;
  kpi: string;
  target: string;
  deadline: string;
  progress: number; // 0-100
}

export interface Settings {
  role: Role;
  userName: string;
  aiEndpoint: string; // Cloudflare Worker URL
  aiModel: string;
}

export interface AppState {
  clients: Client[];
  documents: IsoDocument[];
  risks: Risk[];
  audits: Audit[];
  ncs: Nonconformity[];
  assets: InfoAsset[];
  energy: EnergyIndicator[];
  tasks: Task[];
  objectives: Objective[];
  notices: Notice[];
  settings: Settings;
}

export function riskLevel(p: number, i: number): number {
  return p * i;
}

export function riskLabel(level: number): { label: string; tone: "ok" | "warn" | "danger" } {
  if (level >= 15) return { label: "Висок", tone: "danger" };
  if (level >= 8) return { label: "Среден", tone: "warn" };
  return { label: "Нисък", tone: "ok" };
}

export function clientReadiness(state: AppState, clientId: string): number {
  const docs = state.documents.filter((d) => d.clientId === clientId);
  if (!docs.length) return 0;
  const weight: Record<DocStatus, number> = { draft: 0.25, review: 0.5, approved: 0.8, active: 1, archived: 0 };
  const activeDocs = docs.filter((d) => d.status !== "archived");
  if (!activeDocs.length) return 0;
  const docScore = activeDocs.reduce((s, d) => s + weight[d.status], 0) / activeDocs.length;
  const ncs = state.ncs.filter((n) => n.clientId === clientId);
  const openNc = ncs.filter((n) => n.status !== "closed").length;
  const ncPenalty = Math.min(0.2, openNc * 0.04);
  return Math.round(Math.max(0, docScore - ncPenalty) * 100);
}

export const uid = () => Math.random().toString(36).slice(2, 10);
export const today = () => new Date().toISOString().slice(0, 10);
