import type { Metadata } from "next";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RecordDialog, type FieldConfig } from "@/components/shared/record-dialog";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { StatusBadge } from "@/components/shared/status-badge";
import { asRecordAction } from "@/lib/record-action";
import { saveDepartment, saveProgramme, saveSession, setCurrentSession, renameTerm } from "@/server/academics-actions";
import { formatDate, titleCase } from "@/lib/utils";

export const metadata: Metadata = { title: "Academic programmes" };

const LEVELS = [
  { value: "higher_secondary", label: "Higher Secondary" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "postgraduate", label: "Postgraduate" },
];

export default async function AcademicsPage() {
  const session = await requirePermission("academics.view");
  const manage = can(session, "academics.manage");
  const ref = await getReferenceData();
  const supabase = await createClient();
  const [{ data: departments }, { data: schemes }] = await Promise.all([
    supabase.from("departments").select("*").order("name"),
    supabase.from("grading_schemes").select("id, name").eq("is_active", true).order("name"),
  ]);

  const sessionFields: FieldConfig[] = [
    { name: "name", label: "Name", required: true, placeholder: "2027-28" },
    { name: "start_date", label: "Start date", type: "date", required: true },
    { name: "end_date", label: "End date", type: "date", required: true },
    { name: "status", label: "Status", type: "select", required: true, options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive (closed)" }] },
  ];
  const programmeFields: FieldConfig[] = [
    { name: "code", label: "Code", required: true, placeholder: "FYUP-BCOM" },
    { name: "name", label: "Name", required: true },
    { name: "level", label: "Level", type: "select", required: true, options: LEVELS },
    { name: "stream", label: "Stream", placeholder: "Arts / Science / Commerce" },
    { name: "term_kind", label: "Structure", type: "select", required: true, options: [{ value: "class", label: "Classes (XI, XII)" }, { value: "semester", label: "Semesters" }] },
    { name: "total_terms", label: "Number of classes/semesters", type: "number", required: true },
    { name: "awarding_body", label: "Awarding body", placeholder: "COHSEM / Manipur University" },
    { name: "grading_scheme_id", label: "Default grading scheme", type: "select", options: (schemes ?? []).map((s) => ({ value: s.id, label: s.name })) },
    { name: "department_id", label: "Department", type: "select", options: (departments ?? []).map((d) => ({ value: d.id, label: d.name })) },
    { name: "is_active", label: "Active", type: "checkbox", full: true },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Academic Programmes" description="Academic sessions, programmes, classes/semesters and departments." />
      <Tabs defaultValue="programmes">
        <TabsList>
          <TabsTrigger value="programmes">Programmes</TabsTrigger>
          <TabsTrigger value="sessions">Academic sessions</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
        </TabsList>

        <TabsContent value="programmes" className="space-y-4">
          {manage && <div className="flex justify-end"><RecordDialog title="New programme" fields={programmeFields} initial={{ term_kind: "semester", total_terms: "8", level: "undergraduate", is_active: true }} action={asRecordAction(saveProgramme)} wide /></div>}
          <div className="grid gap-4 lg:grid-cols-2">
            {ref.programmes.map((p) => (
              <Card key={p.id}>
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">{p.name} {!p.is_active && <Badge variant="muted">Inactive</Badge>}</CardTitle>
                    <CardDescription>{p.code} · {titleCase(p.level)}{p.stream ? ` · ${p.stream}` : ""} · {p.total_terms} {p.term_kind === "class" ? "classes" : "semesters"}</CardDescription>
                    <CardDescription>Grading: {(schemes ?? []).find((s) => s.id === p.grading_scheme_id)?.name ?? <span className="text-warning-foreground dark:text-warning">not configured</span>}</CardDescription>
                  </div>
                  {manage && (
                    <RecordDialog mode="edit" title={`Edit ${p.code}`} fields={programmeFields} wide action={asRecordAction(saveProgramme)}
                      initial={{ id: p.id, code: p.code, name: p.name, level: p.level, stream: p.stream ?? "", term_kind: p.term_kind, total_terms: String(p.total_terms), grading_scheme_id: p.grading_scheme_id ?? "", is_active: p.is_active, awarding_body: p.awarding_body ?? "", department_id: p.department_id ?? "" }} />
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {ref.terms.filter((t) => t.programme_id === p.id).map((t) => (
                      <span key={t.id} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
                        {t.name}
                        {manage && <RecordDialog mode="edit" title="Rename class/semester" fields={[{ name: "name", label: "Name", required: true }]} initial={{ id: t.id, name: t.name }} action={asRecordAction(renameTerm)} />}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          {manage && <div className="flex justify-end"><RecordDialog title="New academic session" fields={sessionFields} initial={{ status: "active" }} action={asRecordAction(saveSession)} /></div>}
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Session</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {ref.sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name} {s.is_current && <Badge className="ml-1">Current</Badge>}</TableCell>
                    <TableCell>{formatDate(s.start_date)}</TableCell>
                    <TableCell>{formatDate(s.end_date)}</TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                    <TableCell className="text-right">
                      {manage && (
                        <div className="flex justify-end gap-1">
                          {!s.is_current && (
                            <ConfirmAction label="Make current" size="sm" variant="outline" title={`Make ${s.name} the current session?`}
                              description="Dashboards, attendance and new records will default to this session." action={setCurrentSession.bind(null, { id: s.id })} success="Current session changed" />
                          )}
                          <RecordDialog mode="edit" title={`Edit ${s.name}`} fields={sessionFields} initial={{ id: s.id, name: s.name, start_date: s.start_date, end_date: s.end_date, status: s.status }} action={asRecordAction(saveSession)} />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="space-y-4">
          {manage && <div className="flex justify-end"><RecordDialog title="New department" fields={[{ name: "code", label: "Code", required: true }, { name: "name", label: "Name", required: true }]} action={asRecordAction(saveDepartment)} /></div>}
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Department</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {(departments ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.code}</TableCell>
                    <TableCell>{d.name}</TableCell>
                    <TableCell className="text-right">{manage && <RecordDialog mode="edit" title="Edit department" fields={[{ name: "code", label: "Code", required: true }, { name: "name", label: "Name", required: true }]} initial={{ id: d.id, code: d.code, name: d.name }} action={asRecordAction(saveDepartment)} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
