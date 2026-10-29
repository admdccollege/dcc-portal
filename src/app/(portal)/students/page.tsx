import Link from "next/link";
import type { Metadata } from "next";
import { Download, Plus, Upload, ArrowUpRight } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, param, programmeCode, termName, uuidParam, sessionOptions, programmeOptions } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { Pagination, pageRange, parsePage } from "@/components/shared/pagination";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/shared/status-badge";
import { searchFilter } from "@/lib/utils";

export const metadata: Metadata = { title: "Students" };

const STATUSES = ["active", "withdrawn", "transferred", "graduated", "suspended", "archived"];

export default async function StudentsPage({ searchParams }: PageProps<"/students">) {
  const session = await requirePermission("students.view", "attendance.take");
  const sp = await searchParams;
  const ref = await getReferenceData();
  const supabase = await createClient();

  const sessionId = uuidParam(sp.session) ?? ref.currentSession?.id;
  const programmeId = uuidParam(sp.programme);
  const termId = uuidParam(sp.term);
  const status = STATUSES.includes(param(sp.status) ?? "") ? param(sp.status) : undefined;
  const page = parsePage(sp.page);
  const [from, to] = pageRange(page);

  let q = supabase
    .from("student_enrolments")
    .select("id, roll_no, section, status, programme_id, term_id, students!inner(id, admission_no, full_name, phone, status, gender)", { count: "exact" })
    .order("programme_id")
    .order("term_id")
    .order("roll_no", { nullsFirst: false })
    .range(from, to);
  if (sessionId) q = q.eq("academic_session_id", sessionId);
  if (programmeId) q = q.eq("programme_id", programmeId);
  if (termId) q = q.eq("term_id", termId);
  if (status) q = q.eq("students.status", status as "active");
  const search = searchFilter(["full_name", "admission_no", "university_roll_no", "phone"], param(sp.q));
  if (search) q = q.or(search, { referencedTable: "students" });
  const { data: rows, count, error } = await q;

  const termOpts = ref.terms
    .filter((t) => !programmeId || t.programme_id === programmeId)
    .map((t) => ({ value: t.id, label: `${programmeCode(ref, t.programme_id)} · ${t.name}` }));
  const exportQs = new URLSearchParams(Object.entries({ session: sessionId, programme: programmeId, term: termId, status, q: param(sp.q) }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Student Management"
        description={can(session, "students.view") ? "All student records and enrolments" : "Students in your assigned classes"}
        actions={
          <>
            {can(session, "students.export") && (
              <>
                <Button variant="outline" size="sm" asChild><a href={`/api/export/students?format=csv&${exportQs}`}><Download /> CSV</a></Button>
                <Button variant="outline" size="sm" asChild><a href={`/api/export/students?format=xlsx&${exportQs}`}><Download /> Excel</a></Button>
              </>
            )}
            {can(session, "students.promote") && <Button variant="outline" size="sm" asChild><Link href="/students/promote"><ArrowUpRight /> Promote</Link></Button>}
            {can(session, "students.import") && <Button variant="outline" size="sm" asChild><Link href="/students/import"><Upload /> Import</Link></Button>}
            {can(session, "students.manage") && <Button size="sm" asChild><Link href="/students/new"><Plus /> New student</Link></Button>}
          </>
        }
      />
      <FilterBar
        searchPlaceholder="Name, admission no, phone…"
        filters={[
          { name: "session", label: "Session", options: sessionOptions(ref), allLabel: "Current session" },
          { name: "programme", label: "Programmes", options: programmeOptions(ref) },
          { name: "term", label: "Classes", options: termOpts },
          { name: "status", label: "Statuses", options: STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) })) },
        ]}
      />
      <Card>
        {error ? (
          <div className="p-6"><EmptyState title="Could not load students" description="Please refresh the page." /></div>
        ) : !rows?.length ? (
          <div className="p-6"><EmptyState title="No students found" description="Try changing the filters or search term." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admission no.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Roll</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.students.admission_no}</TableCell>
                  <TableCell>
                    <Link href={`/students/${r.students.id}`} className="font-medium text-primary hover:underline">{r.students.full_name}</Link>
                  </TableCell>
                  <TableCell>{programmeCode(ref, r.programme_id)} · {termName(ref, r.term_id)}</TableCell>
                  <TableCell className="tabular-nums">{r.roll_no ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{r.students.phone ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={r.students.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Pagination page={page} total={count ?? 0} basePath="/students" params={sp} />
    </div>
  );
}
