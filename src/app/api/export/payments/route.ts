import { apiGuard, qp } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import { exportResponse } from "@/lib/export";

export async function GET(request: Request) {
  const guard = await apiGuard(["fees.export"], 10);
  if (guard instanceof Response) return guard;
  const url = new URL(request.url);
  const from = qp(url, "from"), to = qp(url, "to");
  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!isDate(from) || !isDate(to)) return new Response("Invalid date range", { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.from("payments").select("receipt_no, payment_date, amount, method_code, reference_no, status, remarks, students(full_name, admission_no), student_fee_assignments(fee_structures(name))")
    .gte("payment_date", from!).lte("payment_date", to!).order("payment_date").order("receipt_no").limit(10000);
  type Row = NonNullable<typeof data>[number];
  return exportResponse(url.searchParams.get("format"), data ?? [], [
    { header: "Date", value: (r: Row) => r.payment_date },
    { header: "Receipt No", value: (r) => r.receipt_no, width: 22 },
    { header: "Admission No", value: (r) => r.students?.admission_no, width: 16 },
    { header: "Student", value: (r) => r.students?.full_name, width: 26 },
    { header: "Fee", value: (r) => r.student_fee_assignments?.fee_structures?.name, width: 22 },
    { header: "Method", value: (r) => r.method_code },
    { header: "Reference", value: (r) => r.reference_no },
    { header: "Amount", value: (r) => Number(r.amount) },
    { header: "Status", value: (r) => r.status },
    { header: "Remarks", value: (r) => r.remarks },
  ], `collection_${from}_${to}`, `Fee collection ${from} to ${to}`);
}
