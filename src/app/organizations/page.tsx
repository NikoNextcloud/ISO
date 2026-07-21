import { AppShell } from "@/components/shell";
import { OrganizationWorkspace } from "@/components/organization-workspace";

export default function OrganizationsPage() {
  return <AppShell><OrganizationWorkspace activeDocuments={0} view="organizations" /></AppShell>;
}
