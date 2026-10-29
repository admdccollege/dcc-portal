import { requireStudent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, programmeCode, termName } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { formatDate, titleCase } from "@/lib/utils";

export const metadata = { title: "My profile" };

export default async function MyProfile() {
  const session = await requireStudent();
  const supabase = await createClient();
  const ref = await getReferenceData();
  const { data: s } = await supabase.from("students").select("*, student_guardians(name, relationship, phone), student_enrolments(roll_no, status, programme_id, term_id, academic_sessions(name), student_subject_enrolments(course_offerings(subjects(code, name))))").eq("id", session.studentId).single();
  if (!s) return null;
  const active = s.student_enrolments.find((e) => e.status === "active");
  const rows: [string, string | null][] = [
    ["Admission no.", s.admission_no], ["Date of birth", formatDate(s.date_of_birth)], ["Gender", titleCase(s.gender)], ["Phone", s.phone], ["Email", s.email],
    ["Admission date", formatDate(s.admission_date)], ["University / council roll no.", s.university_roll_no], ["Registration no.", s.registration_no], ["Address", s.address],
  ];
  return (
    <div className="space-y-5">
      <PageHeader title={s.full_name} description={active ? `${programmeCode(ref, active.programme_id)} · ${termName(ref, active.term_id)} · ${active.academic_sessions?.name}` : undefined} />
      <Alert variant="info">To correct any details, please contact the college office. Changes are verified before they are made.</Alert>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Personal details</CardTitle></CardHeader>
          <CardContent><dl className="grid gap-4 sm:grid-cols-2">{rows.map(([l, v]) => <div key={l}><dt className="text-xs text-muted-foreground">{l}</dt><dd className="text-sm font-medium">{v || "—"}</dd></div>)}</dl></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Guardian</CardTitle></CardHeader>
          <CardContent className="text-sm">{s.student_guardians.map((g, i) => <p key={i}>{g.name} ({g.relationship})<br /><span className="text-muted-foreground">{g.phone}</span></p>)}</CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>My subjects</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">{(active?.student_subject_enrolments ?? []).map((x, i) => <span key={i} className="rounded-md border px-2 py-1 text-sm"><span className="font-mono text-xs text-muted-foreground">{x.course_offerings?.subjects?.code}</span> {x.course_offerings?.subjects?.name}</span>)}</CardContent>
        </Card>
      </div>
    </div>
  );
}
