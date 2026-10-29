import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, programmeCode, termName, UUID_RE } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { MarksGrid } from "@/components/exams/marks-grid";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { formatDate, titleCase } from "@/lib/utils";

export const metadata = { title: "Marks entry" };

export default async function MarksEntryPage({ params }: PageProps<"/examinations/[id]/marks/[subjectId]">) {
  const session = await requirePermission("exams.view", "marks.enter", "marks.enter_all");
  const { id, subjectId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(subjectId)) notFound();
  const supabase = await createClient();
  const ref = await getReferenceData();

  const { data: es } = await supabase.from("examination_subjects").select("*, examinations(*), course_offerings(id, subjects(code, name))").eq("id", subjectId).eq("examination_id", id).maybeSingle();
  if (!es || !es.examinations) notFound();
  const exam = es.examinations;

  // Candidates for this subject
  let rows: { student_id: string; roll_no: string | null; name: string; admission_no: string }[] = [];
  if (exam.candidate_mode === "selected") {
    const { data } = await supabase.from("examination_candidates").select("student_id, students(full_name, admission_no, student_enrolments(roll_no, academic_session_id, term_id))").eq("examination_id", id).eq("course_offering_id", es.course_offering_id);
    rows = (data ?? []).map((c) => ({
      student_id: c.student_id, name: c.students?.full_name ?? "", admission_no: c.students?.admission_no ?? "",
      roll_no: c.students?.student_enrolments.find((e) => e.academic_session_id === exam.academic_session_id && e.term_id === exam.term_id)?.roll_no ?? null,
    }));
  } else {
    const { data } = await supabase.from("student_subject_enrolments")
      .select("student_enrolments!inner(student_id, roll_no, status, academic_session_id, term_id, students(full_name, admission_no))")
      .eq("course_offering_id", es.course_offering_id)
      .eq("student_enrolments.academic_session_id", exam.academic_session_id).eq("student_enrolments.term_id", exam.term_id)
      .in("student_enrolments.status", ["active", "promoted", "repeated", "completed"]);
    rows = (data ?? []).map((r) => ({ student_id: r.student_enrolments.student_id, roll_no: r.student_enrolments.roll_no, name: r.student_enrolments.students?.full_name ?? "", admission_no: r.student_enrolments.students?.admission_no ?? "" }));
  }
  rows.sort((a, b) => (a.roll_no ?? "zzz").localeCompare(b.roll_no ?? "zzz") || a.name.localeCompare(b.name));

  const [{ data: marks }, { data: canEnter }, { data: revisions }] = await Promise.all([
    supabase.from("marks").select("student_id, marks_obtained, status, revision").eq("examination_subject_id", subjectId),
    supabase.rpc("can_enter_marks", { p_exam_subject_id: subjectId }),
    supabase.from("mark_revisions").select("id, student_id, old_marks, new_marks, old_status, new_status, reason, changed_at").eq("examination_subject_id", subjectId).order("changed_at", { ascending: false }).limit(50),
  ]);
  const existing = Object.fromEntries((marks ?? []).map((m) => [m.student_id, { marks: m.marks_obtained, status: m.status, revision: m.revision }]));
  const deadline = es.marks_deadline ?? exam.marks_entry_deadline;
  const afterDeadline = !!deadline && new Date(deadline) < new Date();
  const editable = !!canEnter && exam.status === "marks_entry" && (!afterDeadline || can(session, "marks.correct"));
  const reason = exam.status !== "marks_entry"
    ? `Marks entry is not open (status: ${titleCase(exam.status)}).`
    : !canEnter ? "You are not assigned to this subject." : "The marks entry deadline has passed. Contact the Examination Controller for corrections.";
  const nameById = new Map(rows.map((r) => [r.student_id, r.name]));

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${es.course_offerings?.subjects?.code} ${es.course_offerings?.subjects?.name} — ${titleCase(es.component)}`}
        description={`${exam.name} · ${programmeCode(ref, exam.programme_id)} ${termName(ref, exam.term_id)} · Max ${es.max_marks}${es.pass_marks !== null ? ` · Pass ${es.pass_marks}` : ""} · Deadline ${formatDate(deadline, true)}`}
        breadcrumbs={[{ label: "Examinations", href: "/examinations" }, { label: exam.name, href: `/examinations/${id}` }, { label: "Marks" }]}
      />
      {rows.length === 0 ? <EmptyState title="No candidates" description="No students are enrolled in this subject for this examination." /> : (
        <MarksGrid examId={id} examSubjectId={subjectId} rows={rows} existing={existing} maxMarks={Number(es.max_marks)} passMarks={es.pass_marks === null ? null : Number(es.pass_marks)}
          editable={editable} afterDeadline={afterDeadline} readOnlyReason={reason} />
      )}
      {(revisions ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Revision history (latest 50)</CardTitle></CardHeader>
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Student</TableHead><TableHead>Change</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
            <TableBody>
              {(revisions ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(r.changed_at, true)}</TableCell>
                  <TableCell>{nameById.get(r.student_id) ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{r.old_status ? `${r.old_marks ?? titleCase(r.old_status)}` : "∅"} → {r.new_status ? `${r.new_marks ?? titleCase(r.new_status)}` : "cleared"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.reason ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
