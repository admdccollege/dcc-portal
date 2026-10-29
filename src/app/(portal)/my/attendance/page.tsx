import { requireStudent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard, EmptyState } from "@/components/ui/misc";
import { sessionsNeededToReach } from "@/lib/domain/attendance";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "My attendance" };

export default async function MyAttendance() {
  const session = await requireStudent();
  const supabase = await createClient();
  const ref = await getReferenceData();
  const { data: e } = await supabase.from("student_enrolments").select("academic_session_id, student_subject_enrolments(course_offering_id, course_offerings(subjects(code, name)))").eq("student_id", session.studentId).eq("status", "active").maybeSingle();
  if (!e) return <EmptyState title="No active enrolment" />;
  const threshold = Number(ref.settings?.attendance_threshold ?? 75);
  const [{ data: overall }, perSubject, { data: recent }] = await Promise.all([
    supabase.rpc("attendance_summary", { p_academic_session_id: e.academic_session_id, p_student_id: session.studentId }),
    Promise.all(e.student_subject_enrolments.map(async (s) => {
      const { data } = await supabase.rpc("attendance_summary", { p_academic_session_id: e.academic_session_id, p_offering_id: s.course_offering_id, p_student_id: session.studentId });
      return { code: s.course_offerings?.subjects?.code, name: s.course_offerings?.subjects?.name, s: data?.[0] };
    })),
    supabase.from("attendance_records").select("status_code, attendance_sessions(date, period, course_offerings(subjects(code)))").eq("student_id", session.studentId).order("updated_at", { ascending: false }).limit(30),
  ]);
  const o = overall?.[0];
  const need = o && o.percentage !== null && Number(o.percentage) < threshold ? sessionsNeededToReach(Number(o.attended), Number(o.eligible), threshold) : null;
  return (
    <div className="space-y-5">
      <PageHeader title="My attendance" description={`Minimum required: ${threshold}%. Approved leave is excluded from the total.`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Overall" value={o?.percentage === null || !o ? "—" : `${o.percentage}%`} tone={o?.percentage !== null && o && Number(o.percentage) < threshold ? "warning" : "success"} hint={o ? `${o.attended} attended of ${o.eligible}` : undefined} />
        <StatCard label="Excused sessions" value={o?.excluded ?? 0} />
        <StatCard label="To reach the minimum" value={need === null ? "On track" : `${need} sessions`} hint={need !== null ? "consecutive sessions attended" : undefined} />
      </div>
      <Card>
        <CardHeader><CardTitle>By subject</CardTitle></CardHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead className="text-right">Attended</TableHead><TableHead className="text-right">Eligible</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
          <TableBody>
            {perSubject.map((p) => (
              <TableRow key={p.code}>
                <TableCell><span className="font-mono text-xs text-muted-foreground">{p.code}</span> {p.name}</TableCell>
                <TableCell className="text-right tabular-nums">{p.s?.attended ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{p.s?.eligible ?? 0}</TableCell>
                <TableCell className={`text-right font-medium tabular-nums ${p.s?.percentage !== null && p.s && Number(p.s.percentage) < threshold ? "text-destructive" : ""}`}>{p.s?.percentage === null || !p.s ? "—" : `${p.s.percentage}%`}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent records</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {(recent ?? []).map((r, i) => (
            <span key={i} className={`rounded-md border px-2 py-1 text-xs ${r.status_code === "A" ? "border-destructive/40 bg-destructive/10" : ""}`}>
              {formatDate(r.attendance_sessions?.date)} · {r.attendance_sessions?.course_offerings?.subjects?.code ?? "Class"} · <strong>{r.status_code}</strong>
            </span>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
