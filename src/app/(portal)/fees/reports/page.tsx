import type { Metadata } from "next";
import { Download, FileText } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, param } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { UrlControls } from "@/components/shared/url-controls";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, StatCard } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { SimpleBarChart } from "@/components/charts";
import { formatDate, formatINR, titleCase, todayIST } from "@/lib/utils";

export const metadata: Metadata = { title: "Fee collection reports" };

export default async function FeeReportsPage({ searchParams }: PageProps<"/fees/reports">) {
  const session = await requirePermission("fees.view");
  const sp = await searchParams;
  const supabase = await createClient();
  const ref = await getReferenceData();
  const today = todayIST();
  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const from = isDate(param(sp.from)) ? param(sp.from)! : today.slice(0, 8) + "01";
  const to = isDate(param(sp.to)) ? param(sp.to)! : today;

  const { data: payments } = await supabase.from("payments")
    .select("id, receipt_no, amount, payment_date, method_code, status, reference_no, students(full_name, admission_no)")
    .gte("payment_date", from).lte("payment_date", to).order("payment_date").order("receipt_no").limit(5000);
  const completed = (payments ?? []).filter((p) => p.status === "completed");
  const total = completed.reduce((a, p) => a + Number(p.amount), 0);
  const byMethod = new Map<string, number>();
  const byDay = new Map<string, number>();
  for (const p of completed) {
    byMethod.set(p.method_code, (byMethod.get(p.method_code) ?? 0) + Number(p.amount));
    byDay.set(p.payment_date, (byDay.get(p.payment_date) ?? 0) + Number(p.amount));
  }
  const qs = `from=${from}&to=${to}`;

  return (
    <div className="space-y-5">
      <PageHeader title="Fee collection reports" description="Daily collection by date range and payment method. Reversed payments are listed but excluded from totals."
        breadcrumbs={[{ label: "Fees", href: "/fees" }, { label: "Reports" }]}
        actions={can(session, "fees.export") && (
          <>
            <Button size="sm" variant="outline" asChild><a href={`/api/export/payments?format=xlsx&${qs}`}><Download /> Collection (Excel)</a></Button>
            <Button size="sm" variant="outline" asChild><a href={`/api/pdf/collection?${qs}`} target="_blank" rel="noopener"><FileText /> Collection (PDF)</a></Button>
            <Button size="sm" variant="outline" asChild><a href={`/api/export/dues?format=xlsx&session=${ref.currentSession?.id ?? ""}`}><Download /> Outstanding dues (Excel)</a></Button>
          </>
        )} />
      <UrlControls controls={[{ name: "from", label: "From", type: "date", defaultValue: from, width: "w-44" }, { name: "to", label: "To", type: "date", defaultValue: to, width: "w-44" }]} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Collected" value={formatINR(total)} tone="success" hint={`${formatDate(from)} – ${formatDate(to)}`} />
        <StatCard label="Receipts" value={completed.length} />
        <StatCard label="Reversed" value={(payments ?? []).length - completed.length} tone={(payments ?? []).length - completed.length ? "warning" : "default"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Daily collection</CardTitle></CardHeader>
          <CardContent>{byDay.size ? <SimpleBarChart data={[...byDay.entries()].map(([d, v]) => ({ label: d.slice(5), value: v, hint: formatDate(d) }))} format="inr_k" ariaLabel="Daily fee collection" /> : <EmptyState title="No collections in this period" />}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>By payment method</CardTitle><CardDescription>Completed payments</CardDescription></CardHeader>
          <Table>
            <TableBody>{[...byMethod.entries()].map(([m, v]) => <TableRow key={m}><TableCell>{titleCase(m)}</TableCell><TableCell className="text-right tabular-nums">{formatINR(v)}</TableCell></TableRow>)}</TableBody>
            <TableFooter><TableRow><TableCell>Total</TableCell><TableCell className="text-right tabular-nums">{formatINR(total)}</TableCell></TableRow></TableFooter>
          </Table>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Receipts register</CardTitle></CardHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Receipt</TableHead><TableHead>Student</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>
            {(payments ?? []).map((p) => (
              <TableRow key={p.id} className={p.status === "reversed" ? "text-muted-foreground line-through" : ""}>
                <TableCell>{formatDate(p.payment_date)}</TableCell><TableCell className="font-mono text-xs">{p.receipt_no}</TableCell>
                <TableCell>{p.students?.full_name}</TableCell><TableCell>{titleCase(p.method_code)}</TableCell><TableCell className="text-xs">{p.reference_no ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(p.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
