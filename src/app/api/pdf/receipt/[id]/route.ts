import { createElement } from "react";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/auth/api";
import { rateLimit } from "@/lib/rate-limit";
import { ReceiptDocument } from "@/lib/pdf/receipt";
import { loadInstitution, pdfResponse } from "@/lib/pdf/render";

export async function GET(_req: Request, ctx: RouteContext<"/api/pdf/receipt/[id]">) {
  const session = await getSession();
  if (!session) return new Response("Unauthorised", { status: 401 });
  if (!rateLimit(`pdf:${session.userId}`, 30)) return new Response("Too many requests", { status: 429 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  // RLS: fees.view or the student's own payment
  const { data: p } = await supabase.from("payments")
    .select("*, payment_methods(name), students(full_name, admission_no), student_fee_assignments(id, items, fee_structures(name, programmes(code), programme_terms(name))), receipts(print_count)")
    .eq("id", id).maybeSingle();
  if (!p) return new Response("Not found", { status: 404 });
  const [{ data: bal }, { data: receiver }] = await Promise.all([
    supabase.from("student_fee_balances").select("balance").eq("assignment_id", p.student_fee_assignment_id).maybeSingle(),
    p.received_by ? supabase.from("profiles").select("full_name").eq("id", p.received_by).maybeSingle() : { data: null },
  ]);
  await supabase.rpc("mark_receipt_printed", { p_payment_id: id });
  const inst = await loadInstitution(supabase);
  const a = p.student_fee_assignments;
  const items = ((a?.items ?? []) as { name: string; amount: number }[]).map((i) => ({ name: i.name, amount: Number(i.amount) }));
  const receipt = Array.isArray(p.receipts) ? p.receipts[0] : p.receipts;
  return pdfResponse(createElement(ReceiptDocument, {
    inst,
    d: {
      payment: { receipt_no: p.receipt_no, amount: Number(p.amount), payment_date: p.payment_date, method: p.payment_methods?.name ?? p.method_code, reference_no: p.reference_no, remarks: p.remarks, status: p.status, created_at: p.created_at },
      student: { full_name: p.students?.full_name ?? "", admission_no: p.students?.admission_no ?? "" },
      className: `${a?.fee_structures?.programmes?.code ?? ""} ${a?.fee_structures?.programme_terms?.name ?? ""}`.trim(),
      feeName: a?.fee_structures?.name ?? "",
      items,
      balanceAfter: bal ? Number(bal.balance) : null,
      receivedBy: receiver?.full_name ?? null,
      copy: (receipt?.print_count ?? 0) + 1,
    },
  }), `receipt_${p.receipt_no}.pdf`);
}
