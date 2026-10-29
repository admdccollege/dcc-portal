import { createElement } from "react";
import { apiGuard, isUuid } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import { StudentProfileDocument } from "@/lib/pdf/simple";
import { loadInstitution, pdfResponse } from "@/lib/pdf/render";

export async function GET(_req: Request, ctx: RouteContext<"/api/pdf/student-profile/[id]">) {
  const guard = await apiGuard(["students.view", "attendance.take"]);
  if (guard instanceof Response) return guard;
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: st } = await supabase.from("students")
    .select("*, student_guardians(name, phone, is_primary), student_enrolments(roll_no, status, programmes(code), programme_terms(name), student_subject_enrolments(course_offerings(subjects(code, name))))")
    .eq("id", id).maybeSingle();
  if (!st) return new Response("Not found", { status: 404 });
  const e = st.student_enrolments.find((x) => x.status === "active") ?? st.student_enrolments[0];
  const g = st.student_guardians.find((x) => x.is_primary) ?? st.student_guardians[0];
  const inst = await loadInstitution(supabase);
  return pdfResponse(createElement(StudentProfileDocument, {
    inst,
    st: {
      full_name: st.full_name, admission_no: st.admission_no, date_of_birth: st.date_of_birth, gender: st.gender, phone: st.phone, email: st.email,
      address: st.address, admission_date: st.admission_date, status: st.status, university_roll_no: st.university_roll_no, registration_no: st.registration_no,
      className: e ? `${e.programmes?.code ?? ""} ${e.programme_terms?.name ?? ""}` : "—", roll_no: e?.roll_no ?? null,
      guardian: g?.name ?? null, guardianPhone: g?.phone ?? null,
      subjects: (e?.student_subject_enrolments ?? []).map((x) => `${x.course_offerings?.subjects?.code} — ${x.course_offerings?.subjects?.name}`),
    },
  }), `student_${st.admission_no}.pdf`);
}
