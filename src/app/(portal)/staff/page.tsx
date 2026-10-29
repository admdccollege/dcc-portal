import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { param, uuidParam } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/shared/filter-bar";
import { UrlControls } from "@/components/shared/url-controls";
import { StatusBadge } from "@/components/shared/status-badge";
import { RecordDialog } from "@/components/shared/record-dialog";
import { StaffAttendanceForm } from "@/components/staff-attendance";
import { staffFields } from "@/components/staff-fields";
import { asRecordAction } from "@/lib/record-action";
import { saveStaff } from "@/server/staff-actions";
import { searchFilter, todayIST } from "@/lib/utils";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage({ searchParams }: PageProps<"/staff">) {
  const session = await requirePermission("staff.view");
  const sp = await searchParams;
  const supabase = await createClient();
  const dept = uuidParam(sp.department);
  const status = param(sp.status);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(param(sp.date) ?? "") ? param(sp.date)! : todayIST();

  let q = supabase.from("staff").select("id, employee_id, full_name, designation, email, phone, status, is_teaching, profile_id, departments(name), teacher_assignments(count)").order("full_name");
  if (dept) q = q.eq("department_id", dept);
  if (status && ["active", "on_leave", "resigned", "retired"].includes(status)) q = q.eq("status", status as "active");
  const search = searchFilter(["full_name", "employee_id", "designation", "email"], param(sp.q));
  if (search) q = q.or(search);
  const [{ data: staff }, { data: departments }, { data: att }] = await Promise.all([
    q,
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("staff_attendance").select("staff_id, status").eq("date", date),
  ]);
  const active = (staff ?? []).filter((s) => s.status === "active");

  return (
    <div className="space-y-5">
      <PageHeader title="Staff Management" description="Staff directory, allocation and attendance"
        actions={can(session, "staff.manage") && <RecordDialog title="New staff member" wide fields={staffFields(departments ?? [], can(session, "staff.view_confidential"))} action={asRecordAction(saveStaff)} initial={{ status: "active", is_teaching: true }} success="Staff member added" />} />
      <Tabs defaultValue={param(sp.tab) === "attendance" ? "attendance" : "directory"}>
        <TabsList><TabsTrigger value="directory">Directory</TabsTrigger>{can(session, "staff.manage") && <TabsTrigger value="attendance">Staff attendance</TabsTrigger>}</TabsList>
        <TabsContent value="directory" className="space-y-4">
          <FilterBar searchPlaceholder="Name, employee ID, designation…" filters={[
            { name: "department", label: "Departments", options: (departments ?? []).map((d) => ({ value: d.id, label: d.name })) },
            { name: "status", label: "Statuses", options: [{ value: "active", label: "Active" }, { value: "on_leave", label: "On leave" }, { value: "resigned", label: "Resigned" }, { value: "retired", label: "Retired" }] },
          ]} />
          <Card>
            {!staff?.length ? <div className="p-6"><EmptyState title="No staff found" /></div> : (
              <Table>
                <TableHeader><TableRow><TableHead>Employee ID</TableHead><TableHead>Name</TableHead><TableHead>Designation</TableHead><TableHead>Department</TableHead><TableHead className="hidden md:table-cell">Contact</TableHead><TableHead className="text-right">Subjects</TableHead><TableHead>Account</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {staff.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.employee_id}</TableCell>
                      <TableCell><Link href={`/staff/${s.id}`} className="font-medium text-primary hover:underline">{s.full_name}</Link>{s.is_teaching && <Badge variant="secondary" className="ml-1">Teaching</Badge>}</TableCell>
                      <TableCell>{s.designation}</TableCell>
                      <TableCell>{s.departments?.name ?? "—"}</TableCell>
                      <TableCell className="hidden text-xs md:table-cell">{s.email}<br />{s.phone}</TableCell>
                      <TableCell className="text-right tabular-nums">{(s.teacher_assignments as unknown as { count: number }[])[0]?.count ?? 0}</TableCell>
                      <TableCell>{s.profile_id ? <Badge variant="success">Active</Badge> : <Badge variant="muted">None</Badge>}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
        {can(session, "staff.manage") && (
          <TabsContent value="attendance" className="space-y-4">
            <UrlControls controls={[{ name: "date", label: "Date", type: "date", defaultValue: date, max: todayIST(), width: "w-44" }]} />
            <Card>
              <CardHeader><CardTitle>Staff attendance</CardTitle></CardHeader>
              <CardContent>
                <StaffAttendanceForm key={date} date={date} staff={active.map((s) => ({ id: s.id, name: s.full_name, designation: s.designation }))} existing={Object.fromEntries((att ?? []).map((a) => [a.staff_id, a.status]))} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
