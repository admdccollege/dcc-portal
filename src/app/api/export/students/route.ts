import { apiGuard, qp, isUuid } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import { exportResponse } from "@/lib/export";
import { searchFilter } from "@/lib/utils";
import { getReferenceData, programmeCode, termName } from "@/lib/queries/reference";

export async function GET(request: Request) {
  const guard = await apiGuard(["students.export"], 10);
  if (guard instanceof Response) return guard;
  const url = new URL(request.url);
  const supabase = await createClient();
  const ref = await getReferenceData();
  const sessionId = qp(url, "session") ?? ref.currentSession?.id;

  let q = supabase
    .from("student_enrolments")
    .select("roll_no, section, programme_id, term_id, academic_sessions(name), students!inner(admission_no, university_roll_no, registration_no, full_name, date_of_birth, gender, phone, email, status, student_guardians(name, phone, is_primary))")
    .order("programme_id").order("term_id").order("roll_no")
    .limit(5000);
  if (isUuid(sessionId)) q = q.eq("academic_session_id", sessionId);
  const programme = qp(url, "programme");
  const term = qp(url, "term");
  const status = qp(url, "status");
  if (isUuid(programme)) q = q.eq("programme_id", programme);
  if (isUuid(term)) q = q.eq("term_id", term);
  if (status) q = q.eq("students.status", status as "active");
  const search = searchFilter(["full_name", "admission_no", "university_roll_no", "phone"], qp(url, "q"));
  if (search) q = q.or(search, { referencedTable: "students" });

  const { data, error } = await q;
  if (error) return new Response("Could not export", { status: 500 });
  type Row = NonNullable<typeof data>[number];
  const guardian = (r: Row) => r.students.student_guardians.find((g) => g.is_primary) ?? r.students.student_guardians[0];

  return exportResponse(url.searchParams.get("format"), data ?? [], [
    { header: "Admission No", value: (r: Row) => r.students.admission_no, width: 16 },
    { header: "Name", value: (r) => r.students.full_name, width: 28 },
    { header: "Session", value: (r) => r.academic_sessions?.name },
    { header: "Programme", value: (r) => programmeCode(ref, r.programme_id) },
    { header: "Class/Semester", value: (r) => termName(ref, r.term_id) },
    { header: "Roll No", value: (r) => r.roll_no },
    { header: "University Roll No", value: (r) => r.students.university_roll_no },
    { header: "Registration No", value: (r) => r.students.registration_no },
    { header: "Date of Birth", value: (r) => r.students.date_of_birth },
    { header: "Gender", value: (r) => r.students.gender },
    { header: "Phone", value: (r) => r.students.phone },
    { header: "Email", value: (r) => r.students.email, width: 28 },
    { header: "Guardian", value: (r) => guardian(r)?.name },
    { header: "Guardian Phone", value: (r) => guardian(r)?.phone },
    { header: "Status", value: (r) => r.students.status },
  ], "students", "Damdei Christian College — Student list");
}
