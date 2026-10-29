import { requireStudent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/misc";
import { PrintButton } from "@/components/shared/print-button";
import { TimetableGrid } from "@/components/timetable-grid";

export const metadata = { title: "My timetable" };

export default async function MyTimetable() {
  const session = await requireStudent();
  const supabase = await createClient();
  const { data: e } = await supabase.from("student_enrolments").select("academic_session_id, term_id, section, student_subject_enrolments(course_offering_id)").eq("student_id", session.studentId).eq("status", "active").maybeSingle();
  if (!e) return <EmptyState title="No active enrolment" />;
  const mine = new Set(e.student_subject_enrolments.map((s) => s.course_offering_id));
  const [{ data: periods }, { data: entries }, { data: staff }] = await Promise.all([
    supabase.from("timetable_periods").select("*").order("period_no"),
    supabase.from("timetable_entries").select("id, day_of_week, period_no, room, staff_id, course_offering_id, course_offerings(subjects(code, name))").eq("academic_session_id", e.academic_session_id).eq("term_id", e.term_id),
    supabase.rpc("staff_directory"),
  ]);
  const name = new Map((staff ?? []).map((s) => [s.id, s.full_name]));
  const list = (entries ?? []).filter((x) => mine.has(x.course_offering_id)).map((x) => ({
    id: x.id, day_of_week: x.day_of_week, period_no: x.period_no, room: x.room,
    subject: `${x.course_offerings?.subjects?.code} ${x.course_offerings?.subjects?.name}`, detail: x.staff_id ? name.get(x.staff_id) ?? "" : "",
  }));
  return (
    <div className="space-y-5">
      <PageHeader title="My timetable" description="Showing periods for your subjects." actions={<PrintButton />} />
      {list.length === 0 ? <EmptyState title="Timetable not published yet" /> : <TimetableGrid periods={periods ?? []} entries={list} />}
    </div>
  );
}
