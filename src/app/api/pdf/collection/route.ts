import { createElement } from "react";
import { apiGuard, qp } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import { TabularReportDocument } from "@/lib/pdf/simple";
import { loadInstitution, pdfResponse } from "@/lib/pdf/render";
import { rs } from "@/lib/pdf/common";

export async function GET(request: Request) {
  const guard = await apiGuard(["fees.export"], 10);
  if (guard instanceof Response) return guard;
  const url = new URL(request.url);
  const from = qp(url, "from"), to = qp(url, "to");
  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!isDate(from) || !isDate(to)) return new Response("Invalid date range", { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.from("payments").select("receipt_no, payment_date, amount, method_code, status, students(full_name, admission_no)")
    .gte("payment_date", from!).lte("payment_date", to!).order("payment_date").order("receipt_no").limit(5000);
  const done = (data ?? []).filter((p) => p.status === "completed");
  const total = done.reduce((a, p) => a + Number(p.amount), 0);
  const inst = await loadInstitution(supabase);
  return pdfResponse(createElement(TabularReportDocument, {
    inst,
    title: "Fee collection report",
    subtitle: `${from} to ${to} · ${done.length} receipts · Total ${rs(total)} (reversed payments excluded)`,
    columns: [{ header: "Date", width: 62 }, { header: "Receipt", width: 120 }, { header: "Student" }, { header: "Method", width: 70 }, { header: "Amount", width: 80, align: "right" }],
    rows: done.map((p) => [p.payment_date, p.receipt_no, `${p.students?.full_name} (${p.students?.admission_no})`, p.method_code, rs(p.amount)]),
  }), `collection_${from}_${to}.pdf`);
}
