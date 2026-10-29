import Link from "next/link";
import type { Metadata } from "next";
import { Award, CalendarCheck, IndianRupee, Megaphone } from "lucide-react";
import { requireStudent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, programmeCode, termName } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { StatCard, Alert, EmptyState } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "My dashboard" };

export default async function MyDashboard() {
  const session = await requireStudent();
  const supabase = await createClient();
  const ref = await getReferenceData();
  const { data: enrolment } = await supabase.from("student_enrolments").select("*").eq("student_id", session.studentId).eq("status", "active").maybeSingle();
  const [att, results, balances, notices] = await Promise.all([
    enrolment ? supabase.rpc("attendance_summary", { p_academic_session_id: enrolment.academic_session_id, p_student_id: session.studentId }) : { data: [] },
    supabase.from("results").select("id, status, percentage, grade, examinations(name, published_at)").eq("student_id", session.studentId).order("computed_at", { ascending: false }).limit(3),
    supabase.from("student_fee_balances").select("balance, is_overdue").eq("student_id", session.studentId).eq("is_cancelled", false),
    supabase.from("notices").select("id, title, category, published_at").eq("status", "published").order("published_at", { ascending: false }).limit(5),
  ]);
  const a = att.data?.[0];
  const threshold = Number(ref.settings?.attendance_threshold ?? 75);
  const due = (balances.data ?? []).reduce((s, b) => s + Math.max(0, Number(b.balance)), 0);
  const overdue = (balances.data ?? []).some((b) => b.is_overdue);

  return (
    <div className="space-y-5">
      <PageHeader title={`Hello, ${session.fullName.split(" ")[0]}`} description={enrolment ? `${programmeCode(ref, enrolment.programme_id)} · ${termName(ref, enrolment.term_id)} · Roll ${enrolment.roll_no ?? "—"}` : "No active enrolment"} />
      {a?.percentage !== null && a?.percentage !== undefined && Number(a.percentage) < threshold && (
        <Alert variant="warning" title="Your attendance is below the requirement">You have {a.percentage}% attendance; the minimum is {threshold}%. Please speak to your class teacher.</Alert>
      )}
      {overdue && <Alert variant="error" title="Fee overdue">You have an overdue fee balance. Please contact the accounts office.</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Attendance" value={a?.percentage === null || a?.percentage === undefined ? "—" : `${a.percentage}%`} icon={<CalendarCheck />} tone={a?.percentage !== undefined && a?.percentage !== null && Number(a.percentage) < threshold ? "warning" : "success"} hint={a ? `${a.attended} of ${a.eligible} sessions` : "No records yet"} />
        <StatCard label="Latest result" value={results.data?.[0] ? (results.data[0].percentage !== null ? `${results.data[0].percentage}%` : "—") : "—"} icon={<Award />} hint={results.data?.[0]?.examinations?.name ?? "No published results"} />
        <StatCard label="Fees due" value={formatINR(due)} icon={<IndianRupee />} tone={due > 0 ? "warning" : "success"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Published results</CardTitle></CardHeader>
          <CardContent>
            {!results.data?.length ? <EmptyState title="No published results yet" /> : (
              <ul className="divide-y text-sm">
                {results.data.map((r) => <li key={r.id} className="flex items-center justify-between py-2"><Link href="/my/results" className="hover:underline">{r.examinations?.name}</Link><StatusBadge status={r.status} /></li>)}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="size-4" /> Notices</CardTitle></CardHeader>
          <CardContent>
            {!notices.data?.length ? <EmptyState title="No notices" /> : (
              <ul className="divide-y text-sm">
                {notices.data.map((n) => <li key={n.id} className="flex items-center justify-between gap-2 py-2"><Link href={`/notices/${n.id}`} className="truncate hover:underline">{n.title}</Link><span className="shrink-0 text-xs text-muted-foreground">{formatDate(n.published_at)}</span></li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
