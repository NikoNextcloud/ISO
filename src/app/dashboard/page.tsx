import { AppShell } from "@/components/shell";
import { OrganizationWorkspace } from "@/components/organization-workspace";

export default function DashboardPage() {
  return <AppShell><OrganizationWorkspace view="dashboard" /></AppShell>;
}
