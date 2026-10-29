import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, programmeCode, termName, UUID_RE } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/shared/status-badge";
import { RecordDialog } from "@/components/shared/record-dialog";
import { StaffAccountDialog } from "@/components/staff-account";
import { staffFields } from "@/components/staff-fields";
import { asRecordAction } from "@/lib/record-action";
import { saveStaff } from "@/server/staff-actions";
import { daysAgoIST, formatDate, titleCase } from "@/lib/utils";

export const metadata = { title: "Staff profile" };
const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function StaffProfilePage({ params }: PageProps<"/staff/[id]">) {
  const session = await requirePermission("staff.view");
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createClient();
  const ref = await getReferenceData();
  const { data: s } = await supabase.from("staff").select("*, departments(name)").eq("id", id).maybeSingle();
  if (!s) notFound();
  const confidential = can(session, "staff.view_confidential");
  const [{ data: assignments }, { data: tt }, { data: departments }, { data: att }] = await Promise.all([
    supabase.from("teacher_assignments").select("id, role, course_offerings(academic_session_id, programme_id, term_id, subjects(code, name))").eq("staff_id", id),
    supabase.from("timetable_entries").select("day_of_week, period_no, room, programme_id, term_id, course_offerings(subjects(code))").eq("staff_id", id).eq("academic_session_id", ref.currentSession?.id ?? "").order("day_of_week").order("period_no"),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("staff_attendance").select("status").eq("staff_id", id).gte("date", daysAgoIST(30)),
  ]);
  const current = (assignments ?? []).filter((a) => a.course_offerings?.academic_session_id === ref.currentSession?.id);
  const present = (att ?? []).filter((a) => a.status === "present" || a.status === "duty").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title={s.full_name}
        description={<span className="flex items-center gap-2"><span className="font-mono">{s.employee_id}</span> · {s.designation} · {s.departments?.name ?? "—"} <StatusBadge status={s.status} /></span>}
        breadcrumbs={[{ label: "Staff", href: "/staff" }, { label: s.full_name }]}
        actions={
          <>
            {can(session, "users.manage") && !s.profile_id && <StaffAccountDialog staffId={id} defaultEmail={s.email} />}
            {can(session, "staff.manage") && (
              <RecordDialog mode="edit" triggerLabel="Edit" triggerVariant="default" triggerSize="sm" title="Edit staff member" wide fields={staffFields(departments ?? [], confidential)} action={asRecordAction(saveStaff)}
                initial={{ id, full_name: s.full_name, employee_id: s.employee_id, designation: s.designation, department_id: s.department_id ?? "", status: s.status, email: s.email ?? "", phone: s.phone ?? "", date_of_joining: s.date_of_joining ?? "", is_teaching: s.is_teaching,
                  ...(confidential ? { date_of_birth: s.date_of_birth ?? "", qualification: s.qualification ?? "", address: s.address ?? "" } : {}) }} />
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Email</dt><dd>{s.email ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Phone</dt><dd>{s.phone ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Date of joining</dt><dd>{formatDate(s.date_of_joining)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Login account</dt><dd>{s.profile_id ? "Active" : "Not created"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Attendance (30 days)</dt><dd>{(att ?? []).length ? `${present} of ${(att ?? []).length} days present/on duty` : "Not recorded"}</dd></div>
              {confidential ? (
                <>
                  <div><dt className="text-xs text-muted-foreground">Date of birth</dt><dd>{formatDate(s.date_of_birth)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Qualification</dt><dd>{s.qualification ?? "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Address</dt><dd>{s.address ?? "—"}</dd></div>
                </>
              ) : <p className="text-xs text-muted-foreground">Confidential details are hidden for your role.</p>}
            </dl>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Subject allocation ({ref.currentSession?.name})</CardTitle></CardHeader>
          {current.length === 0 ? <CardContent><EmptyState title="No subjects allocated" description="Allocate subjects from Subjects & Courses › Course offerings." /></CardContent> : (
            <Table>
              <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Class</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
              <TableBody>
                {current.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell><span className="font-mono text-xs text-muted-foreground">{a.course_offerings?.subjects?.code}</span> {a.course_offerings?.subjects?.name}</TableCell>
                    <TableCell>{programmeCode(ref, a.course_offerings?.programme_id)} · {termName(ref, a.course_offerings?.term_id)}</TableCell>
                    <TableCell>{titleCase(a.role)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Weekly timetable</CardTitle></CardHeader>
          <CardContent>
            {(tt ?? []).length === 0 ? <EmptyState title="No timetable entries" /> : (
              <div className="flex flex-wrap gap-2">
                {(tt ?? []).map((t, i) => <span key={i} className="rounded-md border px-2 py-1 text-xs">{DAYS[t.day_of_week]} P{t.period_no} · {t.course_offerings?.subjects?.code} · {programmeCode(ref, t.programme_id)} {termName(ref, t.term_id)}{t.room ? ` · ${t.room}` : ""}</span>)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
