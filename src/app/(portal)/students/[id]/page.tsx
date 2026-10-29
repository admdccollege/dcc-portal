import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Printer } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, programmeCode, termName, UUID_RE } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Alert } from "@/components/ui/misc";
import { StatusBadge } from "@/components/shared/status-badge";
import { ChangeStatusDialog, CreateAccountDialog, SubjectsEditor } from "@/components/students/student-actions-ui";
import { formatDate, formatINR, titleCase } from "@/lib/utils";

export const metadata = { title: "Student profile" };

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words">{value || "—"}</dd>
    </div>
  );
}

export default async function StudentPage({ params }: PageProps<"/students/[id]">) {
  const session = await requirePermission("students.view", "attendance.take");
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createClient();
  const ref = await getReferenceData();

  const { data: student } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
  if (!student) notFound(); // RLS hides students outside the caller's scope

  const [guardians, enrolments, history, results, balances, payments] = await Promise.all([
    supabase.from("student_guardians").select("*").eq("student_id", id).order("is_primary", { ascending: false }),
    supabase.from("student_enrolments").select("*, academic_sessions(name), student_subject_enrolments(course_offering_id, course_offerings(id, is_compulsory, subjects(code, name), course_categories(name)))").eq("student_id", id).order("start_date", { ascending: false }),
    can(session, "students.view") ? supabase.from("student_status_history").select("*").eq("student_id", id).order("created_at", { ascending: false }) : { data: [] },
    can(session, "results.view") ? supabase.from("results").select("id, status, percentage, grade, grade_point, examinations(name, status, academic_sessions(name))").eq("student_id", id).order("computed_at", { ascending: false }) : { data: [] },
    can(session, "fees.view") ? supabase.from("student_fee_balances").select("*").eq("student_id", id).order("created_at") : { data: [] },
    can(session, "fees.view") ? supabase.from("payments").select("id, receipt_no, amount, payment_date, method_code, status").eq("student_id", id).order("payment_date", { ascending: false }) : { data: [] },
  ]);

  const active = enrolments.data?.find((e) => e.status === "active");
  const attendance = active
    ? await supabase.rpc("attendance_summary", { p_academic_session_id: active.academic_session_id, p_student_id: id })
    : { data: [] };
  const att = attendance.data?.[0];

  let classOfferings: { id: string; label: string; is_compulsory: boolean }[] = [];
  if (active && can(session, "students.manage")) {
    const { data } = await supabase.from("course_offerings").select("id, is_compulsory, subjects(code, name)")
      .eq("academic_session_id", active.academic_session_id).eq("programme_id", active.programme_id).eq("term_id", active.term_id);
    classOfferings = (data ?? []).map((o) => ({ id: o.id, is_compulsory: o.is_compulsory, label: `${o.subjects?.code} — ${o.subjects?.name}` }));
  }
  const threshold = Number(ref.settings?.attendance_threshold ?? 75);
  const subjects = active?.student_subject_enrolments ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title={student.full_name}
        description={<span className="flex flex-wrap items-center gap-2"><span className="font-mono">{student.admission_no}</span><StatusBadge status={student.status} />{active && <span>· {programmeCode(ref, active.programme_id)} {termName(ref, active.term_id)} · Roll {active.roll_no ?? "—"}</span>}</span>}
        breadcrumbs={[{ label: "Students", href: "/students" }, { label: student.full_name }]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild><a href={`/api/pdf/student-profile/${id}`} target="_blank" rel="noopener"><Printer /> Print profile</a></Button>
            {can(session, "users.manage") && !student.profile_id && <CreateAccountDialog recordId={id} defaultEmail={student.email} />}
            {can(session, "students.manage") && <ChangeStatusDialog studentId={id} currentStatus={student.status} />}
            {can(session, "students.manage") && <Button size="sm" asChild><Link href={`/students/${id}/edit`}><Pencil /> Edit</Link></Button>}
          </>
        }
      />

      {att && att.percentage !== null && Number(att.percentage) < threshold && (
        <Alert variant="warning" title="Low attendance">Attendance this session is {att.percentage}% (required {threshold}%).</Alert>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="enrolment">Enrolment & history</TabsTrigger>
          {can(session, "results.view") && <TabsTrigger value="results">Results</TabsTrigger>}
          {can(session, "fees.view") && <TabsTrigger value="fees">Fees</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Personal details</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="Date of birth" value={formatDate(student.date_of_birth)} />
                <Detail label="Gender" value={titleCase(student.gender)} />
                <Detail label="Phone" value={student.phone} />
                <Detail label="Email" value={student.email} />
                <Detail label="Admission date" value={formatDate(student.admission_date)} />
                <Detail label="University / council roll no." value={student.university_roll_no} />
                <Detail label="Registration no." value={student.registration_no} />
                <Detail label="Scholarship / concession" value={student.scholarship_note} />
                <Detail label="Login account" value={student.profile_id ? "Active" : "Not created"} />
                <div className="sm:col-span-2 lg:col-span-3"><Detail label="Address" value={student.address} /></div>
              </dl>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Attendance (this session)</CardTitle></CardHeader>
              <CardContent>
                {att ? (
                  <div>
                    <p className="text-3xl font-semibold tabular-nums">{att.percentage === null ? "—" : `${att.percentage}%`}</p>
                    <p className="text-sm text-muted-foreground">{att.attended} attended of {att.eligible} eligible sessions{Number(att.excluded) > 0 ? ` · ${att.excluded} excused` : ""}</p>
                  </div>
                ) : <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Guardian</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(guardians.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No guardian recorded.</p>}
                {(guardians.data ?? []).map((g) => (
                  <dl key={g.id} className="grid grid-cols-2 gap-3">
                    <Detail label="Name" value={g.name} />
                    <Detail label="Relationship" value={g.relationship} />
                    <Detail label="Phone" value={g.phone} />
                    <Detail label="Email" value={g.email} />
                  </dl>
                ))}
              </CardContent>
            </Card>
          </div>
          <Card className="lg:col-span-3">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Current subjects</CardTitle>
              {active && can(session, "students.manage") && (
                <SubjectsEditor studentId={id} enrolmentId={active.id} offerings={classOfferings} selected={subjects.map((s) => s.course_offering_id)} />
              )}
            </CardHeader>
            <CardContent>
              {subjects.length === 0 ? <p className="text-sm text-muted-foreground">No subjects allocated.</p> : (
                <div className="flex flex-wrap gap-2">
                  {subjects.map((s) => (
                    <span key={s.course_offering_id} className="rounded-md border px-2 py-1 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{s.course_offerings?.subjects?.code}</span> {s.course_offerings?.subjects?.name}
                      {s.course_offerings?.course_categories?.name && <span className="ml-1 text-xs text-muted-foreground">· {s.course_offerings.course_categories.name}</span>}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enrolment" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Enrolment history</CardTitle></CardHeader>
            <Table>
              <TableHeader><TableRow><TableHead>Session</TableHead><TableHead>Class</TableHead><TableHead>Roll</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {(enrolments.data ?? []).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.academic_sessions?.name}</TableCell>
                    <TableCell>{programmeCode(ref, e.programme_id)} · {termName(ref, e.term_id)}</TableCell>
                    <TableCell>{e.roll_no ?? "—"}</TableCell>
                    <TableCell>{formatDate(e.start_date)}</TableCell>
                    <TableCell>{formatDate(e.end_date)}</TableCell>
                    <TableCell><StatusBadge status={e.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {can(session, "students.view") && (
            <Card>
              <CardHeader><CardTitle>Status history</CardTitle></CardHeader>
              <CardContent>
                {(history.data ?? []).length === 0 ? <EmptyState title="No history" /> : (
                  <ol className="space-y-3 border-l pl-4">
                    {(history.data ?? []).map((h) => (
                      <li key={h.id} className="text-sm">
                        <p className="font-medium">{titleCase(h.event)} <span className="font-normal text-muted-foreground">· {formatDate(h.effective_date)}</span></p>
                        {h.reason && <p className="text-muted-foreground">{h.reason}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {can(session, "results.view") && (
          <TabsContent value="results">
            <Card>
              {(results.data ?? []).length === 0 ? <div className="p-6"><EmptyState title="No results yet" /></div> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Examination</TableHead><TableHead>Session</TableHead><TableHead>Percentage</TableHead><TableHead>Grade</TableHead><TableHead>Result</TableHead><TableHead>Publication</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {(results.data ?? []).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.examinations?.name}</TableCell>
                        <TableCell>{r.examinations?.academic_sessions?.name}</TableCell>
                        <TableCell className="tabular-nums">{r.percentage ?? "—"}{r.percentage !== null && "%"}</TableCell>
                        <TableCell>{r.grade ?? "—"}{r.grade_point !== null && ` (${r.grade_point})`}</TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell><StatusBadge status={r.examinations?.status} /></TableCell>
                        <TableCell><a className="text-sm text-primary hover:underline" href={`/api/pdf/marksheet/${r.id}`} target="_blank" rel="noopener">Marksheet</a></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>
        )}

        {can(session, "fees.view") && (
          <TabsContent value="fees" className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between"><CardTitle>Fee ledger</CardTitle><Button size="sm" variant="outline" asChild><Link href={`/fees/students/${id}`}>Open ledger</Link></Button></CardHeader>
              <Table>
                <TableHeader><TableRow><TableHead>Fee</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Concession</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Due</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(balances.data ?? []).map((b) => (
                    <TableRow key={b.assignment_id}>
                      <TableCell>{b.fee_structure_name}{b.is_cancelled && <span className="ml-1 text-xs text-muted-foreground">(cancelled)</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(b.gross_amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(b.concessions)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(b.paid)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatINR(b.balance)}</TableCell>
                      <TableCell>{b.is_overdue ? <StatusBadge status="overdue" /> : formatDate(b.due_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            <Card>
              <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
              <Table>
                <TableHeader><TableRow><TableHead>Receipt</TableHead><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(payments.data ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell><a href={`/api/pdf/receipt/${p.id}`} target="_blank" rel="noopener" className="font-mono text-xs text-primary hover:underline">{p.receipt_no}</a></TableCell>
                      <TableCell>{formatDate(p.payment_date)}</TableCell>
                      <TableCell>{titleCase(p.method_code)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(p.amount)}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
