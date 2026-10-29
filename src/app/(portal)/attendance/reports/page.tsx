import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, param, programmeCode, uuidParam } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { UrlControls } from "@/components/shared/url-controls";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, StatCard } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { SimpleBarChart } from "@/components/charts";
import { sendLowAttendanceAlerts } from "@/server/attendance-actions";
import { sessionsNeededToReach } from "@/lib/domain/attendance";

export const metadata: Metadata = { title: "Attendance reports" };

export default async function AttendanceReportsPage({ searchParams }: PageProps<"/attendance/reports">) {
  const session = await requirePermission("attendance.take", "attendance.view_all");
  const sp = await searchParams;
  const ref = await getReferenceData();
  const supabase = await createClient();
  const sessionId = uuidParam(sp.session) ?? ref.currentSession?.id;
  const termId = uuidParam(sp.term);
  const subjectId = uuidParam(sp.subject);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(param(sp.from) ?? "") ? param(sp.from) : undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(param(sp.to) ?? "") ? param(sp.to) : undefined;
  const threshold = Number(ref.settings?.attendance_threshold ?? 75);
  const term = ref.terms.find((t) => t.id === termId);

  const { data: offerings } = term && sessionId
    ? await supabase.from("course_offerings").select("id, subjects(code, name)").eq("academic_session_id", sessionId).eq("term_id", term.id)
    : { data: [] };

  let body: React.ReactNode = <EmptyState title="Select a class" description="Choose a class (and optionally a subject and date range) to see attendance summaries." />;
  let classAvg: number | null = null;
  let below = 0;

  if (term && sessionId) {
    const [{ data: summary }, { data: roster }, subjectSummaries] = await Promise.all([
      supabase.rpc("attendance_summary", { p_academic_session_id: sessionId, p_programme_id: term.programme_id, p_term_id: term.id, p_offering_id: subjectId, p_from: from, p_to: to }),
      supabase.from("student_enrolments").select("student_id, roll_no, students(full_name, admission_no)").eq("academic_session_id", sessionId).eq("term_id", term.id).in("status", ["active", "promoted", "repeated", "completed"]),
      subjectId ? Promise.resolve([]) : Promise.all((offerings ?? []).map(async (o) => {
        const { data } = await supabase.rpc("attendance_summary", { p_academic_session_id: sessionId, p_programme_id: term.programme_id, p_term_id: term.id, p_offering_id: o.id, p_from: from, p_to: to });
        const a = (data ?? []).reduce((s, r) => s + Number(r.attended), 0);
        const e = (data ?? []).reduce((s, r) => s + Number(r.eligible), 0);
        return { label: o.subjects?.code ?? "", value: e > 0 ? Math.round((1000 * a) / e) / 10 : null, hint: o.subjects?.name };
      })),
    ]);
    const byStudent = new Map((summary ?? []).map((s) => [s.student_id, s]));
    const rows = (roster ?? []).map((r) => ({ ...r, s: byStudent.get(r.student_id) }))
      .sort((a, b) => (a.roll_no ?? "zzz").localeCompare(b.roll_no ?? "zzz"));
    const totA = (summary ?? []).reduce((s, r) => s + Number(r.attended), 0);
    const totE = (summary ?? []).reduce((s, r) => s + Number(r.eligible), 0);
    classAvg = totE > 0 ? Math.round((1000 * totA) / totE) / 10 : null;
    below = rows.filter((r) => r.s?.percentage !== null && r.s?.percentage !== undefined && Number(r.s.percentage) < threshold).length;

    body = (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Class average" value={classAvg === null ? "—" : `${classAvg}%`} tone={classAvg !== null && classAvg < threshold ? "warning" : "success"} />
          <StatCard label={`Below ${threshold}%`} value={below} tone={below ? "destructive" : "success"} />
          <StatCard label="Students" value={rows.length} />
        </div>
        {!subjectId && subjectSummaries.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Subject-wise attendance</CardTitle><CardDescription>Average across students</CardDescription></CardHeader>
            <CardContent><SimpleBarChart data={subjectSummaries} format="percent" ariaLabel="Subject-wise attendance percentage" height={220} /></CardContent>
          </Card>
        )}
        <Card>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Roll</TableHead><TableHead>Student</TableHead><TableHead className="text-right">Attended</TableHead><TableHead className="text-right">Eligible</TableHead><TableHead className="text-right">Excused</TableHead><TableHead className="text-right">%</TableHead><TableHead>Note</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const pct = r.s?.percentage === null || r.s?.percentage === undefined ? null : Number(r.s.percentage);
                const low = pct !== null && pct < threshold;
                const need = r.s && low ? sessionsNeededToReach(Number(r.s.attended), Number(r.s.eligible), threshold) : null;
                return (
                  <TableRow key={r.student_id}>
                    <TableCell>{r.roll_no ?? "—"}</TableCell>
                    <TableCell>{r.students?.full_name}<span className="ml-2 font-mono text-xs text-muted-foreground">{r.students?.admission_no}</span></TableCell>
                    <TableCell className="text-right tabular-nums">{r.s?.attended ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.s?.eligible ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.s?.excluded ?? 0}</TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${low ? "text-destructive" : ""}`}>{pct === null ? "—" : `${pct}%`}</TableCell>
                    <TableCell>{pct === null ? <span className="text-xs text-muted-foreground">No records</span> : low ? <Badge variant="destructive">Low{need ? ` · needs ${need}` : ""}</Badge> : null}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  const exportQs = new URLSearchParams(Object.entries({ session: sessionId, term: termId, subject: subjectId, from, to }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance reports"
        description={`Attendance % = attended ÷ eligible sessions × 100. Statuses excluded from the total (e.g. approved leave) are shown as excused. Threshold: ${threshold}%.`}
        breadcrumbs={[{ label: "Attendance", href: "/attendance" }, { label: "Reports" }]}
        actions={term && (
          <>
            <Button variant="outline" size="sm" asChild><a href={`/api/export/attendance?format=csv&${exportQs}`}><Download /> CSV</a></Button>
            <Button variant="outline" size="sm" asChild><a href={`/api/export/attendance?format=xlsx&${exportQs}`}><Download /> Excel</a></Button>
            {can(session, "attendance.view_all") && sessionId && below > 0 && (
              <ConfirmAction label="Send low-attendance alerts" size="sm" title="Notify students below the threshold?"
                description={`Students in this class with attendance below ${threshold}% (and a login account) will receive a portal notification.`}
                action={sendLowAttendanceAlerts.bind(null, { academic_session_id: sessionId, programme_id: term.programme_id, term_id: term.id })}
                success="Alerts sent" />
            )}
          </>
        )}
      />
      <UrlControls controls={[
        { name: "session", label: "Session", type: "select", options: ref.sessions.map((s) => ({ value: s.id, label: s.name })), placeholder: "Current session" },
        { name: "term", label: "Class", type: "select", options: ref.terms.map((t) => ({ value: t.id, label: `${programmeCode(ref, t.programme_id)} · ${t.name}` })), resets: ["subject"] },
        { name: "subject", label: "Subject", type: "select", options: (offerings ?? []).map((o) => ({ value: o.id, label: `${o.subjects?.code} — ${o.subjects?.name}` })), placeholder: "All subjects", width: "w-full sm:w-64" },
        { name: "from", label: "From", type: "date", width: "w-full sm:w-40" },
        { name: "to", label: "To", type: "date", width: "w-full sm:w-40" },
      ]} />
      {body}
    </div>
  );
}
