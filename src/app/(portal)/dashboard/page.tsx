import Link from "next/link";
import type { Metadata } from "next";
import { CalendarCheck, ClipboardList, IndianRupee, Users, AlertTriangle, FilePen } from "lucide-react";
import { requireStaff, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, programmeCode, termName } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { StatCard, EmptyState } from "@/components/ui/misc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleBarChart, SimpleLineChart } from "@/components/charts";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatINR, todayIST } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function DashboardPage() {
  const session = await requireStaff();
  const supabase = await createClient();
  const ref = await getReferenceData();
  const sessionId = ref.currentSession?.id;
  const today = todayIST();
  const from30 = new Date(Date.parse(`${today}T00:00:00Z`) - 30 * 86400000).toISOString().slice(0, 10);

  const showStudents = can(session, "students.view");
  const showAdmissions = can(session, "admissions.view");
  const showAttendance = can(session, "attendance.view_all");
  const showFees = can(session, "fees.view");
  const showResults = can(session, "results.view");
  const isTeacher = !!session.staffId && can(session, "attendance.take", "marks.enter");

  const sixMonthsAgo = new Date(Date.parse(`${today}T00:00:00Z`));
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 5, 1);

  const [students, admissions, enrolments, attendance, payments, balances, notices, latestExam] = await Promise.all([
    showStudents ? supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active") : null,
    showAdmissions ? supabase.from("admissions").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review"]) : null,
    showStudents && sessionId ? supabase.from("student_enrolments").select("programme_id").eq("academic_session_id", sessionId).eq("status", "active") : null,
    showAttendance && sessionId ? supabase.rpc("attendance_summary", { p_academic_session_id: sessionId, p_from: from30, p_to: today }) : null,
    showFees ? supabase.from("payments").select("amount, payment_date").eq("status", "completed").gte("payment_date", sixMonthsAgo.toISOString().slice(0, 10)) : null,
    showFees ? supabase.from("student_fee_balances").select("balance, is_overdue").eq("is_cancelled", false).gt("balance", 0) : null,
    supabase.from("notices").select("id, title, category, published_at, is_pinned").eq("status", "published").order("is_pinned", { ascending: false }).order("published_at", { ascending: false }).limit(5),
    showResults ? supabase.from("examinations").select("id, name, programme_id, term_id, published_at").eq("status", "published").order("published_at", { ascending: false }).limit(1).maybeSingle() : null,
  ]);

  // Attendance (last 30 days, all classes visible to the user)
  const att = attendance?.data ?? [];
  const attended = att.reduce((a, r) => a + Number(r.attended), 0);
  const eligible = att.reduce((a, r) => a + Number(r.eligible), 0);
  const attPct = eligible > 0 ? Math.round((1000 * attended) / eligible) / 10 : null;
  const threshold = Number(ref.settings?.attendance_threshold ?? 75);
  const lowAttendance = att.filter((r) => r.percentage !== null && Number(r.percentage) < threshold).length;

  // Enrolment by programme
  const enrolCounts = new Map<string, number>();
  for (const e of enrolments?.data ?? []) enrolCounts.set(e.programme_id, (enrolCounts.get(e.programme_id) ?? 0) + 1);
  const enrolData = ref.programmes.filter((p) => enrolCounts.has(p.id)).map((p) => ({ label: p.code, value: enrolCounts.get(p.id) ?? 0, hint: p.name }));

  // Fee collection by month
  const months: { key: string; label: string; value: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(sixMonthsAgo);
    d.setUTCMonth(sixMonthsAgo.getUTCMonth() + i);
    months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString("en-IN", { month: "short", timeZone: "UTC" }), value: 0 });
  }
  for (const p of payments?.data ?? []) {
    const m = months.find((x) => x.key === p.payment_date.slice(0, 7));
    if (m) m.value += Number(p.amount);
  }
  const thisMonth = months[months.length - 1]?.value ?? 0;
  const outstanding = (balances?.data ?? []).reduce((a, b) => a + Number(b.balance), 0);
  const overdueCount = (balances?.data ?? []).filter((b) => b.is_overdue).length;

  // Latest published exam result breakdown
  let resultData: { label: string; value: number; color: string }[] = [];
  if (latestExam?.data) {
    const { data: res } = await supabase.from("results").select("status").eq("examination_id", latestExam.data.id);
    const count = (s: string) => (res ?? []).filter((r) => r.status === s).length;
    resultData = [
      { label: "Pass", value: count("pass"), color: "var(--success)" },
      { label: "Compartment", value: count("compartment"), color: "var(--warning)" },
      { label: "Fail", value: count("fail"), color: "var(--destructive)" },
      { label: "Absent / withheld", value: count("absent") + count("withheld"), color: "var(--muted-foreground)" },
    ];
  }

  // Teacher widgets
  let todayClasses: { id: string; period: number; subject: string; cls: string; room: string | null }[] = [];
  const pendingMarks: { id: string; exam: string; subject: string; missing: number; examId: string }[] = [];
  if (isTeacher && session.staffId && sessionId) {
    const dow = ((new Date(`${today}T12:00:00+05:30`).getUTCDay() + 6) % 7) + 1;
    const { data: tt } = await supabase
      .from("timetable_entries")
      .select("id, period_no, room, programme_id, term_id, course_offerings(subjects(code, name))")
      .eq("academic_session_id", sessionId).eq("staff_id", session.staffId).eq("day_of_week", dow).order("period_no");
    todayClasses = (tt ?? []).map((t) => ({
      id: t.id, period: t.period_no, room: t.room,
      subject: t.course_offerings?.subjects ? `${t.course_offerings.subjects.code} ${t.course_offerings.subjects.name}` : "—",
      cls: `${programmeCode(ref, t.programme_id)} · ${termName(ref, t.term_id)}`,
    }));

    const [{ data: exams }, { data: mine }] = await Promise.all([
      supabase.from("examinations").select("id, name").eq("status", "marks_entry"),
      supabase.rpc("my_offering_ids"),
    ]);
    const mineSet = new Set((mine ?? []) as unknown as string[]);
    for (const ex of exams ?? []) {
      const [{ data: prog }, { data: subs }] = await Promise.all([
        supabase.rpc("exam_marks_progress", { p_exam_id: ex.id }),
        supabase.from("examination_subjects").select("id, component, course_offering_id, examiner_staff_id, course_offerings(subjects(code))").eq("examination_id", ex.id),
      ]);
      for (const s of subs ?? []) {
        if (!mineSet.has(s.course_offering_id) && s.examiner_staff_id !== session.staffId) continue;
        const p = (prog ?? []).find((x) => x.examination_subject_id === s.id);
        if (p && Number(p.missing) > 0) {
          pendingMarks.push({ id: s.id, examId: ex.id, exam: ex.name, subject: `${s.course_offerings?.subjects?.code ?? ""} (${s.component})`, missing: Number(p.missing) });
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${session.fullName.split(" ")[0]}`}
        description={`${ref.settings?.name ?? "Damdei Christian College"} · Academic session ${ref.currentSession?.name ?? "not configured"} · ${DAYS[((new Date(`${today}T12:00:00+05:30`).getUTCDay() + 6) % 7) + 1]}, ${formatDate(today)}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {showStudents && <StatCard label="Active students" value={students?.count ?? 0} icon={<Users />} hint={`${enrolments?.data?.length ?? 0} enrolled this session`} />}
        {showAdmissions && <StatCard label="Applications pending" value={admissions?.count ?? 0} icon={<ClipboardList />} tone={(admissions?.count ?? 0) > 0 ? "warning" : "default"} hint="Submitted or under review" />}
        {showAttendance && (
          <StatCard label="Attendance (30 days)" value={attPct === null ? "—" : `${attPct}%`} icon={<CalendarCheck />}
            tone={attPct !== null && attPct < threshold ? "warning" : "success"}
            hint={`${lowAttendance} student(s) below ${threshold}%`} />
        )}
        {showFees && <StatCard label="Collected this month" value={formatINR(thisMonth)} icon={<IndianRupee />} tone="success" hint={`Outstanding ${formatINR(outstanding)} · ${overdueCount} overdue`} />}
        {isTeacher && <StatCard label="Classes today" value={todayClasses.length} icon={<CalendarCheck />} hint="From your timetable" />}
        {isTeacher && <StatCard label="Marks pending" value={pendingMarks.reduce((a, p) => a + p.missing, 0)} icon={<FilePen />} tone={pendingMarks.length ? "warning" : "success"} hint={`${pendingMarks.length} subject(s) incomplete`} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {showStudents && (
          <Card>
            <CardHeader><CardTitle>Enrolment by programme</CardTitle><CardDescription>Active students, {ref.currentSession?.name}</CardDescription></CardHeader>
            <CardContent>{enrolData.length ? <SimpleBarChart data={enrolData} ariaLabel="Bar chart of active enrolment by programme" /> : <EmptyState title="No enrolments yet" />}</CardContent>
          </Card>
        )}
        {showFees && (
          <Card>
            <CardHeader><CardTitle>Fee collection</CardTitle><CardDescription>Completed payments, last 6 months</CardDescription></CardHeader>
            <CardContent><SimpleLineChart data={months} format="inr_k" ariaLabel="Line chart of monthly fee collection" /></CardContent>
          </Card>
        )}
        {showResults && latestExam?.data && (
          <Card>
            <CardHeader>
              <CardTitle>Latest published result</CardTitle>
              <CardDescription>{latestExam.data.name} · {programmeCode(ref, latestExam.data.programme_id)} {termName(ref, latestExam.data.term_id)}</CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={resultData} ariaLabel="Bar chart of result status counts" height={220} />
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {resultData.map((r) => <span key={r.label} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: r.color }} />{r.label}: <strong className="text-foreground">{r.value}</strong></span>)}
              </div>
            </CardContent>
          </Card>
        )}
        {isTeacher && (
          <Card>
            <CardHeader><CardTitle>Today&apos;s classes</CardTitle></CardHeader>
            <CardContent>
              {todayClasses.length === 0 ? <EmptyState title="No classes scheduled today" /> : (
                <ul className="divide-y">
                  {todayClasses.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span><span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">P{c.period}</span>{c.subject}</span>
                      <span className="text-muted-foreground">{c.cls}{c.room ? ` · ${c.room}` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="outline" size="sm" className="mt-3"><Link href="/attendance">Take attendance</Link></Button>
            </CardContent>
          </Card>
        )}
        {isTeacher && pendingMarks.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-warning" /> Marks entry pending</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y">
                {pendingMarks.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>{p.exam} — {p.subject}</span>
                    <Link className="text-primary hover:underline" href={`/examinations/${p.examId}/marks/${p.id}`}>{p.missing} missing</Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle>Recent notices</CardTitle></CardHeader>
          <CardContent>
            {(notices.data ?? []).length === 0 ? <EmptyState title="No notices" /> : (
              <ul className="divide-y">
                {(notices.data ?? []).map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/notices/${n.id}`} className="truncate hover:underline">{n.is_pinned && "📌 "}{n.title}</Link>
                    <span className="flex shrink-0 items-center gap-2"><StatusBadge status={n.category} /><span className="text-xs text-muted-foreground">{formatDate(n.published_at)}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
