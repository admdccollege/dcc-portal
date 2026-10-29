import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { StudentForm } from "@/components/students/student-form";

export const metadata = { title: "Edit student" };

export default async function EditStudentPage({ params }: PageProps<"/students/[id]/edit">) {
  await requirePermission("students.manage");
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createClient();
  const { data: s } = await supabase.from("students").select("*, student_guardians(*)").eq("id", id).maybeSingle();
  if (!s) notFound();
  const g = s.student_guardians.find((x) => x.is_primary) ?? s.student_guardians[0];
  return (
    <div className="space-y-5">
      <PageHeader title={`Edit ${s.full_name}`} breadcrumbs={[{ label: "Students", href: "/students" }, { label: s.full_name, href: `/students/${id}` }, { label: "Edit" }]} />
      <StudentForm
        mode="edit"
        defaults={{
          id, full_name: s.full_name, date_of_birth: s.date_of_birth, gender: s.gender, phone: s.phone ?? "", email: s.email ?? "",
          address: s.address ?? "", admission_no: s.admission_no, university_roll_no: s.university_roll_no ?? "",
          registration_no: s.registration_no ?? "", admission_date: s.admission_date, scholarship_note: s.scholarship_note ?? "",
          guardian_name: g?.name ?? "", guardian_relationship: g?.relationship ?? "", guardian_phone: g?.phone ?? "", guardian_email: g?.email ?? "",
        }}
      />
    </div>
  );
}
