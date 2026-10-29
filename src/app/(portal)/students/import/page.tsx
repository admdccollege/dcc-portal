import { requirePermission } from "@/lib/auth/session";
import { getReferenceData } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { ImportWizard } from "@/components/students/import-wizard";

export const metadata = { title: "Import students" };

export default async function ImportPage() {
  await requirePermission("students.import");
  const ref = await getReferenceData();
  return (
    <div className="space-y-5">
      <PageHeader title="Import students" description="Upload a CSV or Excel file. Every row is validated before anything is saved; the import is all-or-nothing." breadcrumbs={[{ label: "Students", href: "/students" }, { label: "Import" }]} />
      <ImportWizard
        sessions={ref.sessions.filter((s) => s.status === "active").map((s) => ({ id: s.id, name: s.name }))}
        programmes={ref.programmes.filter((p) => p.is_active).map((p) => ({ id: p.id, name: `${p.code} — ${p.name}` }))}
        terms={ref.terms}
        defaultSession={ref.currentSession?.id}
      />
    </div>
  );
}
