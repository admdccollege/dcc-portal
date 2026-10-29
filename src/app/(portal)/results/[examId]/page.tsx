import { notFound } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, programmeCode, termName, UUID_RE } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, EmptyState, StatCard } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { SimpleBarChart } from "@/components/charts";
import { ExamWorkflow } from "@/components/exams/exam-workflow";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Examination results" };

export default async function ExamResultsPage({ params }: PageProps<"/results/[examId]">) {
  const session = await requirePermission("results.view");
  const { examId } = await params;
  if (!UUID_RE.test(examId)) notFound();
  const supabase = await createClient();
  const ref = await getReferenceData();
  const { data: exam } = await supabase.from("examinations").select("*, grading_schemes(name, description)").eq("id", examId).maybeSingle();
  if (!exam) notFound();

  const [{ data: results }, { data: rules }] = await Promise.all([
    supabase.from("results").select("*, students(full_name, admission_no), student_enrolments(roll_no), result_subjects(subject_code, subject_name, max_marks, marks_obtained, percentage, grade, is_pass, status)").eq("examination_id", examId),
    supabase.from("grading_rules").select("grade, min_percent, is_pass").eq("grading_scheme_id", exam.grading_scheme_id).order("min_percent", { ascending: false }),
  ]);
  const rows = (results ?? []).sort((a, b) => (a.student_enrolments?.roll_no ?? "zzz").localeCompare(b.student_enrolments?.roll_no ?? "zzz"));
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const appeared = rows.filter((r) => r.status !== "absent").length;
  const passRate = appeared ? Math.round((1000 * count("pass")) / appeared) / 10 : null;
  const pcts = rows.map((r) => r.percentage).filter((p): p is number => p !== null).map(Number);
  const avg = pcts.length ? Math.round((10 * pcts.reduce((a, b) => a + b, 0)) / pcts.length) / 10 : null;

  // Subject-wise pass rates
  const subjMap = new Map<string, { name: string; pass: number; total: number }>();
  for (const r of rows) for (const s of r.result_subjects) {
    if (s.status === "exempted" || s.is_pass === null) continue;
    const e = subjMap.get(s.subject_code) ?? { name: s.subject_name, pass: 0, total: 0 };
    e.total += 1; if (s.is_pass) e.pass += 1;
    subjMap.set(s.subject_code, e);
  }
  const subjectData = [...subjMap.entries()].map(([code, v]) => ({ label: code, value: Math.round((1000 * v.pass) / v.total) / 10, hint: `${v.name}: ${v.pass}/${v.total} passed` }));
  const gradeData = (rules ?? []).map((g) => ({ label: g.grade, value: rows.filter((r) => r.grade === g.grade).length, color: g.is_pass ? "var(--chart-1)" : "var(--destructive)" }));
  const failed = rows.flatMap((r) => r.result_subjects.filter((s) => s.is_pass === false).map((s) => ({ r, s })));

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Results — ${exam.name}`}
        description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={exam.status} />{programmeCode(ref, exam.programme_id)} · {termName(ref, exam.term_id)} · {exam.grading_schemes?.name}</span>}
        breadcrumbs={[{ label: "Results", href: "/results" }, { label: exam.name }]}
        actions={
          <>
            <ExamWorkflow examId={examId} status={exam.status} missing={0} perms={{ manage: false, lock: can(session, "marks.lock"), process: can(session, "results.process"), approve: can(session, "results.approve"), publish: can(session, "results.publish"), unpublish: can(session, "results.unpublish") }} />
            {rows.length > 0 && (
              <>
                <Button size="sm" variant="outline" asChild><a href={`/api/pdf/marksheets/${examId}`} target="_blank" rel="noopener"><FileText /> All marksheets (PDF)</a></Button>
                {can(session, "reports.export") && <Button size="sm" variant="outline" asChild><a href={`/api/export/results/${examId}?format=xlsx`}><Download /> Excel</a></Button>}
              </>
            )}
          </>
        }
      />
      {exam.status === "marks_locked" && <Alert variant="info" title="Marks are locked">Process results to compute totals, grades and pass/fail status.</Alert>}
      {exam.status === "results_processed" && <Alert variant="warning" title="Draft results">These results are not yet approved and are not visible to students.</Alert>}
      {exam.status === "results_approved" && <Alert variant="info" title="Approved">Approved {formatDate(exam.approved_at, true)}. Results are locked and awaiting publication.</Alert>}
      {exam.status === "published" && <Alert variant="success" title="Published">Published {formatDate(exam.published_at, true)}{exam.is_provisional ? " as provisional results" : ""}.</Alert>}

      {rows.length === 0 ? <EmptyState title="No results computed yet" /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Candidates" value={rows.length} />
            <StatCard label="Passed" value={count("pass")} tone="success" hint={passRate !== null ? `${passRate}% of appeared` : undefined} />
            <StatCard label="Compartment" value={count("compartment")} tone="warning" />
            <StatCard label="Failed" value={count("fail")} tone="destructive" />
            <StatCard label="Average %" value={avg ?? "—"} hint={`${count("absent")} absent · ${count("withheld")} withheld`} />
          </div>
          <Tabs defaultValue="students">
            <TabsList>
              <TabsTrigger value="students">Student results</TabsTrigger>
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
              <TabsTrigger value="failed">Failed subjects ({failed.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="students">
              <Card>
                <Table>
                  <TableHeader><TableRow><TableHead>Roll</TableHead><TableHead>Student</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">%</TableHead><TableHead>Grade</TableHead><TableHead className="text-right">Failed</TableHead><TableHead>Result</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.student_enrolments?.roll_no ?? "—"}</TableCell>
                        <TableCell>{r.students?.full_name} <span className="font-mono text-xs text-muted-foreground">{r.students?.admission_no}</span></TableCell>
                        <TableCell className="text-right tabular-nums">{r.total_obtained ?? "—"}/{r.total_max ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.percentage ?? "—"}</TableCell>
                        <TableCell>{r.grade ?? "—"}{r.grade_point !== null && ` (${r.grade_point})`}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.failed_subjects}</TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell><a href={`/api/pdf/marksheet/${r.id}`} target="_blank" rel="noopener" className="text-sm text-primary hover:underline">Marksheet</a></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
            <TabsContent value="analysis" className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Subject-wise pass rate</CardTitle><CardDescription>% of candidates passing each subject</CardDescription></CardHeader>
                <CardContent><SimpleBarChart data={subjectData} format="percent" ariaLabel="Subject-wise pass rate" /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Grade distribution</CardTitle><CardDescription>Overall grade per candidate</CardDescription></CardHeader>
                <CardContent><SimpleBarChart data={gradeData} ariaLabel="Grade distribution" /></CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="failed">
              <Card>
                {failed.length === 0 ? <div className="p-6"><EmptyState title="No failed subjects" /></div> : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Subject</TableHead><TableHead className="text-right">Marks</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {failed.map(({ r, s }, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.students?.full_name} <span className="font-mono text-xs text-muted-foreground">{r.students?.admission_no}</span></TableCell>
                          <TableCell>{s.subject_code} {s.subject_name}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.marks_obtained ?? "—"}/{s.max_marks ?? "—"}</TableCell>
                          <TableCell><StatusBadge status={s.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
              <p className="mt-2 text-xs text-muted-foreground">To schedule an improvement/supplementary examination, create an examination with “Selected candidates” and use “Add from failures”.</p>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
