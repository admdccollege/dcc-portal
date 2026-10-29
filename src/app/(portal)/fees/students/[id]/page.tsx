import Link from "next/link";
import { notFound } from "next/navigation";
import { Undo2 } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, programmeCode, termName, UUID_RE } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, StatCard } from "@/components/ui/misc";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { RecordDialog } from "@/components/shared/record-dialog";
import { PaymentDialog } from "@/components/fees/payment-dialog";
import { AdjustmentDialog, ConcessionDecision } from "@/components/fees/ledger-actions";
import { asRecordAction } from "@/lib/record-action";
import { assignFeeToStudent, cancelAssignment, reversePayment } from "@/server/fee-actions";
import { formatDate, formatINR, titleCase } from "@/lib/utils";

export const metadata = { title: "Student fee ledger" };

export default async function LedgerPage({ params }: PageProps<"/fees/students/[id]">) {
  const session = await requirePermission("fees.view");
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createClient();
  const ref = await getReferenceData();
  const { data: student } = await supabase.from("students").select("id, full_name, admission_no, status").eq("id", id).maybeSingle();
  if (!student) notFound();

  const [balances, assignments, payments, adjustments, concessions, methods, structures] = await Promise.all([
    supabase.from("student_fee_balances").select("*").eq("student_id", id).order("created_at"),
    supabase.from("student_fee_assignments").select("id, items, cancelled_reason").eq("student_id", id),
    supabase.from("payments").select("*, payment_methods(name)").eq("student_id", id).order("payment_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("payment_adjustments").select("*").in("student_fee_assignment_id", (await supabase.from("student_fee_assignments").select("id").eq("student_id", id)).data?.map((a) => a.id) ?? []).order("created_at", { ascending: false }),
    supabase.from("fee_concessions").select("*, student_fee_assignments!inner(student_id)").eq("student_fee_assignments.student_id", id).order("requested_at", { ascending: false }),
    supabase.from("payment_methods").select("code, name, requires_reference").eq("is_active", true),
    supabase.from("fee_structures").select("id, name, programme_id, term_id").eq("academic_session_id", ref.currentSession?.id ?? "").eq("is_active", true),
  ]);
  const itemsById = new Map((assignments.data ?? []).map((a) => [a.id, a]));
  const b = balances.data ?? [];
  const totalBal = b.filter((x) => !x.is_cancelled).reduce((a, x) => a + Number(x.balance), 0);
  const totalPaid = b.reduce((a, x) => a + Number(x.paid), 0);
  const adjKinds = [
    ...(can(session, "fees.manage") ? [{ value: "charge" as const, label: "Additional charge" }, { value: "fine" as const, label: "Fine" }, { value: "scholarship" as const, label: "Scholarship (needs approval)" }, { value: "concession" as const, label: "Concession (needs approval)" }, { value: "waiver" as const, label: "Waiver (needs approval)" }] : []),
    ...(can(session, "payments.reverse") ? [{ value: "refund" as const, label: "Refund" }] : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Fee ledger — ${student.full_name}`}
        description={<span className="flex items-center gap-2"><span className="font-mono">{student.admission_no}</span><StatusBadge status={student.status} /></span>}
        breadcrumbs={[{ label: "Fees", href: "/fees" }, { label: student.full_name }]}
        actions={
          <>
            <Link href={`/students/${id}`} className="text-sm text-primary hover:underline">Student profile</Link>
            {can(session, "fees.manage") && (
              <RecordDialog title="Assign a fee" triggerLabel="Assign fee" triggerVariant="outline" action={asRecordAction(assignFeeToStudent)} initial={{ student_id: id }}
                fields={[{ name: "fee_structure_id", label: "Fee structure (current session)", type: "select", required: true, options: (structures.data ?? []).map((s) => ({ value: s.id, label: `${s.name} — ${programmeCode(ref, s.programme_id)} ${s.term_id ? termName(ref, s.term_id) : ""}` })) }]} success="Fee assigned" />
            )}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total paid" value={formatINR(totalPaid)} tone="success" />
        <StatCard label="Outstanding" value={formatINR(totalBal)} tone={totalBal > 0 ? "warning" : "success"} />
        <StatCard label="Receipts" value={(payments.data ?? []).filter((p) => p.status === "completed").length} />
      </div>

      {b.length === 0 ? <EmptyState title="No fees assigned" /> : b.map((x) => {
        const a = itemsById.get(x.assignment_id!);
        const items = (a?.items ?? []) as { name: string; amount: number }[];
        const bal = Number(x.balance);
        return (
          <Card key={x.assignment_id}>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">{x.fee_structure_name} {x.is_cancelled && <StatusBadge status="cancelled" />}{x.is_overdue && <StatusBadge status="overdue" />}</CardTitle>
                <CardDescription>{programmeCode(ref, x.programme_id)} {x.term_id ? termName(ref, x.term_id) : ""} · Due {formatDate(x.due_date)}{a?.cancelled_reason ? ` · Cancelled: ${a.cancelled_reason}` : ""}</CardDescription>
              </div>
              {!x.is_cancelled && (
                <div className="flex flex-wrap gap-1">
                  {can(session, "payments.record") && <PaymentDialog assignmentId={x.assignment_id!} studentId={id} studentName={student.full_name} feeName={x.fee_structure_name ?? ""} balance={bal} methods={methods.data ?? []} />}
                  <AdjustmentDialog assignmentId={x.assignment_id!} studentId={id} kinds={adjKinds} />
                  {can(session, "fees.manage") && Number(x.paid) === 0 && (
                    <ConfirmAction size="sm" variant="ghost" label="Cancel" requireReason title="Cancel this fee assignment?" description="The assignment is kept for the record but no longer counts as due." action={cancelAssignment} payload={{ assignment_id: x.assignment_id!, student_id: id }} success="Assignment cancelled" />
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <ul className="divide-y text-sm">
                {items.map((i) => <li key={i.name} className="flex justify-between py-1"><span>{i.name}</span><span className="tabular-nums">{formatINR(i.amount)}</span></li>)}
              </ul>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Gross</dt><dd className="text-right tabular-nums">{formatINR(x.gross_amount)}</dd>
                <dt className="text-muted-foreground">+ Charges / fines</dt><dd className="text-right tabular-nums">{formatINR(x.charges)}</dd>
                <dt className="text-muted-foreground">− Concessions</dt><dd className="text-right tabular-nums">{formatINR(x.concessions)}</dd>
                <dt className="text-muted-foreground">− Paid</dt><dd className="text-right tabular-nums">{formatINR(x.paid)}</dd>
                <dt className="text-muted-foreground">+ Refunded</dt><dd className="text-right tabular-nums">{formatINR(x.refunded)}</dd>
                <dt className="font-semibold">Balance</dt><dd className="text-right font-semibold tabular-nums">{formatINR(bal)}</dd>
              </dl>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader><CardTitle>Payment history</CardTitle><CardDescription>Completed payments are never edited. Mistakes are corrected with a reversal that stays on record.</CardDescription></CardHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Receipt</TableHead><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {(payments.data ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell><a className="font-mono text-xs text-primary hover:underline" href={`/api/pdf/receipt/${p.id}`} target="_blank" rel="noopener">{p.receipt_no}</a></TableCell>
                <TableCell>{formatDate(p.payment_date)}</TableCell>
                <TableCell>{p.payment_methods?.name ?? p.method_code}</TableCell>
                <TableCell className="text-xs">{p.reference_no ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(p.amount)}</TableCell>
                <TableCell><StatusBadge status={p.status} /></TableCell>
                <TableCell className="text-right">
                  {p.status === "completed" && can(session, "payments.reverse") && (
                    <ConfirmAction size="sm" icon={<Undo2 />} label="Reverse" requireReason title={`Reverse receipt ${p.receipt_no}?`}
                      description={`${formatINR(p.amount)} will be added back to the balance. The original receipt remains on record marked as reversed.`}
                      action={reversePayment} payload={{ payment_id: p.id, student_id: id }} success="Payment reversed" variant="destructive" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {((adjustments.data ?? []).length > 0 || (concessions.data ?? []).length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Adjustments</CardTitle></CardHeader>
            <Table>
              <TableBody>
                {(adjustments.data ?? []).map((x) => (
                  <TableRow key={x.id}><TableCell>{formatDate(x.created_at)}</TableCell><TableCell>{titleCase(x.kind)}</TableCell><TableCell className="text-right tabular-nums">{formatINR(x.amount)}</TableCell><TableCell className="text-muted-foreground">{x.reason}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Card>
            <CardHeader><CardTitle>Concessions</CardTitle></CardHeader>
            <Table>
              <TableBody>
                {(concessions.data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{titleCase(c.kind)}</TableCell><TableCell className="text-right tabular-nums">{formatINR(c.amount)}</TableCell><TableCell className="text-muted-foreground">{c.reason}</TableCell>
                    <TableCell>{c.status === "pending" && can(session, "concessions.approve") && c.requested_by !== session.userId ? <ConcessionDecision id={c.id} /> : <StatusBadge status={c.status} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
