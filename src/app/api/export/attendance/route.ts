import { apiGuard, qp, isUuid } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import { exportResponse } from "@/lib/export";
import { getReferenceData, programmeCode } from "@/lib/queries/reference";

export async function GET(request: Request) {
  const guard = await apiGuard(["attendance.take", "attendance.view_all"], 10);
  if (guard instanceof Response) return guard;
  const url = new URL(request.url);
  const ref = await getReferenceData();
  const sessionId = qp(url, "session") ?? ref.currentSession?.id;
  const term = ref.terms.find((t) => t.id === qp(url, "term"));
  if (!isUuid(sessionId) || !term) return new Response("Select a class", { status: 400 });
  const subject = qp(url, "subject");
  const from = qp(url, "from");
  const to = qp(url, "to");
  const supabase = await createClient();
  const [{ data: summary }, { data: roster }] = await Promise.all([
    supabase.rpc("attendance_summary", {
      p_academic_session_id: sessionId, p_programme_id: term.programme_id, p_term_id: term.id,
      p_offering_id: isUuid(subject) ? subject : undefined, p_from: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined, p_to: to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined,
    }),
    supabase.from("student_enrolments").select("student_id, roll_no, students(full_name, admission_no)").eq("academic_session_id", sessionId).eq("term_id", term.id),
  ]);
  const by = new Map((summary ?? []).map((s) => [s.student_id, s]));
  const rows = (roster ?? []).sort((a, b) => (a.roll_no ?? "").localeCompare(b.roll_no ?? "")).map((r) => ({ ...r, s: by.get(r.student_id) }));
  type Row = (typeof rows)[number];
  return exportResponse(url.searchParams.get("format"), rows, [
    { header: "Roll", value: (r: Row) => r.roll_no },
    { header: "Admission No", value: (r) => r.students?.admission_no, width: 16 },
    { header: "Name", value: (r) => r.students?.full_name, width: 28 },
    { header: "Attended", value: (r) => Number(r.s?.attended ?? 0) },
    { header: "Eligible", value: (r) => Number(r.s?.eligible ?? 0) },
    { header: "Excused", value: (r) => Number(r.s?.excluded ?? 0) },
    { header: "Percentage", value: (r) => (r.s?.percentage === null || r.s?.percentage === undefined ? "No records" : Number(r.s.percentage)) },
  ], `attendance_${programmeCode(ref, term.programme_id)}_${term.name}`, `Attendance — ${programmeCode(ref, term.programme_id)} ${term.name}`);
}
