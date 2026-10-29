import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, param, programmeCode, termName, uuidParam } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/shared/status-badge";
import { RecordDialog } from "@/components/shared/record-dialog";
import { asRecordAction } from "@/lib/record-action";
import { saveExam } from "@/server/exam-actions";
import { formatDate, searchFilter } from "@/lib/utils";
import { examFields } from "@/components/exams/exam-fields";

export const metadata: Metadata = { title: "Examinations" };

const STATUSES = ["draft", "scheduled", "marks_entry", "marks_locked", "results_processed", "results_approved", "published"];

export default async function ExaminationsPage({ searchParams }: PageProps<"/examinations">) {
  const session = await requirePermission("exams.view", "marks.enter", "marks.enter_all");
  const sp = await searchParams;
  const ref = await getReferenceData();
  const supabase = await createClient();
  const sessionId = uuidParam(sp.session) ?? ref.currentSession?.id;
  const programmeId = uuidParam(sp.programme);
  const status = STATUSES.includes(param(sp.status) ?? "") ? param(sp.status) : undefined;

  let q = supabase.from("examinations").select("id, name, status, start_date, end_date, programme_id, term_id, marks_entry_deadline, examination_types(name), examination_subjects(count)").order("start_date", { ascending: false, nullsFirst: false });
  if (sessionId) q = q.eq("academic_session_id", sessionId);
  if (programmeId) q = q.eq("programme_id", programmeId);
  if (status) q = q.eq("status", status as "draft");
  const search = searchFilter(["name"], param(sp.q));
  if (search) q = q.or(search);

  const [{ data: exams }, { data: types }, { data: schemes }] = await Promise.all([
    q,
    supabase.from("examination_types").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("grading_schemes").select("id, name").eq("is_active", true).order("name"),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Examinations & Marks"
        description={can(session, "exams.view") ? "Examination schedules, subjects, examiners and marks entry" : "Examinations for your assigned subjects"}
        actions={can(session, "exams.manage") && (
          <RecordDialog title="New examination" wide fields={examFields(ref, types ?? [], schemes ?? [], false)} action={asRecordAction(saveExam)}
            initial={{ academic_session_id: sessionId ?? "", candidate_mode: "all_enrolled", is_provisional: true }} success="Examination created" />
        )}
      />
      <FilterBar searchPlaceholder="Examination name…" filters={[
        { name: "session", label: "Session", options: ref.sessions.map((s) => ({ value: s.id, label: s.name })), allLabel: "Current session" },
        { name: "programme", label: "Programmes", options: ref.programmes.map((p) => ({ value: p.id, label: p.code })) },
        { name: "status", label: "Statuses", options: STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") })) },
      ]} />
      <Card>
        {!exams?.length ? <div className="p-6"><EmptyState title="No examinations" description="Create an examination to schedule subjects and collect marks." /></div> : (
          <Table>
            <TableHeader><TableRow><TableHead>Examination</TableHead><TableHead>Class</TableHead><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Subjects</TableHead><TableHead>Marks deadline</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {exams.map((e) => (
                <TableRow key={e.id}>
                  <TableCell><Link href={`/examinations/${e.id}`} className="font-medium text-primary hover:underline">{e.name}</Link></TableCell>
                  <TableCell>{programmeCode(ref, e.programme_id)} · {termName(ref, e.term_id)}</TableCell>
                  <TableCell>{e.examination_types?.name}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(e.start_date)}{e.end_date && e.end_date !== e.start_date ? ` – ${formatDate(e.end_date)}` : ""}</TableCell>
                  <TableCell className="tabular-nums">{(e.examination_subjects as unknown as { count: number }[])[0]?.count ?? 0}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(e.marks_entry_deadline, true)}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
