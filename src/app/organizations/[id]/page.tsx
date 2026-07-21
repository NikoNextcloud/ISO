import { AppShell } from "@/components/shell";
import { OrganizationDetailWorkspace } from "@/components/organization-detail-workspace";

export default async function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><OrganizationDetailWorkspace organizationId={id} /></AppShell>;
}
