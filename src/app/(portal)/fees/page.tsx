import Link from "next/link";
import type { Metadata } from "next";
import { BarChart3, Users } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, param, programmeCode, termName, uuidParam } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, StatCard } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/shared/filter-bar";
import { Pagination, pageRange, parsePage } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { RecordDialog } from "@/components/shared/record-dialog";
import { PaymentDialog } from "@/components/fees/payment-dialog";
import { FeeStructureForm } from "@/components/fees/structure-form";
import { ConcessionDecision } from "@/components/fees/ledger-actions";
import { asRecordAction } from "@/lib/record-action";
import { assignFeeToClass, saveFeeHead, savePaymentMethod } from "@/server/fee-actions";
import { formatDate, formatINR, searchFilter, titleCase } from "@/lib/utils";

export const metadata: Metadata = { title: "Fees & payments" };

export default async function FeesPage({ searchParams }: PageProps<"/fees">) {
  const session = await requirePermission("fees.view");
  const sp = await searchParams;
  const ref = await getReferenceData();
  const supabase = await createClient();
  const sessionId = uuidParam(sp.session) ?? ref.currentSession?.id;
  const programmeId = uuidParam(sp.programme);
  const termId = uuidParam(sp.term);
  const dueStatus = param(sp.due);
  const page = parsePage(sp.page);
  const [from, to] = pageRange(page);

  // Dues: join balances with students for search/display
  let dq = supabase.from("student_fee_balances").select("*", { count: "exact" }).eq("is_cancelled", false).order("balance", { ascending: false }).range(from, to);
  if (sessionId) dq = dq.eq("academic_session_id", sessionId);
  if (programmeId) dq = dq.eq("programme_id", programmeId);
  if (termId) dq = dq.eq("term_id", termId);
  if (dueStatus === "outstanding") dq = dq.gt("balance", 0);
  if (dueStatus === "overdue") dq = dq.eq("is_overdue", true);
  if (dueStatus === "paid") dq = dq.lte("balance", 0);
  const search = searchFilter(["full_name", "admission_no"], param(sp.q));
  if (search) {
    const { data: matches } = await supabase.from("students").select("id").or(search).limit(200);
    dq = dq.in("student_id", (matches ?? []).map((m) => m.id).concat("00000000-0000-0000-0000-000000000000"));
  }

  const [dues, totals, structures, payments, concessions, heads, methods] = await Promise.all([
    dq,
    sessionId ? supabase.from("student_fee_balances").select("gross_amount, concessions, paid, balance, is_overdue").eq("academic_session_id", sessionId).eq("is_cancelled", false) : { data: [] },
    supabase.from("fee_structures").select("*, fee_structure_items(amount, fee_head_id, fee_heads(name, is_optional)), student_fee_assignments(count)").eq("academic_session_id", sessionId ?? "").order("name"),
    supabase.from("payments").select("id, receipt_no, amount, payment_date, method_code, status, student_id, students(full_name, admission_no)").order("created_at", { ascending: false }).limit(25),
    supabase.from("fee_concessions").select("*, student_fee_assignments(student_id, students(full_name, admission_no), fee_structures(name))").eq("status", "pending").order("requested_at"),
    supabase.from("fee_heads").select("*").order("code"),
    supabase.from("payment_methods").select("*").order("name"),
  ]);
  const studentIds = [...new Set((dues.data ?? []).map((d) => d.student_id!))];
  const { data: studs } = studentIds.length ? await supabase.from("students").select("id, full_name, admission_no").in("id", studentIds) : { data: [] };
  const sById = new Map((studs ?? []).map((s) => [s.id, s]));
  const t = totals.data ?? [];
  const sum = (k: "gross_amount" | "concessions" | "paid" | "balance") => t.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const activeMethods = (methods.data ?? []).filter((m) => m.is_active);
  const recordable = can(session, "payments.record");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fees & Payments"
        description="Fee structures, dues, payments, concessions and receipts"
        actions={<Button variant="outline" size="sm" asChild><Link href="/fees/reports"><BarChart3 /> Collection reports</Link></Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Assessed (session)" value={formatINR(sum("gross_amount"))} />
        <StatCard label="Collected" value={formatINR(sum("paid"))} tone="success" />
        <StatCard label="Concessions" value={formatINR(sum("concessions"))} />
        <StatCard label="Outstanding" value={formatINR(Math.max(0, sum("balance")))} tone="warning" hint={`${t.filter((r) => r.is_overdue).length} overdue`} />
      </div>

      <Tabs defaultValue="dues">
        <TabsList>
          <TabsTrigger value="dues">Student dues</TabsTrigger>
          <TabsTrigger value="structures">Fee structures</TabsTrigger>
          <TabsTrigger value="payments">Recent payments</TabsTrigger>
          <TabsTrigger value="concessions">Concessions {concessions.data?.length ? <Badge variant="warning" className="ml-1">{concessions.data.length}</Badge> : null}</TabsTrigger>
          {can(session, "fees.manage") && <TabsTrigger value="setup">Fee heads & methods</TabsTrigger>}
        </TabsList>

        <TabsContent value="dues" className="space-y-4">
          <FilterBar searchPlaceholder="Student name or admission no…" filters={[
            { name: "session", label: "Session", options: ref.sessions.map((s) => ({ value: s.id, label: s.name })), allLabel: "Current session" },
            { name: "programme", label: "Programmes", options: ref.programmes.map((p) => ({ value: p.id, label: p.code })) },
            { name: "term", label: "Classes", options: ref.terms.filter((x) => !programmeId || x.programme_id === programmeId).map((x) => ({ value: x.id, label: `${programmeCode(ref, x.programme_id)} · ${x.name}` })) },
            { name: "due", label: "Dues", options: [{ value: "outstanding", label: "Outstanding" }, { value: "overdue", label: "Overdue" }, { value: "paid", label: "Fully paid" }] },
          ]} />
          <Card>
            {!dues.data?.length ? <div className="p-6"><EmptyState title="No fee assignments found" /></div> : (
              <Table>
                <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Fee</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Concession</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Due</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {dues.data.map((d) => {
                    const st = sById.get(d.student_id!);
                    const bal = Number(d.balance);
                    return (
                      <TableRow key={d.assignment_id}>
                        <TableCell><Link href={`/fees/students/${d.student_id}`} className="font-medium text-primary hover:underline">{st?.full_name ?? "—"}</Link> <span className="font-mono text-xs text-muted-foreground">{st?.admission_no}</span></TableCell>
                        <TableCell>{d.fee_structure_name} <span className="text-xs text-muted-foreground">{programmeCode(ref, d.programme_id)} {d.term_id ? termName(ref, d.term_id) : ""}</span></TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(d.gross_amount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(d.concessions)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(d.paid)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatINR(bal)}</TableCell>
                        <TableCell>{bal <= 0 ? <StatusBadge status="paid" /> : d.is_overdue ? <StatusBadge status="overdue" /> : formatDate(d.due_date)}</TableCell>
                        <TableCell className="text-right">{recordable && bal > 0 && <PaymentDialog assignmentId={d.assignment_id!} studentId={d.student_id!} studentName={st?.full_name ?? ""} feeName={d.fee_structure_name ?? ""} balance={bal} methods={activeMethods} />}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
          <Pagination page={page} total={dues.count ?? 0} basePath="/fees" params={sp} />
        </TabsContent>

        <TabsContent value="structures" className="space-y-4">
          {can(session, "fees.manage") && sessionId && (
            <div className="flex justify-end">
              <FeeStructureForm sessions={ref.sessions} programmes={ref.programmes.map((p) => ({ id: p.id, name: `${p.code} — ${p.name}` }))} terms={ref.terms}
                heads={(heads.data ?? []).filter((h) => h.is_active)} initial={{ academic_session_id: sessionId, programme_id: "", term_id: "", name: "", due_date: "", late_fine_per_day: "0", items: [{ fee_head_id: "", amount: "" }] }} />
            </div>
          )}
          {!structures.data?.length ? <EmptyState title="No fee structures for this session" /> : (
            <div className="grid gap-4 lg:grid-cols-2">
              {structures.data.map((f) => {
                const total = f.fee_structure_items.filter((i) => !i.fee_heads?.is_optional).reduce((a, i) => a + Number(i.amount), 0);
                return (
                  <Card key={f.id}>
                    <CardHeader className="flex-row items-start justify-between gap-2">
                      <div>
                        <CardTitle>{f.name}</CardTitle>
                        <CardDescription>{programmeCode(ref, f.programme_id)} · {f.term_id ? termName(ref, f.term_id) : "All terms"} · Due {formatDate(f.due_date)} · {(f.student_fee_assignments as unknown as { count: number }[])[0]?.count ?? 0} assigned</CardDescription>
                      </div>
                      {can(session, "fees.manage") && (
                        <div className="flex gap-1">
                          <FeeStructureForm triggerLabel="Edit" sessions={ref.sessions} programmes={ref.programmes.map((p) => ({ id: p.id, name: `${p.code} — ${p.name}` }))} terms={ref.terms} heads={heads.data ?? []}
                            initial={{ id: f.id, academic_session_id: f.academic_session_id, programme_id: f.programme_id, term_id: f.term_id ?? "", name: f.name, due_date: f.due_date ?? "", late_fine_per_day: String(f.late_fine_per_day), items: f.fee_structure_items.map((i) => ({ fee_head_id: i.fee_head_id, amount: String(i.amount) })) }} />
                          <ConfirmAction size="sm" label={<><Users className="size-4" /> Assign to class</>} title={`Assign “${f.name}” to all active students?`}
                            description="Students who already have this fee are skipped. Amounts are copied at assignment time." action={assignFeeToClass.bind(null, { fee_structure_id: f.id, optional_head_ids: [] })} success="Fees assigned" />
                        </div>
                      )}
                    </CardHeader>
                    <CardContent>
                      <ul className="divide-y text-sm">
                        {f.fee_structure_items.map((i) => (
                          <li key={i.fee_head_id} className="flex justify-between py-1.5"><span>{i.fee_heads?.name}{i.fee_heads?.is_optional && <span className="text-xs text-muted-foreground"> (optional)</span>}</span><span className="tabular-nums">{formatINR(i.amount)}</span></li>
                        ))}
                        <li className="flex justify-between py-1.5 font-semibold"><span>Total (compulsory)</span><span className="tabular-nums">{formatINR(total)}</span></li>
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Receipt</TableHead><TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {(payments.data ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><a className="font-mono text-xs text-primary hover:underline" href={`/api/pdf/receipt/${p.id}`} target="_blank" rel="noopener">{p.receipt_no}</a></TableCell>
                    <TableCell>{formatDate(p.payment_date)}</TableCell>
                    <TableCell><Link className="hover:underline" href={`/fees/students/${p.student_id}`}>{p.students?.full_name}</Link></TableCell>
                    <TableCell>{titleCase(p.method_code)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(p.amount)}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="concessions">
          <Card>
            {!concessions.data?.length ? <div className="p-6"><EmptyState title="No pending concessions" /></div> : (
              <Table>
                <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Fee</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Reason</TableHead><TableHead>Requested</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {concessions.data.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.student_fee_assignments?.students?.full_name}</TableCell>
                      <TableCell>{c.student_fee_assignments?.fee_structures?.name}</TableCell>
                      <TableCell>{titleCase(c.kind)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(c.amount)}</TableCell>
                      <TableCell className="max-w-xs text-muted-foreground">{c.reason}</TableCell>
                      <TableCell>{formatDate(c.requested_at)}</TableCell>
                      <TableCell>{can(session, "concessions.approve") ? (c.requested_by === session.userId ? <span className="text-xs text-muted-foreground">Awaiting another approver</span> : <ConcessionDecision id={c.id} />) : <StatusBadge status="pending" />}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {can(session, "fees.manage") && (
          <TabsContent value="setup" className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Fee heads</CardTitle>
                <RecordDialog title="New fee head" action={asRecordAction(saveFeeHead)} initial={{ category: "miscellaneous", is_active: true }} fields={[
                  { name: "code", label: "Code", required: true }, { name: "name", label: "Name", required: true },
                  { name: "category", label: "Category", type: "select", required: true, options: ["admission", "semester", "tuition", "laboratory", "hostel", "examination", "fine", "miscellaneous"].map((c) => ({ value: c, label: titleCase(c) })) },
                  { name: "is_optional", label: "Optional (e.g. hostel)", type: "checkbox" }, { name: "is_active", label: "Active", type: "checkbox" },
                ]} />
              </CardHeader>
              <Table>
                <TableBody>
                  {(heads.data ?? []).map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-mono text-xs">{h.code}</TableCell><TableCell>{h.name}</TableCell><TableCell>{titleCase(h.category)}</TableCell>
                      <TableCell>{h.is_optional && <Badge variant="secondary">Optional</Badge>} {!h.is_active && <Badge variant="muted">Inactive</Badge>}</TableCell>
                      <TableCell className="text-right"><RecordDialog mode="edit" title="Edit fee head" action={asRecordAction(saveFeeHead)} initial={{ id: h.id, code: h.code, name: h.name, category: h.category, is_optional: h.is_optional, is_active: h.is_active }} fields={[
                        { name: "code", label: "Code", required: true }, { name: "name", label: "Name", required: true },
                        { name: "category", label: "Category", type: "select", required: true, options: ["admission", "semester", "tuition", "laboratory", "hostel", "examination", "fine", "miscellaneous"].map((c) => ({ value: c, label: titleCase(c) })) },
                        { name: "is_optional", label: "Optional", type: "checkbox" }, { name: "is_active", label: "Active", type: "checkbox" },
                      ]} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Payment methods</CardTitle>
                <RecordDialog title="Payment method" triggerLabel="Add method" action={asRecordAction(savePaymentMethod)} initial={{ is_active: true }} fields={[
                  { name: "code", label: "Code", required: true, placeholder: "neft" }, { name: "name", label: "Name", required: true },
                  { name: "requires_reference", label: "Requires a reference number", type: "checkbox" }, { name: "is_active", label: "Active", type: "checkbox" },
                ]} />
              </CardHeader>
              <Table>
                <TableBody>
                  {(methods.data ?? []).map((m) => (
                    <TableRow key={m.code}>
                      <TableCell>{m.name}</TableCell><TableCell>{m.requires_reference ? "Reference required" : "—"}</TableCell><TableCell>{!m.is_active && <Badge variant="muted">Inactive</Badge>}</TableCell>
                      <TableCell className="text-right"><RecordDialog mode="edit" title="Edit payment method" action={asRecordAction(savePaymentMethod)} initial={{ code: m.code, name: m.name, requires_reference: m.requires_reference, is_active: m.is_active }} fields={[
                        { name: "name", label: "Name", required: true }, { name: "requires_reference", label: "Requires a reference number", type: "checkbox" }, { name: "is_active", label: "Active", type: "checkbox" },
                      ]} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <CardContent className="pt-3 text-xs text-muted-foreground">Online gateway payments are not enabled. Integrating a gateway (e.g. Razorpay) requires API keys and webhook verification — see docs/DEPLOYMENT.md.</CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
