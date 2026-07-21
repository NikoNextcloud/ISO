import { AppShell } from "@/components/shell";
import { DocumentWorkspace } from "@/components/document-workspace";
import { OrganizationWorkspace } from "@/components/organization-workspace";
import { StandardsWorkspace } from "@/components/standards-workspace";
import { documents } from "@/lib/mock-data";

const activeDocuments = documents.filter((document) => document.status !== "approved").length;

export default function Home() {
  return <AppShell>
    <OrganizationWorkspace activeDocuments={activeDocuments} />
    <StandardsWorkspace />
    <DocumentWorkspace />
  </AppShell>;
}
