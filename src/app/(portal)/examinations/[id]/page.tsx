import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, programmeCode, termName, UUID_RE } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { RecordDialog, type FieldConfig } from "@/components/shared/record-dialog";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { ExamWorkflow } from "@/components/exams/exam-workflow";
import { examFields } from "@/components/exams/exam-fields";
import { asRecordAction } from "@/lib/record-action";
import { addAllOfferingsToExam, addCandidatesFromFailures, deleteExam, deleteExamSubject, saveExam, saveExamSubject } from "@/server/exam-actions";
import { formatDate, titleCase, toISTInput } from "@/lib/utils";

export const metadata = { title: "Examination" };

const COMPONENTS = ["theory", "practical", "internal", "combined"].map((c) => ({ value: c, label: titleCase(c) }));

export default async function ExamPage({ params }: PageProps<"/examinations/[id]">) {
  const session = await requirePermission("exams.view", "marks.enter", "marks.enter_all");
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createClient();
  const ref = await getReferenceData();
  const { data: exam } = await supabase.from("examinations").select("*, examination_types(name, is_supplementary), grading_schemes(name)").eq("id", id).maybeSingle();
  if (!exam) notFound();

  const [{ data: subjects }, { data: progress }, { data: offerings }, { data: staff }, { data: types }, { data: schemes }, { data: mine }, candidates, sourceExams] = await Promise.all([
    supabase.from("examination_subjects").select("*, course_offerings(id, subjects(code, name))").eq("examination_id", id).order("exam_date", { nullsFirst: false }),
    supabase.rpc("exam_marks_progress", { p_exam_id: id }),
    supabase.from("course_offerings").select("id, subjects(code, name)").eq("academic_session_id", exam.academic_session_id).eq("term_id", exam.term_id),
    can(session, "exams.manage") ? supabase.rpc("staff_directory") : { data: [] },
    supabase.from("examination_types").select("id, name").order("sort_order"),
    supabase.from("grading_schemes").select("id, name").eq("is_active", true),
    supabase.rpc("my_offering_ids"),
    exam.candidate_mode === "selected" ? supabase.from("examination_candidates").select("student_id, students(full_name, admission_no), course_offerings(subjects(code))").eq("examination_id", id) : { data: null },
    exam.candidate_mode === "selected" && can(session, "exams.manage") ? supabase.from("examinations").select("id, name").eq("status", "published").eq("programme_id", exam.programme_id).neq("id", id) : { data: [] },
  ]);
  const mineSet = new Set((mine ?? []) as unknown as string[]);
  const prog = new Map((progress ?? []).map((p) => [p.examination_subject_id, p]));
  const totalMissing = (progress ?? []).reduce((a, p) => a + Number(p.missing), 0);
  const editable = ["draft", "scheduled", "marks_entry"].includes(exam.status) && can(session, "exams.manage");
  const enterAll = can(session, "marks.enter_all");

  const subjectFields: FieldConfig[] = [
    { name: "course_offering_id", label: "Subject", type: "select", required: true, options: (offerings ?? []).map((o) => ({ value: o.id, label: `${o.subjects?.code} — ${o.subjects?.name}` })), full: true },
    { name: "component", label: "Component", type: "select", required: true, options: COMPONENTS },
    { name: "max_marks", label: "Maximum marks", type: "number", required: true, step: "0.5" },
    { name: "pass_marks", label: "Pass marks", type: "number", step: "0.5", hint: "Leave blank if no component pass mark" },
    { name: "exam_date", label: "Exam date", type: "date" },
    { name: "start_time", label: "Start time", type: "time" },
    { name: "duration_minutes", label: "Duration (minutes)", type: "number" },
    { name: "examiner_staff_id", label: "Examiner", type: "select", options: (staff ?? []).filter((s) => s.is_teaching).map((s) => ({ value: s.id, label: s.full_name })) },
    { name: "marks_deadline", label: "Marks deadline for this subject (IST)", type: "datetime-local", hint: "Overrides the examination deadline" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={exam.name}
        description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={exam.status} /> {programmeCode(ref, exam.programme_id)} · {termName(ref, exam.term_id)} · {exam.examination_types?.name} · Grading: {exam.grading_schemes?.name}</span>}
        breadcrumbs={[{ label: "Examinations", href: "/examinations" }, { label: exam.name }]}
        actions={
          <>
            <ExamWorkflow examId={id} status={exam.status} missing={totalMissing} perms={{
              manage: can(session, "exams.manage"), lock: can(session, "marks.lock"), process: can(session, "results.process"),
              approve: can(session, "results.approve"), publish: can(session, "results.publish"), unpublish: can(session, "results.unpublish"),
            }} />
            {can(session, "results.view") && ["results_processed", "results_approved", "published"].includes(exam.status) && (
              <Button size="sm" variant="outline" asChild><Link href={`/results/${id}`}>View results</Link></Button>
            )}
            {editable && (
              <RecordDialog mode="edit" triggerLabel="Edit details" triggerVariant="outline" triggerSize="sm" title="Edit examination" wide fields={examFields(ref, types ?? [], schemes ?? [], true)} action={asRecordAction(saveExam)}
                initial={{ id, academic_session_id: exam.academic_session_id, programme_id: exam.programme_id, term_id: exam.term_id, name: exam.name, examination_type_id: exam.examination_type_id, grading_scheme_id: exam.grading_scheme_id, start_date: exam.start_date ?? "", end_date: exam.end_date ?? "", marks_entry_deadline: toISTInput(exam.marks_entry_deadline), candidate_mode: exam.candidate_mode, is_provisional: exam.is_provisional }} />
            )}
            {exam.status === "draft" && can(session, "exams.manage") && (
              <ConfirmAction size="sm" variant="ghost" icon={<Trash2 />} label="Delete" title="Delete this draft examination?" action={deleteExam.bind(null, { id })} success="Deleted" />
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Dates</p><p className="font-medium">{formatDate(exam.start_date)} – {formatDate(exam.end_date)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Marks entry deadline</p><p className="font-medium">{formatDate(exam.marks_entry_deadline, true)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Missing marks</p><p className={`font-medium ${totalMissing ? "text-destructive" : "text-success"}`}>{totalMissing}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Result type</p><p className="font-medium">{exam.is_provisional ? "Provisional" : "Final"}</p></CardContent></Card>
      </div>

      {exam.status === "marks_entry" && totalMissing > 0 && can(session, "marks.lock") && (
        <Alert variant="warning" title={`${totalMissing} mark(s) still missing`}>Marks cannot be locked until every candidate has marks or a status such as absent or exempted. Missing marks are never treated as zero.</Alert>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div><CardTitle>Subjects & components</CardTitle><CardDescription>Maximum and pass marks, examiners and marks-entry progress</CardDescription></div>
          {editable && (
            <div className="flex gap-2">
              <RecordDialog title="Add every class subject" triggerLabel="Add all subjects" triggerVariant="outline" description="Adds one component for every subject offered in this class."
                fields={[{ name: "component", label: "Component", type: "select", required: true, options: COMPONENTS }, { name: "max_marks", label: "Maximum marks", type: "number", required: true }, { name: "pass_marks", label: "Pass marks", type: "number" }]}
                initial={{ examination_id: id, component: "theory", max_marks: "100", pass_marks: "" }} action={asRecordAction(addAllOfferingsToExam)} success="Subjects added" />
              <RecordDialog title="Add subject component" triggerLabel="Add subject" wide fields={subjectFields} initial={{ examination_id: id, component: "theory" }} action={asRecordAction(saveExamSubject)} />
            </div>
          )}
        </CardHeader>
        {!subjects?.length ? <div className="p-5 pt-0"><EmptyState title="No subjects added" /></div> : (
          <Table>
            <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Component</TableHead><TableHead className="text-right">Max</TableHead><TableHead className="text-right">Pass</TableHead><TableHead>Date</TableHead><TableHead>Examiner</TableHead><TableHead>Progress</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {subjects.map((s) => {
                const p = prog.get(s.id);
                const mineSubject = mineSet.has(s.course_offering_id) || s.examiner_staff_id === session.staffId;
                const canEnter = (enterAll || (can(session, "marks.enter") && mineSubject));
                return (
                  <TableRow key={s.id}>
                    <TableCell><span className="font-mono text-xs text-muted-foreground">{s.course_offerings?.subjects?.code}</span> {s.course_offerings?.subjects?.name}</TableCell>
                    <TableCell>{titleCase(s.component)}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.max_marks}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.pass_marks ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(s.exam_date)}{s.start_time ? ` ${s.start_time.slice(0, 5)}` : ""}</TableCell>
                    <TableCell>{(staff ?? []).find((x) => x.id === s.examiner_staff_id)?.full_name ?? (s.examiner_staff_id ? "Assigned" : "—")}</TableCell>
                    <TableCell>
                      {p ? (
                        <span className="flex items-center gap-2 text-sm tabular-nums">
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-success" style={{ width: `${Number(p.candidates) ? (100 * Number(p.entered)) / Number(p.candidates) : 0}%` }} /></span>
                          {p.entered}/{p.candidates}
                          {Number(p.missing) > 0 && <AlertTriangle className="size-3.5 text-warning" aria-label={`${p.missing} missing`} />}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {(canEnter || can(session, "exams.view")) && (
                          <Button size="sm" variant={canEnter && exam.status === "marks_entry" ? "default" : "outline"} asChild>
                            <Link href={`/examinations/${id}/marks/${s.id}`}>{canEnter && exam.status === "marks_entry" ? "Enter marks" : "View marks"}</Link>
                          </Button>
                        )}
                        {editable && (
                          <>
                            <RecordDialog mode="edit" title="Edit subject component" wide fields={subjectFields} action={asRecordAction(saveExamSubject)}
                              initial={{ id: s.id, examination_id: id, course_offering_id: s.course_offering_id, component: s.component, max_marks: String(s.max_marks), pass_marks: s.pass_marks?.toString() ?? "", exam_date: s.exam_date ?? "", start_time: s.start_time?.slice(0, 5) ?? "", duration_minutes: s.duration_minutes?.toString() ?? "", examiner_staff_id: s.examiner_staff_id ?? "", marks_deadline: toISTInput(s.marks_deadline) }} />
                            {Number(p?.entered ?? 0) === 0 && (
                              <ConfirmAction size="icon" variant="ghost" icon={<Trash2 />} label="" title="Remove this subject from the examination?" action={deleteExamSubject.bind(null, { id: s.id, examination_id: id })} success="Removed" />
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {exam.candidate_mode === "selected" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>Selected candidates</CardTitle><CardDescription>Only these students sit this examination (per subject).</CardDescription></div>
            {editable && (
              <RecordDialog title="Add candidates from failed subjects" triggerLabel="Add from failures" description="Adds every student who failed a subject in a published examination of this programme."
                fields={[{ name: "source_exam_id", label: "Source examination", type: "select", required: true, options: (sourceExams.data ?? []).map((e) => ({ value: e.id, label: e.name })) }]}
                initial={{ target_exam_id: id }} action={asRecordAction(addCandidatesFromFailures)} success="Candidates added" />
            )}
          </CardHeader>
          {!candidates.data?.length ? <div className="p-5 pt-0"><EmptyState title="No candidates yet" /></div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Admission no.</TableHead><TableHead>Subject</TableHead></TableRow></TableHeader>
              <TableBody>
                {candidates.data.map((c, i) => (
                  <TableRow key={i}><TableCell>{c.students?.full_name}</TableCell><TableCell className="font-mono text-xs">{c.students?.admission_no}</TableCell><TableCell>{c.course_offerings?.subjects?.code}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
