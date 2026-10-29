import Link from "next/link";
import type { Metadata } from "next";
import { BarChart3, Printer } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, param, programmeCode, uuidParam } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { UrlControls } from "@/components/shared/url-controls";
import { AttendanceSheet } from "@/components/attendance/attendance-sheet";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { setAttendanceLock } from "@/server/attendance-actions";
import { todayIST } from "@/lib/utils";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage({ searchParams }: PageProps<"/attendance">) {
  const session = await requirePermission("attendance.take", "attendance.view_all", "attendance.manage");
  const sp = await searchParams;
  const ref = await getReferenceData();
  const supabase = await createClient();
  const sessionId = ref.currentSession?.id;
  const seeAll = can(session, "attendance.view_all", "attendance.manage");
  const today = todayIST();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(param(sp.date) ?? "") ? param(sp.date)! : today;
  const period = Math.min(12, Math.max(1, Number(param(sp.period) ?? 1) || 1));
  const termId = uuidParam(sp.term);
  const offeringParam = param(sp.subject);

  // Offerings visible to the user in the current session
  let offQ = supabase.from("course_offerings").select("id, programme_id, term_id, subjects(code, name)").eq("academic_session_id", sessionId ?? "");
  if (!seeAll) {
    const { data: mine } = await supabase.rpc("my_offering_ids");
    offQ = offQ.in("id", ((mine ?? []) as unknown as string[]).length ? (mine as unknown as string[]) : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data: offerings } = await offQ;
  const termIds = new Set((offerings ?? []).map((o) => o.term_id));
  const termOptions = ref.terms.filter((t) => termIds.has(t.id)).map((t) => ({ value: t.id, label: `${programmeCode(ref, t.programme_id)} · ${t.name}` }));
  const term = ref.terms.find((t) => t.id === termId && termIds.has(t.id));
  const classOfferings = (offerings ?? []).filter((o) => o.term_id === term?.id);
  const subjectOptions = [
    ...(seeAll ? [{ value: "class", label: "Whole class (daily attendance)" }] : []),
    ...classOfferings.map((o) => ({ value: o.id, label: `${o.subjects?.code} — ${o.subjects?.name}` })),
  ];
  const offeringId = offeringParam === "class" ? null : classOfferings.find((o) => o.id === offeringParam)?.id;
  const ready = term && sessionId && (offeringParam === "class" ? seeAll : !!offeringId);

  let content: React.ReactNode = <EmptyState title="Select a class and subject" description="Choose the class, subject, date and period to take or view attendance." />;
  let lockControl: React.ReactNode = null;

  if (ready && term && sessionId) {
    // Roster
    let students: { student_id: string; roll_no: string | null; name: string; admission_no: string }[] = [];
    if (offeringId) {
      const { data } = await supabase.from("student_subject_enrolments")
        .select("student_enrolments!inner(student_id, roll_no, status, students(full_name, admission_no, status))")
        .eq("course_offering_id", offeringId).eq("student_enrolments.status", "active");
      students = (data ?? []).map((r) => ({ student_id: r.student_enrolments.student_id, roll_no: r.student_enrolments.roll_no, name: r.student_enrolments.students?.full_name ?? "", admission_no: r.student_enrolments.students?.admission_no ?? "" }));
    } else {
      const { data } = await supabase.from("student_enrolments").select("student_id, roll_no, students(full_name, admission_no)")
        .eq("academic_session_id", sessionId).eq("term_id", term.id).eq("status", "active");
      students = (data ?? []).map((r) => ({ student_id: r.student_id, roll_no: r.roll_no, name: r.students?.full_name ?? "", admission_no: r.students?.admission_no ?? "" }));
    }
    students.sort((a, b) => (a.roll_no ?? "zzz").localeCompare(b.roll_no ?? "zzz") || a.name.localeCompare(b.name));

    let sessQ = supabase.from("attendance_sessions").select("id, is_locked, topic, attendance_records(student_id, status_code, remarks)")
      .eq("academic_session_id", sessionId).eq("programme_id", term.programme_id).eq("term_id", term.id).eq("date", date).eq("period", period);
    sessQ = offeringId ? sessQ.eq("course_offering_id", offeringId) : sessQ.is("course_offering_id", null);
    const [{ data: existingSession }, { data: statuses }, { data: canEdit }] = await Promise.all([
      sessQ.maybeSingle(),
      supabase.from("attendance_statuses").select("code, label, counts_as_present, counts_in_total").eq("is_active", true).order("sort_order"),
      supabase.rpc("can_edit_attendance", { p_session_id: sessionId, p_programme_id: term.programme_id, p_term_id: term.id, p_offering_id: (offeringId ?? null) as unknown as string, p_date: date }),
    ]);
    const existing = Object.fromEntries((existingSession?.attendance_records ?? []).map((r) => [r.student_id, { status_code: r.status_code, remarks: r.remarks }]));
    const locked = !!existingSession?.is_locked;
    const editable = !!canEdit && date <= today && (!locked || can(session, "attendance.manage"));
    const window = ref.settings?.attendance_edit_window_days ?? 3;

    if (existingSession && can(session, "attendance.manage")) {
      lockControl = (
        <ConfirmAction
          label={locked ? "Unlock register" : "Lock register"} variant="outline" size="sm"
          title={locked ? "Unlock this register?" : "Lock this register?"}
          description={locked ? "Teachers will be able to edit it again (within the edit window)." : "Teachers will no longer be able to edit this attendance."}
          action={setAttendanceLock.bind(null, { id: existingSession.id, locked: !locked })}
          success={locked ? "Register unlocked" : "Register locked"}
        />
      );
    }
    content = students.length === 0
      ? <EmptyState title="No students enrolled" description="No active students are enrolled in this class/subject." />
      : (
        <AttendanceSheet
          key={`${term.id}-${offeringParam}-${date}-${period}`}
          context={{ academic_session_id: sessionId, programme_id: term.programme_id, term_id: term.id, course_offering_id: offeringId ?? null, date, period, topic: existingSession?.topic }}
          students={students}
          statuses={statuses ?? []}
          existing={existing}
          editable={editable}
          locked={locked}
          readOnlyReason={date > today ? "Attendance cannot be recorded for a future date." : `Teachers can record or edit attendance for today and the previous ${window} day(s) only. Contact the office for older corrections.`}
        />
      );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance"
        description={`Record attendance by class, subject, date and period · Session ${ref.currentSession?.name ?? "—"}`}
        actions={
          <>
            {lockControl}
            {term && <Button variant="outline" size="sm" asChild><Link href={`/attendance/register?term=${term.id}${offeringId ? `&subject=${offeringId}` : ""}&month=${date.slice(0, 7)}`}><Printer /> Register</Link></Button>}
            <Button variant="outline" size="sm" asChild><Link href="/attendance/reports"><BarChart3 /> Reports</Link></Button>
          </>
        }
      />
      <UrlControls
        controls={[
          { name: "term", label: "Class", type: "select", options: termOptions, resets: ["subject"] },
          { name: "subject", label: "Subject", type: "select", options: subjectOptions, width: "w-full sm:w-72" },
          { name: "date", label: "Date", type: "date", max: today, defaultValue: today, width: "w-full sm:w-44" },
          { name: "period", label: "Period", type: "number", min: "1", max: "12", defaultValue: "1", width: "w-24" },
        ]}
      />
      {content}
    </div>
  );
}
