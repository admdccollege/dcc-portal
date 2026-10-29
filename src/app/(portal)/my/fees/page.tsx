import { requireStudent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, StatCard } from "@/components/ui/misc";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatINR, titleCase } from "@/lib/utils";

export const metadata = { title: "My fees" };

export default async function MyFees() {
  const session = await requireStudent();
  const supabase = await createClient();
  const [{ data: balances }, { data: payments }] = await Promise.all([
    supabase.from("student_fee_balances").select("*").eq("student_id", session.studentId).eq("is_cancelled", false).order("created_at"),
    supabase.from("payments").select("id, receipt_no, amount, payment_date, method_code, status").eq("student_id", session.studentId).order("payment_date", { ascending: false }),
  ]);
  const due = (balances ?? []).reduce((a, b) => a + Math.max(0, Number(b.balance)), 0);
  const paid = (balances ?? []).reduce((a, b) => a + Number(b.paid), 0);
  return (
    <div className="space-y-5">
      <PageHeader title="My fees" description="Fee dues, concessions and payment receipts. Payments are made at the college accounts office." />
      <div className="grid gap-4 sm:grid-cols-2"><StatCard label="Total paid" value={formatINR(paid)} tone="success" /><StatCard label="Outstanding" value={formatINR(due)} tone={due > 0 ? "warning" : "success"} /></div>
      <Card>
        <CardHeader><CardTitle>Fees</CardTitle></CardHeader>
        {!balances?.length ? <EmptyState title="No fees assigned" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Fee</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Concession</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Due</TableHead></TableRow></TableHeader>
            <TableBody>
              {balances.map((b) => (
                <TableRow key={b.assignment_id}>
                  <TableCell>{b.fee_structure_name}</TableCell><TableCell className="text-right tabular-nums">{formatINR(Number(b.gross_amount) + Number(b.charges))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(b.concessions)}</TableCell><TableCell className="text-right tabular-nums">{formatINR(b.paid)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatINR(b.balance)}</TableCell>
                  <TableCell>{Number(b.balance) <= 0 ? <StatusBadge status="paid" /> : b.is_overdue ? <StatusBadge status="overdue" /> : formatDate(b.due_date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Card>
        <CardHeader><CardTitle>Receipts</CardTitle></CardHeader>
        {!payments?.length ? <EmptyState title="No payments yet" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Receipt</TableHead><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><a href={`/api/pdf/receipt/${p.id}`} target="_blank" rel="noopener" className="font-mono text-xs text-primary hover:underline">{p.receipt_no}</a></TableCell>
                  <TableCell>{formatDate(p.payment_date)}</TableCell><TableCell>{titleCase(p.method_code)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(p.amount)}</TableCell><TableCell><StatusBadge status={p.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
