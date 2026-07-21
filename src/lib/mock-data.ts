import type { ImsDocument, ImsTask, IsoStandard, Organization, Template } from "./types";

export const standards: IsoStandard[] = [
  {
    code: "ISO 9001",
    title: "Система за управление на качеството",
    scope: "Процеси, клиенти, доставчици, несъответствия и подобрение.",
    documents: 42,
    sharedCoverage: 68
  },
  {
    code: "ISO 14001",
    title: "Управление на околната среда",
    scope: "Екологични аспекти, отпадъци, аварии и мониторинг.",
    documents: 31,
    sharedCoverage: 54
  },
  {
    code: "ISO 45001",
    title: "Здраве и безопасност при работа",
    scope: "Опасности, оценка на риска, мерки, инциденти и обучения.",
    documents: 36,
    sharedCoverage: 57
  },
  {
    code: "ISO 27001",
    title: "Информационна сигурност",
    scope: "Активи, рискове, SoA, достъп, инциденти и доставчици.",
    documents: 48,
    sharedCoverage: 42
  },
  {
    code: "ISO 50001",
    title: "Енергийно управление",
    scope: "Енергиен преглед, базова линия, EnPI, цели и мониторинг.",
    documents: 27,
    sharedCoverage: 49
  }
];

export const organizations: Organization[] = [
  {
    id: "org-1",
    name: "Метал Форм АД",
    uic: "204512345",
    address: "Пловдив, Индустриална зона",
    manager: "Иван Петров",
    contactEmail: "office@metalform.example",
    employees: 86,
    activity: "Металообработка и CNC производство",
    sites: 2,
    standards: ["ISO 9001", "ISO 14001", "ISO 45001"],
    status: "implementation",
    readiness: 72,
    nextAuditDate: "2026-09-18"
  },
  {
    id: "org-2",
    name: "Дигитал Сейф ООД",
    uic: "207712340",
    address: "София, бул. България 88",
    manager: "Мария Георгиева",
    contactEmail: "security@digitalsafe.example",
    employees: 34,
    activity: "Разработка на софтуер и поддръжка на облачни услуги",
    sites: 1,
    standards: ["ISO 9001", "ISO 27001"],
    status: "attention",
    readiness: 58,
    nextAuditDate: "2026-08-04"
  },
  {
    id: "org-3",
    name: "Енерго Плант ЕООД",
    uic: "205098765",
    address: "Стара Загора, Производствен парк",
    manager: "Николай Димитров",
    contactEmail: "ims@energoplant.example",
    employees: 142,
    activity: "Производство с висока енергийна интензивност",
    sites: 3,
    standards: ["ISO 9001", "ISO 14001", "ISO 45001", "ISO 50001"],
    status: "ready",
    readiness: 91,
    nextAuditDate: "2026-10-22"
  }
];

export const documents: ImsDocument[] = [
  {
    id: "doc-1",
    organizationId: "org-1",
    title: "Интегрирана политика по качество, околна среда и ЗБУТ",
    type: "policy",
    standards: ["ISO 9001", "ISO 14001", "ISO 45001"],
    owner: "IMS консултант",
    status: "approved",
    version: "1.2",
    updatedAt: "2026-07-14"
  },
  {
    id: "doc-2",
    organizationId: "org-1",
    title: "Матрица на процесите и приложимите клаузи",
    type: "matrix",
    standards: ["ISO 9001", "ISO 14001", "ISO 45001"],
    owner: "Процесен собственик",
    status: "review",
    version: "0.9",
    updatedAt: "2026-07-19"
  },
  {
    id: "doc-3",
    organizationId: "org-2",
    title: "Регистър на информационните активи",
    type: "register",
    standards: ["ISO 27001"],
    owner: "CISO",
    status: "needs_update",
    version: "0.7",
    updatedAt: "2026-07-10"
  },
  {
    id: "doc-4",
    organizationId: "org-3",
    title: "Енергиен преглед и базова линия",
    type: "report",
    standards: ["ISO 50001"],
    owner: "Енергиен мениджър",
    status: "draft",
    version: "0.3",
    updatedAt: "2026-07-20"
  }
];

export const templates: Template[] = [
  {
    id: "tpl-1",
    title: "Интегрирана политика",
    type: "policy",
    standards: ["ISO 9001", "ISO 14001", "ISO 45001", "ISO 27001", "ISO 50001"],
    placeholders: ["company_name", "scope", "standards", "manager", "approval_date"]
  },
  {
    id: "tpl-2",
    title: "Контекст на организацията",
    type: "report",
    standards: ["ISO 9001", "ISO 14001", "ISO 45001", "ISO 27001", "ISO 50001"],
    placeholders: ["activity", "internal_issues", "external_issues", "interested_parties"]
  },
  {
    id: "tpl-3",
    title: "Оценка на риска",
    type: "matrix",
    standards: ["ISO 9001", "ISO 45001", "ISO 27001", "ISO 50001"],
    placeholders: ["process", "hazards", "threats", "controls", "risk_level", "actions"]
  }
];

export const tasks: ImsTask[] = [
  {
    id: "task-1",
    organizationId: "org-2",
    title: "Завършване на Statement of Applicability",
    dueDate: "2026-07-28",
    status: "in_progress",
    owner: "CISO",
    relatedStandard: "ISO 27001"
  },
  {
    id: "task-2",
    organizationId: "org-1",
    title: "Преглед на оценките на риска за CNC оператори",
    dueDate: "2026-07-18",
    status: "overdue",
    owner: "ЗБУТ експерт",
    relatedStandard: "ISO 45001"
  },
  {
    id: "task-3",
    organizationId: "org-3",
    title: "Потвърждение на EnPI и енергийни цели",
    dueDate: "2026-08-02",
    status: "open",
    owner: "Енергиен мениджър",
    relatedStandard: "ISO 50001"
  }
];
