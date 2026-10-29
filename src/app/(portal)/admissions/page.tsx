import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, param, programmeCode, termName, uuidParam } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/shared/filter-bar";
import { Pagination, pageRange, parsePage } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { RecordDialog, type FieldConfig } from "@/components/shared/record-dialog";
import { asRecordAction } from "@/lib/record-action";
import { saveAdmissionPeriod } from "@/server/admission-actions";
import { formatDate, formatINR, searchFilter, todayIST } from "@/lib/utils";

export const metadata: Metadata = { title: "Admissions" };
const STATUSES = ["submitted", "under_review", "approved", "waitlisted", "rejected", "admitted", "withdrawn"];

export default async function AdmissionsPage({ searchParams }: PageProps<"/admissions">) {
  const session = await requirePermission("admissions.view");
  const sp = await searchParams;
  const ref = await getReferenceData();
  const supabase = await createClient();
  const page = parsePage(sp.page);
  const [from, to] = pageRange(page);
  const periodId = uuidParam(sp.period);
  const status = STATUSES.includes(param(sp.status) ?? "") ? param(sp.status) : undefined;

  let q = supabase.from("admissions").select("id, application_no, applicant_name, phone, status, previous_percentage, created_at, admission_period_id, admission_periods(title, programme_id, term_id)", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (periodId) q = q.eq("admission_period_id", periodId);
  if (status) q = q.eq("status", status as "submitted");
  const search = searchFilter(["applicant_name", "application_no", "phone"], param(sp.q));
  if (search) q = q.or(search);
  const [{ data: apps, count }, { data: periods }] = await Promise.all([q, supabase.from("admission_periods").select("*, admissions(count)").order("opens_on", { ascending: false })]);
  const today = todayIST();

  const periodFields: FieldConfig[] = [
    { name: "title", label: "Title", required: true, full: true },
    { name: "academic_session_id", label: "Academic session", type: "select", required: true, options: ref.sessions.map((s) => ({ value: s.id, label: s.name })) },
    { name: "programme_id", label: "Programme", type: "select", required: true, options: ref.programmes.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })) },
    ...ref.programmes.map<FieldConfig>((p) => ({ name: "term_id", label: "Class / semester", type: "select", required: true, options: ref.terms.filter((t) => t.programme_id === p.id).map((t) => ({ value: t.id, label: t.name })), showIf: { field: "programme_id", values: [p.id] } })),
    { name: "opens_on", label: "Opens on", type: "date", required: true },
    { name: "closes_on", label: "Closes on", type: "date", required: true },
    { name: "admission_fee", label: "Admission fee (₹)", type: "number", required: true },
    { name: "seats", label: "Seats", type: "number" },
    { name: "min_qualifying_percent", label: "Minimum qualifying %", type: "number", hint: "Checked on approval; leave blank if not applicable" },
    { name: "eligibility_rules", label: "Eligibility rules", type: "textarea", full: true },
    { name: "required_documents", label: "Required documents (one per line)", type: "textarea", full: true },
    { name: "is_active", label: "Accepting applications", type: "checkbox", full: true },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Admissions" description="Applications, document verification, approval and conversion to student records"
        actions={can(session, "admissions.manage") && <Button size="sm" asChild><Link href="/admissions/new"><Plus /> New application</Link></Button>} />
      <Tabs defaultValue="applications">
        <TabsList><TabsTrigger value="applications">Applications</TabsTrigger><TabsTrigger value="periods">Admission periods</TabsTrigger></TabsList>
        <TabsContent value="applications" className="space-y-4">
          <FilterBar searchPlaceholder="Name, application no, phone…" filters={[
            { name: "period", label: "Periods", options: (periods ?? []).map((p) => ({ value: p.id, label: p.title })) },
            { name: "status", label: "Statuses", options: STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") })) },
          ]} />
          <Card>
            {!apps?.length ? <div className="p-6"><EmptyState title="No applications" /></div> : (
              <Table>
                <TableHeader><TableRow><TableHead>Application no.</TableHead><TableHead>Applicant</TableHead><TableHead>Programme</TableHead><TableHead>Phone</TableHead><TableHead className="text-right">Prev. %</TableHead><TableHead>Received</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {apps.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.application_no}</TableCell>
                      <TableCell><Link href={`/admissions/${a.id}`} className="font-medium text-primary hover:underline">{a.applicant_name}</Link></TableCell>
                      <TableCell>{programmeCode(ref, a.admission_periods?.programme_id)} · {termName(ref, a.admission_periods?.term_id)}</TableCell>
                      <TableCell>{a.phone}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.previous_percentage ?? "—"}</TableCell>
                      <TableCell>{formatDate(a.created_at)}</TableCell>
                      <TableCell><StatusBadge status={a.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
          <Pagination page={page} total={count ?? 0} basePath="/admissions" params={sp} />
        </TabsContent>
        <TabsContent value="periods" className="space-y-4">
          {can(session, "admissions.manage") && <div className="flex justify-end"><RecordDialog title="New admission period" wide fields={periodFields} action={asRecordAction(saveAdmissionPeriod)} initial={{ admission_fee: "0", is_active: true, required_documents: "Class X marksheet\nClass XII marksheet\nTransfer certificate\nPassport photograph" }} /></div>}
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Class</TableHead><TableHead>Window</TableHead><TableHead className="text-right">Fee</TableHead><TableHead className="text-right">Seats</TableHead><TableHead className="text-right">Applications</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {(periods ?? []).map((p) => {
                  const open = p.is_active && today >= p.opens_on && today <= p.closes_on;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.title}</TableCell>
                      <TableCell>{programmeCode(ref, p.programme_id)} · {termName(ref, p.term_id)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(p.opens_on)} – {formatDate(p.closes_on)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(p.admission_fee)}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.seats ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{(p.admissions as unknown as { count: number }[])[0]?.count ?? 0}</TableCell>
                      <TableCell>{open ? <Badge variant="success">Open</Badge> : <Badge variant="muted">Closed</Badge>}</TableCell>
                      <TableCell className="text-right">{can(session, "admissions.manage") && <RecordDialog mode="edit" title="Edit admission period" wide fields={periodFields} action={asRecordAction(saveAdmissionPeriod)}
                        initial={{ id: p.id, title: p.title, academic_session_id: p.academic_session_id, programme_id: p.programme_id, term_id: p.term_id, opens_on: p.opens_on, closes_on: p.closes_on, admission_fee: String(p.admission_fee), seats: p.seats?.toString() ?? "", min_qualifying_percent: p.min_qualifying_percent?.toString() ?? "", eligibility_rules: p.eligibility_rules ?? "", required_documents: p.required_documents.join("\n"), is_active: p.is_active }} />}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
