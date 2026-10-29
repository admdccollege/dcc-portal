import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { qrDataUrl } from "./common";
import type { MarksheetData } from "./marksheet";

/** Loads marksheet data through the caller's RLS-scoped client (students see only their own published results). */
export async function loadMarksheets(supabase: ServerSupabase, by: { resultId?: string; examId?: string }): Promise<MarksheetData[]> {
  let q = supabase
    .from("results")
    .select("id, status, total_max, total_obtained, percentage, grade, grade_point, credits_earned, verification_code, computed_at, students(full_name, admission_no, university_roll_no, registration_no, date_of_birth), student_enrolments(roll_no), examinations(name, status, is_provisional, published_at, programmes(name), programme_terms(name), academic_sessions(name)), result_subjects(subject_code, subject_name, category, credits, max_marks, marks_obtained, grade, grade_point, status, components)");
  if (by.resultId) q = q.eq("id", by.resultId);
  if (by.examId) q = q.eq("examination_id", by.examId);
  const { data, error } = await q.limit(500);
  if (error || !data) return [];
  const site = publicEnv.siteUrl();
  const rows = data.sort((a, b) => (a.student_enrolments?.roll_no ?? "zzz").localeCompare(b.student_enrolments?.roll_no ?? "zzz"));
  return Promise.all(rows.map(async (r) => ({
    result: { id: r.id, status: r.status, total_max: r.total_max, total_obtained: r.total_obtained, percentage: r.percentage, grade: r.grade, grade_point: r.grade_point, credits_earned: r.credits_earned, verification_code: r.verification_code, computed_at: r.computed_at },
    student: r.students!,
    rollNo: r.student_enrolments?.roll_no ?? null,
    exam: { name: r.examinations?.name ?? "", status: r.examinations?.status ?? "", is_provisional: r.examinations?.is_provisional ?? true, published_at: r.examinations?.published_at ?? null },
    programme: r.examinations?.programmes?.name ?? "",
    term: r.examinations?.programme_terms?.name ?? "",
    session: r.examinations?.academic_sessions?.name ?? "",
    subjects: r.result_subjects.sort((a, b) => a.subject_code.localeCompare(b.subject_code)).map((x) => ({ ...x, components: (x.components as MarksheetData["subjects"][number]["components"]) ?? [] })),
    qr: await qrDataUrl(`${site}/verify/${r.verification_code}`),
  })));
}
