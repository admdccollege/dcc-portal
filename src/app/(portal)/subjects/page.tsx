import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, param, programmeCode, uuidParam } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { FilterBar } from "@/components/shared/filter-bar";
import { RecordDialog, type FieldConfig } from "@/components/shared/record-dialog";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { AssignTeacher, AssignmentChip } from "@/components/academics/assign-teacher";
import { asRecordAction } from "@/lib/record-action";
import { copyOfferings, deleteOffering, saveCategory, saveOffering, saveSubject } from "@/server/academics-actions";
import { searchFilter, titleCase } from "@/lib/utils";

export const metadata: Metadata = { title: "Subjects & courses" };

const LEVELS = [
  { value: "higher_secondary", label: "Higher Secondary" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "postgraduate", label: "Postgraduate" },
];

export default async function SubjectsPage({ searchParams }: PageProps<"/subjects">) {
  const session = await requirePermission("academics.view");
  const manage = can(session, "academics.manage");
  const assign = can(session, "academics.manage", "staff.manage");
  const sp = await searchParams;
  const ref = await getReferenceData();
  const supabase = await createClient();
  const level = LEVELS.find((l) => l.value === param(sp.level))?.value;
  const sessionId = uuidParam(sp.session) ?? ref.currentSession?.id;
  const termId = uuidParam(sp.term);
  const term = ref.terms.find((t) => t.id === termId);
  const programme = ref.programmes.find((p) => p.id === term?.programme_id);

  let subjQ = supabase.from("subjects").select("*, departments(name)").order("level").order("code");
  if (level) subjQ = subjQ.eq("level", level as "undergraduate");
  const search = searchFilter(["code", "name"], param(sp.q));
  if (search) subjQ = subjQ.or(search);

  const [{ data: subjects }, { data: departments }, { data: categories }, { data: staff }, offerings] = await Promise.all([
    subjQ,
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("course_categories").select("*").order("level").order("sort_order"),
    assign ? supabase.rpc("staff_directory") : { data: [] },
    termId && sessionId
      ? supabase.from("course_offerings").select("*, subjects(code, name, credits), course_categories(name), teacher_assignments(id, role, staff_id), student_subject_enrolments(count)")
          .eq("academic_session_id", sessionId).eq("term_id", termId).order("is_compulsory", { ascending: false })
      : { data: null },
  ]);
  const staffById = new Map((staff ?? []).map((s) => [s.id, s.full_name]));
  const teachingStaff = (staff ?? []).filter((s) => s.is_teaching).map((s) => ({ id: s.id, name: s.full_name }));

  const subjectFields: FieldConfig[] = [
    { name: "code", label: "Paper code", required: true },
    { name: "name", label: "Subject name", required: true },
    { name: "level", label: "Level", type: "select", required: true, options: LEVELS },
    { name: "department_id", label: "Department", type: "select", options: (departments ?? []).map((d) => ({ value: d.id, label: d.name })) },
    { name: "credits", label: "Credits", type: "number", step: "0.5" },
    { name: "has_practical", label: "Has practical component", type: "checkbox" },
    { name: "is_active", label: "Active", type: "checkbox" },
  ];
  const levelForClass = programme?.level;
  const offeringFields: FieldConfig[] = [
    { name: "subject_id", label: "Subject", type: "select", required: true, options: (subjects ?? []).filter((s) => !levelForClass || s.level === levelForClass).map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` })) },
    { name: "category_id", label: "Category", type: "select", options: (categories ?? []).filter((c) => !levelForClass || c.level === levelForClass).map((c) => ({ value: c.id, label: c.name })) },
    { name: "credits", label: "Credits (override)", type: "number", step: "0.5" },
    { name: "is_compulsory", label: "Compulsory for all students in the class", type: "checkbox" },
  ];
  const categoryFields: FieldConfig[] = [
    { name: "code", label: "Code", required: true }, { name: "name", label: "Name", required: true },
    { name: "level", label: "Level", type: "select", required: true, options: LEVELS }, { name: "sort_order", label: "Sort order", type: "number" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Subjects & Courses" description="Subject catalogue (paper codes), course offerings per class and teacher allocation." />
      <Tabs defaultValue={termId ? "offerings" : "subjects"}>
        <TabsList>
          <TabsTrigger value="subjects">Subject catalogue</TabsTrigger>
          <TabsTrigger value="offerings">Course offerings</TabsTrigger>
          <TabsTrigger value="categories">Course categories</TabsTrigger>
        </TabsList>

        <TabsContent value="subjects" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <FilterBar searchPlaceholder="Code or name…" filters={[{ name: "level", label: "Levels", options: LEVELS }]} />
            {manage && <RecordDialog title="New subject" fields={subjectFields} initial={{ level: level ?? "undergraduate", is_active: true }} action={asRecordAction(saveSubject)} />}
          </div>
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Subject</TableHead><TableHead>Level</TableHead><TableHead>Department</TableHead><TableHead>Credits</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {(subjects ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.code}</TableCell>
                    <TableCell>{s.name} {s.has_practical && <Badge variant="secondary">Practical</Badge>} {!s.is_active && <Badge variant="muted">Inactive</Badge>}</TableCell>
                    <TableCell>{titleCase(s.level)}</TableCell>
                    <TableCell>{s.departments?.name ?? "—"}</TableCell>
                    <TableCell>{s.credits ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {manage && <RecordDialog mode="edit" title={`Edit ${s.code}`} fields={subjectFields} action={asRecordAction(saveSubject)}
                        initial={{ id: s.id, code: s.code, name: s.name, level: s.level, department_id: s.department_id ?? "", credits: s.credits?.toString() ?? "", has_practical: s.has_practical, is_active: s.is_active }} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="offerings" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <FilterBar showSearch={false} filters={[
              { name: "session", label: "Session", options: ref.sessions.map((s) => ({ value: s.id, label: s.name })), allLabel: "Current session" },
              { name: "term", label: "Class", options: ref.terms.map((t) => ({ value: t.id, label: `${programmeCode(ref, t.programme_id)} · ${t.name}` })), allLabel: "Select class" },
            ]} />
            <div className="flex gap-2">
              {manage && sessionId && (
                <RecordDialog title="Copy offerings from another session" triggerLabel="Copy from session" triggerVariant="outline"
                  description="Copies every subject offering (with category and compulsory flag) into the selected session. Existing offerings are kept."
                  fields={[
                    { name: "from_session_id", label: "From session", type: "select", required: true, options: ref.sessions.map((s) => ({ value: s.id, label: s.name })) },
                    { name: "to_session_id", label: "To session", type: "select", required: true, options: ref.sessions.map((s) => ({ value: s.id, label: s.name })) },
                  ]} initial={{ to_session_id: sessionId }} action={asRecordAction(copyOfferings)} success="Offerings copied" />
              )}
              {manage && term && programme && sessionId && (
                <RecordDialog title={`Add subject to ${programme.code} ${term.name}`} triggerLabel="Add offering" fields={offeringFields}
                  initial={{ academic_session_id: sessionId, programme_id: programme.id, term_id: term.id, is_compulsory: false }} action={asRecordAction(saveOffering)} />
              )}
            </div>
          </div>
          {!termId ? <EmptyState title="Select a class" description="Choose a class/semester to see and manage its subjects." /> : (
            <Card>
              <CardHeader><CardTitle>{programme?.name} · {term?.name}</CardTitle><CardDescription>{offerings.data?.length ?? 0} subject(s)</CardDescription></CardHeader>
              {!offerings.data?.length ? <div className="p-5 pt-0"><EmptyState title="No subjects offered yet" /></div> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Category</TableHead><TableHead>Type</TableHead><TableHead>Credits</TableHead><TableHead>Enrolled</TableHead><TableHead>Teachers</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {offerings.data.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell><span className="font-mono text-xs text-muted-foreground">{o.subjects?.code}</span> {o.subjects?.name}</TableCell>
                        <TableCell>{o.course_categories?.name ?? "—"}</TableCell>
                        <TableCell>{o.is_compulsory ? <Badge>Compulsory</Badge> : <Badge variant="secondary">Optional</Badge>}</TableCell>
                        <TableCell>{o.credits ?? o.subjects?.credits ?? "—"}</TableCell>
                        <TableCell className="tabular-nums">{(o.student_subject_enrolments as unknown as { count: number }[])[0]?.count ?? 0}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            {o.teacher_assignments.map((a) => <AssignmentChip key={a.id} id={a.id} role={a.role} name={staffById.get(a.staff_id) ?? "Staff"} canRemove={assign} />)}
                            {assign && <AssignTeacher offeringId={o.id} label={o.subjects?.name ?? "subject"} staff={teachingStaff} />}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {manage && (
                            <div className="flex justify-end">
                              <RecordDialog mode="edit" title="Edit offering" fields={offeringFields.slice(1)} action={asRecordAction(saveOffering)}
                                initial={{ id: o.id, academic_session_id: o.academic_session_id, programme_id: o.programme_id, term_id: o.term_id, subject_id: o.subject_id, category_id: o.category_id ?? "", credits: o.credits?.toString() ?? "", is_compulsory: o.is_compulsory }} />
                              <ConfirmAction label="" icon={<Trash2 />} size="icon" variant="ghost" title="Remove this subject offering?" description="Only possible when no students, attendance or examinations are linked." confirmLabel="Remove" action={deleteOffering.bind(null, { id: o.id })} success="Offering removed" />
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          {manage && <div className="flex justify-end"><RecordDialog title="New category" fields={categoryFields} initial={{ level: "undergraduate", sort_order: "0" }} action={asRecordAction(saveCategory)} /></div>}
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Level</TableHead><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {(categories ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{titleCase(c.level)}</TableCell>
                    <TableCell className="font-mono text-xs">{c.code}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="text-right">{manage && <RecordDialog mode="edit" title="Edit category" fields={categoryFields} action={asRecordAction(saveCategory)} initial={{ id: c.id, code: c.code, name: c.name, level: c.level, sort_order: String(c.sort_order) }} />}</TableCell>
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
