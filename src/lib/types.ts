export type IsoStandardCode = "ISO 9001" | "ISO 14001" | "ISO 45001" | "ISO 27001" | "ISO 50001" | "ISO 9-20-27" | "ISO 9-14" | "ISO 9001-14001-45001";

export type OrganizationStatus = "draft" | "implementation" | "ready" | "certified" | "attention";
export type DesignDevelopmentApplicability = "" | "applicable" | "not_applicable";

export type Organization = {
  id: string;
  name: string;
  uic: string;
  legalForm?: string;
  address: string;
  city?: string;
  manager: string;
  foundedAt?: string;
  representative?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail: string;
  employees: number;
  activity: string;
  physicalScope?: string;
  systemDate?: string;
  organizationContext?: string;
  processesDescription?: string;
  productsServices?: string;
  environmentalAspects?: string;
  occupationalRisks?: string;
  externalParties?: string;
  wasteManagement?: string;
  designDevelopment?: DesignDevelopmentApplicability;
  postDeliveryActivities?: string;
  trainingDetails?: string;
  internalAuditDate?: string;
  managementReviewDate?: string;
  previousYear?: number;
  currentYear?: number;
  sites: number;
  standards: IsoStandardCode[];
  status: OrganizationStatus;
  readiness: number;
  nextAuditDate: string;
};

export type OrganizationCertificate = {
  id: string;
  organizationId: string;
  standard: IsoStandardCode;
  certificateNumber: string;
  certificationBody: string;
  issuedAt: string;
  validUntil: string;
  nextCertificationDate: string;
  notes: string;
  createdAt: string;
};

export type OrganizationHistoryEntry = {
  id: string;
  organizationId: string;
  eventType: "organization_created" | "organization_updated" | "certificate_added" | "certificate_removed" | "system_exported" | "document_uploaded" | "document_removed";
  description: string;
  eventDate: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
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
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
};
