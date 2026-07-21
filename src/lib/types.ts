export type IsoStandardCode = "ISO 9001" | "ISO 14001" | "ISO 45001" | "ISO 27001" | "ISO 50001";

export type OrganizationStatus = "draft" | "implementation" | "ready" | "certified" | "attention";

export type Organization = {
  id: string;
  name: string;
  uic: string;
  address: string;
  manager: string;
  representative?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail: string;
  employees: number;
  activity: string;
  sites: number;
  standards: IsoStandardCode[];
  status: OrganizationStatus;
  readiness: number;
  nextAuditDate: string;
};

export type IsoStandard = {
  code: IsoStandardCode;
  title: string;
  scope: string;
  documents: number;
  sharedCoverage: number;
};

export type DocumentStatus = "draft" | "review" | "approved" | "needs_update";

export type ImsDocument = {
  id: string;
  organizationId: string;
  title: string;
  type: "policy" | "procedure" | "register" | "plan" | "report" | "matrix" | "form";
  standards: IsoStandardCode[];
  owner: string;
  status: DocumentStatus;
  version: string;
  updatedAt: string;
  content?: string;
};

export type Template = {
  id: string;
  title: string;
  type: ImsDocument["type"];
  standards: IsoStandardCode[];
  placeholders: string[];
};

export type TaskStatus = "open" | "in_progress" | "overdue" | "done";

export type ImsTask = {
  id: string;
  organizationId: string;
  title: string;
  dueDate: string;
  status: TaskStatus;
  owner: string;
  relatedStandard?: IsoStandardCode;
};

export type AiDraftRequest = {
  organizationId: string;
  prompt: string;
  standards: IsoStandardCode[];
};
