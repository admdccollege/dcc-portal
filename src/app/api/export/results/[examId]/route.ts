import { apiGuard, isUuid } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import { exportResponse } from "@/lib/export";

export async function GET(request: Request, ctx: RouteContext<"/api/export/results/[examId]">) {
  const guard = await apiGuard(["results.view"], 10);
  if (guard instanceof Response) return guard;
  const { examId } = await ctx.params;
  if (!isUuid(examId)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: exam } = await supabase.from("examinations").select("name").eq("id", examId).maybeSingle();
  if (!exam) return new Response("Not found", { status: 404 });
  const { data } = await supabase.from("results").select("status, total_max, total_obtained, percentage, grade, grade_point, failed_subjects, verification_code, students(full_name, admission_no), student_enrolments(roll_no), result_subjects(subject_code, marks_obtained, max_marks, grade, status)").eq("examination_id", examId);
  const rows = (data ?? []).sort((a, b) => (a.student_enrolments?.roll_no ?? "").localeCompare(b.student_enrolments?.roll_no ?? ""));
  const codes = [...new Set(rows.flatMap((r) => r.result_subjects.map((s) => s.subject_code)))].sort();
  type Row = (typeof rows)[number];
  return exportResponse(new URL(request.url).searchParams.get("format"), rows, [
    { header: "Roll", value: (r: Row) => r.student_enrolments?.roll_no },
    { header: "Admission No", value: (r) => r.students?.admission_no, width: 16 },
    { header: "Name", value: (r) => r.students?.full_name, width: 26 },
    ...codes.map((c) => ({ header: c, value: (r: Row) => { const s = r.result_subjects.find((x) => x.subject_code === c); return s ? (s.status === "absent" ? "AB" : s.marks_obtained ?? s.status) : ""; } })),
    { header: "Total", value: (r) => r.total_obtained },
    { header: "Max", value: (r) => r.total_max },
    { header: "Percentage", value: (r) => r.percentage },
    { header: "Grade", value: (r) => r.grade },
    { header: "Grade Point", value: (r) => r.grade_point },
    { header: "Failed Subjects", value: (r) => r.failed_subjects },
    { header: "Result", value: (r) => r.status },
    { header: "Verification Code", value: (r) => r.verification_code },
  ], `results_${exam.name}`, `Results — ${exam.name}`);
}
