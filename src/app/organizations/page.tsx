import { AppShell } from "@/components/shell";
import { OrganizationWorkspace } from "@/components/organization-workspace";

export default function OrganizationsPage() {
  return <AppShell><OrganizationWorkspace view="organizations" /></AppShell>;
}
