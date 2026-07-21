import { AppShell } from "@/components/shell";
import { OrganizationWorkspace } from "@/components/organization-workspace";
import { documents } from "@/lib/mock-data";

const activeDocuments = documents.filter((document) => document.status !== "approved").length;

export default function DashboardPage() {
  return <AppShell><OrganizationWorkspace activeDocuments={activeDocuments} view="dashboard" /></AppShell>;
}
