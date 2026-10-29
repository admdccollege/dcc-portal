import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { StudentForm } from "@/components/students/student-form";

export const metadata = { title: "New student" };

export default async function NewStudentPage() {
  await requirePermission("students.manage");
  const ref = await getReferenceData();
  const supabase = await createClient();
  const { data: offerings } = await supabase
    .from("course_offerings")
    .select("id, programme_id, term_id, academic_session_id, is_compulsory, subjects(code, name)")
    .in("academic_session_id", ref.sessions.filter((s) => s.status === "active").map((s) => s.id));
  return (
    <div className="space-y-5">
      <PageHeader title="New student" breadcrumbs={[{ label: "Students", href: "/students" }, { label: "New" }]} />
      <StudentForm
        mode="create"
        sessions={ref.sessions.filter((s) => s.status === "active")}
        programmes={ref.programmes.filter((p) => p.is_active)}
        terms={ref.terms}
        offerings={(offerings ?? []).map((o) => ({ ...o, label: `${o.subjects?.code} — ${o.subjects?.name}` }))}
        defaults={{ academic_session_id: ref.currentSession?.id }}
      />
    </div>
  );
}
