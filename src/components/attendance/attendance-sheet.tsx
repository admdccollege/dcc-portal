"use client";

import { useMemo, useState } from "react";
import { CheckCheck, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useServerAction } from "@/hooks/use-server-action";
import { saveAttendance } from "@/server/attendance-actions";
import { summarise } from "@/lib/domain/attendance";
import { cn } from "@/lib/utils";

type Status = { code: string; label: string; counts_as_present: boolean; counts_in_total: boolean };
type Student = { student_id: string; roll_no: string | null; name: string; admission_no: string };

const TONE: Record<string, string> = {
  P: "data-[on=true]:bg-success data-[on=true]:text-success-foreground",
  A: "data-[on=true]:bg-destructive data-[on=true]:text-destructive-foreground",
};

export function AttendanceSheet({ context, students, statuses, existing, editable, locked, readOnlyReason }: {
  context: { academic_session_id: string; programme_id: string; term_id: string; course_offering_id: string | null; date: string; period: number; topic?: string | null };
  students: Student[];
  statuses: Status[];
  existing: Record<string, { status_code: string; remarks: string | null }>;
  editable: boolean;
  locked: boolean;
  readOnlyReason?: string;
}) {
  const initial = useMemo(() => Object.fromEntries(students.map((s) => [s.student_id, existing[s.student_id]?.status_code ?? ""])), [students, existing]);
  const [marks, setMarks] = useState<Record<string, string>>(initial);
  const [remarks, setRemarks] = useState<Record<string, string>>(Object.fromEntries(students.map((s) => [s.student_id, existing[s.student_id]?.remarks ?? ""])));
  const [topic, setTopic] = useState(context.topic ?? "");
  const { pending, run } = useServerAction();
  const hasExisting = Object.keys(existing).length > 0;

  const unmarked = students.filter((s) => !marks[s.student_id]).length;
  const summary = summarise(Object.values(marks).filter(Boolean), statuses);
  const counts = statuses.map((st) => ({ ...st, n: Object.values(marks).filter((m) => m === st.code).length }));

  const save = () =>
    run(
      () => saveAttendance({
        ...context,
        topic: topic || undefined,
        records: students.map((s) => ({ student_id: s.student_id, status_code: marks[s.student_id], remarks: remarks[s.student_id] || undefined })),
      }),
      { success: (n) => `Attendance saved for ${n} students` },
    );

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        {!editable && <Alert variant="info" title="Read-only">{readOnlyReason ?? "You cannot edit this register."}</Alert>}
        {locked && <Alert variant="warning" title="Register locked">This register has been locked by an administrator.</Alert>}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {counts.filter((c) => c.n > 0).map((c) => <span key={c.code} className="rounded-md bg-muted px-2 py-1"><strong>{c.n}</strong> {c.label}</span>)}
          {unmarked > 0 && <span className="rounded-md bg-warning/20 px-2 py-1"><strong>{unmarked}</strong> not marked</span>}
          {summary.percentage !== null && <span className="ml-auto text-muted-foreground">Present: <strong className="text-foreground">{summary.percentage}%</strong></span>}
        </div>
        {editable && (
          <div className="flex flex-wrap items-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.student_id, "P"])))}><CheckCheck /> Mark all present</Button>
            <Button variant="outline" size="sm" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.student_id, marks[s.student_id] || "P"])))}>Fill unmarked as present</Button>
            <div className="ml-auto w-full sm:w-72">
              <Input aria-label="Topic covered (optional)" placeholder="Topic covered (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow><TableHead className="w-16">Roll</TableHead><TableHead>Student</TableHead><TableHead>Status</TableHead><TableHead className="hidden md:table-cell">Remarks</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.student_id} className={cn(!marks[s.student_id] && "bg-warning/5")}>
                <TableCell className="tabular-nums">{s.roll_no ?? "—"}</TableCell>
                <TableCell><p className="font-medium">{s.name}</p><p className="font-mono text-xs text-muted-foreground">{s.admission_no}</p></TableCell>
                <TableCell>
                  <div role="radiogroup" aria-label={`Attendance for ${s.name}`} className="flex flex-wrap gap-1">
                    {statuses.map((st) => {
                      const on = marks[s.student_id] === st.code;
                      return (
                        <button
                          key={st.code}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          data-on={on}
                          disabled={!editable}
                          title={st.label}
                          onClick={() => setMarks((m) => ({ ...m, [s.student_id]: st.code }))}
                          className={cn(
                            "h-8 min-w-9 rounded-md border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer",
                            "data-[on=true]:border-transparent data-[on=true]:bg-primary data-[on=true]:text-primary-foreground hover:bg-muted",
                            TONE[st.code],
                          )}
                        >
                          {st.code}
                        </button>
                      );
                    })}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Input aria-label={`Remarks for ${s.name}`} disabled={!editable} value={remarks[s.student_id]} onChange={(e) => setRemarks((r) => ({ ...r, [s.student_id]: e.target.value }))} className="h-8" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {editable && (
          <div className="sticky bottom-2 flex items-center justify-end gap-3 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur">
            <span className="text-xs text-muted-foreground">{statuses.map((s) => `${s.code} = ${s.label}`).join(" · ")}</span>
            <Button onClick={save} loading={pending} disabled={unmarked > 0}><Save /> {hasExisting ? "Update attendance" : "Save attendance"}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
