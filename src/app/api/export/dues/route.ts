import { apiGuard, qp, isUuid } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import { exportResponse } from "@/lib/export";
import { getReferenceData, programmeCode, termName } from "@/lib/queries/reference";

export async function GET(request: Request) {
  const guard = await apiGuard(["fees.export"], 10);
  if (guard instanceof Response) return guard;
  const url = new URL(request.url);
  const supabase = await createClient();
  const ref = await getReferenceData();
  const session = qp(url, "session") ?? ref.currentSession?.id;
  let q = supabase.from("student_fee_balances").select("*").eq("is_cancelled", false).gt("balance", 0).order("balance", { ascending: false }).limit(10000);
  if (isUuid(session)) q = q.eq("academic_session_id", session);
  const { data } = await q;
  const ids = [...new Set((data ?? []).map((d) => d.student_id!))];
  const { data: studs } = ids.length ? await supabase.from("students").select("id, full_name, admission_no, phone").in("id", ids) : { data: [] };
  const by = new Map((studs ?? []).map((s) => [s.id, s]));
  type Row = NonNullable<typeof data>[number];
  return exportResponse(url.searchParams.get("format"), data ?? [], [
    { header: "Admission No", value: (r: Row) => by.get(r.student_id!)?.admission_no, width: 16 },
    { header: "Student", value: (r) => by.get(r.student_id!)?.full_name, width: 26 },
    { header: "Phone", value: (r) => by.get(r.student_id!)?.phone },
    { header: "Class", value: (r) => `${programmeCode(ref, r.programme_id)} ${r.term_id ? termName(ref, r.term_id) : ""}` },
    { header: "Fee", value: (r) => r.fee_structure_name, width: 22 },
    { header: "Gross", value: (r) => Number(r.gross_amount) },
    { header: "Concessions", value: (r) => Number(r.concessions) },
    { header: "Paid", value: (r) => Number(r.paid) },
    { header: "Balance", value: (r) => Number(r.balance) },
    { header: "Due Date", value: (r) => r.due_date },
    { header: "Overdue", value: (r) => (r.is_overdue ? "Yes" : "No") },
  ], "outstanding_dues", "Outstanding fee dues");
}
