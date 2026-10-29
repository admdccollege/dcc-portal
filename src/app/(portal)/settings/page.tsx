import Link from "next/link";
import type { Metadata } from "next";
import { ScrollText, Trash2 } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { RecordDialog, type FieldConfig } from "@/components/shared/record-dialog";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { asRecordAction } from "@/lib/record-action";
import { deleteGradingRule, saveExamType, saveGradingRule, saveGradingScheme, saveInstitution } from "@/server/settings-actions";
import { saveAttendanceStatus } from "@/server/attendance-actions";
import { titleCase } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

const schemeFields: FieldConfig[] = [
  { name: "name", label: "Name", required: true, full: true },
  { name: "level", label: "Level", type: "select", options: [{ value: "higher_secondary", label: "Higher Secondary" }, { value: "undergraduate", label: "Undergraduate" }, { value: "postgraduate", label: "Postgraduate" }] },
  { name: "decimals", label: "Decimal places", type: "number" },
  { name: "subject_pass_percent", label: "Subject pass %", type: "number", hint: "Blank = use sum of component pass marks" },
  { name: "aggregate_pass_percent", label: "Aggregate pass %", type: "number", hint: "Blank = no aggregate requirement" },
  { name: "max_failed_subjects_for_compartment", label: "Max failed subjects for compartment", type: "number", hint: "0 = no compartment result" },
  { name: "require_component_pass", label: "Each component (theory/practical) must be passed", type: "checkbox", full: true },
  { name: "require_all_subjects_pass", label: "All subjects must be passed for an overall pass", type: "checkbox", full: true },
  { name: "use_grade_points", label: "Use grade points", type: "checkbox" },
  { name: "use_credits", label: "Credit-weighted (SGPA)", type: "checkbox" },
  { name: "is_active", label: "Active", type: "checkbox" },
  { name: "description", label: "Description / regulation reference", type: "textarea", full: true },
];
const ruleFields: FieldConfig[] = [
  { name: "grade", label: "Grade", required: true }, { name: "min_percent", label: "Minimum %", type: "number", required: true, step: "0.01" },
  { name: "grade_point", label: "Grade point", type: "number", step: "0.01" }, { name: "description", label: "Description" },
  { name: "is_pass", label: "Passing grade", type: "checkbox" },
];

export default async function SettingsPage() {
  const session = await requirePermission("settings.manage", "audit.view", "academics.manage", "grading.manage");
  const supabase = await createClient();
  const [{ data: inst }, { data: schemes }, { data: statuses }, { data: types }] = await Promise.all([
    supabase.from("institution_settings").select("*").single(),
    supabase.from("grading_schemes").select("*, grading_rules(*)").order("name"),
    supabase.from("attendance_statuses").select("*").order("sort_order"),
    supabase.from("examination_types").select("*").order("sort_order"),
  ]);
  const tab = can(session, "settings.manage") ? "institution" : can(session, "grading.manage") ? "grading" : "attendance";

  return (
    <div className="space-y-5">
      <PageHeader title="Settings & Audit Logs" description="Institution configuration, grading schemes, attendance statuses and examination types"
        actions={can(session, "audit.view") && <Button size="sm" variant="outline" asChild><Link href="/settings/audit"><ScrollText /> Audit logs</Link></Button>} />
      <Tabs defaultValue={tab}>
        <TabsList>
          {can(session, "settings.manage") && <TabsTrigger value="institution">Institution</TabsTrigger>}
          <TabsTrigger value="grading">Grading schemes</TabsTrigger>
          <TabsTrigger value="attendance">Attendance statuses</TabsTrigger>
          <TabsTrigger value="exams">Examination types</TabsTrigger>
          <TabsTrigger value="data">Data & privacy</TabsTrigger>
        </TabsList>

        {can(session, "settings.manage") && inst && (
          <TabsContent value="institution">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle>{inst.name}</CardTitle><CardDescription>{inst.address}</CardDescription></div>
                <RecordDialog mode="edit" triggerLabel="Edit settings" triggerVariant="default" triggerSize="sm" title="Institution settings" wide action={asRecordAction(saveInstitution)}
                  initial={{ name: inst.name, short_name: inst.short_name, address: inst.address, phone: inst.phone ?? "", email: inst.email ?? "", website: inst.website ?? "", attendance_threshold: String(inst.attendance_threshold), attendance_edit_window_days: String(inst.attendance_edit_window_days), admission_no_prefix: inst.admission_no_prefix, application_no_prefix: inst.application_no_prefix, receipt_no_prefix: inst.receipt_no_prefix, financial_year_start_month: String(inst.financial_year_start_month), marksheet_footer_note: inst.marksheet_footer_note }}
                  fields={[
                    { name: "name", label: "Institution name", required: true, full: true }, { name: "short_name", label: "Short name", required: true },
                    { name: "phone", label: "Phone" }, { name: "address", label: "Address", required: true, full: true }, { name: "email", label: "Email", type: "email" }, { name: "website", label: "Website" },
                    { name: "attendance_threshold", label: "Minimum attendance %", type: "number", required: true },
                    { name: "attendance_edit_window_days", label: "Teacher attendance edit window (days)", type: "number", required: true },
                    { name: "admission_no_prefix", label: "Admission no. prefix", required: true }, { name: "application_no_prefix", label: "Application no. prefix", required: true },
                    { name: "receipt_no_prefix", label: "Receipt no. prefix", required: true }, { name: "financial_year_start_month", label: "Financial year starts (month 1–12)", type: "number", required: true },
                    { name: "marksheet_footer_note", label: "Marksheet disclaimer", type: "textarea", required: true, full: true },
                  ]} />
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 text-sm sm:grid-cols-3">
                  <div><dt className="text-xs text-muted-foreground">Attendance threshold</dt><dd>{inst.attendance_threshold}%</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Edit window</dt><dd>{inst.attendance_edit_window_days} day(s)</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Numbering</dt><dd>{inst.admission_no_prefix}/YYYY/NNNN · {inst.receipt_no_prefix}/FY/NNNNNN</dd></div>
                  <div className="sm:col-span-3"><dt className="text-xs text-muted-foreground">Marksheet disclaimer</dt><dd>{inst.marksheet_footer_note}</dd></div>
                </dl>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="grading" className="space-y-4">
          <Alert variant="warning" title="Verify against official regulations">Grading rules are fully configurable. Do not rely on the sample schemes — configure and verify the applicable COHSEM and Manipur University regulations before processing official results.</Alert>
          {can(session, "grading.manage") && <div className="flex justify-end"><RecordDialog title="New grading scheme" wide fields={schemeFields} action={asRecordAction(saveGradingScheme)} initial={{ decimals: "2", require_component_pass: true, require_all_subjects_pass: true, is_active: true, max_failed_subjects_for_compartment: "0" }} /></div>}
          {(schemes ?? []).map((sc) => (
            <Card key={sc.id}>
              <CardHeader className="flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">{sc.name} {!sc.is_active && <Badge variant="muted">Inactive</Badge>}</CardTitle>
                  <CardDescription>
                    Subject pass {sc.subject_pass_percent ?? "Σ component pass marks"}{sc.subject_pass_percent !== null && "%"} · Aggregate {sc.aggregate_pass_percent ?? "—"}{sc.aggregate_pass_percent !== null && "%"} ·
                    {sc.require_component_pass ? " component pass required" : " no component pass"} · compartment ≤ {sc.max_failed_subjects_for_compartment} · {sc.use_grade_points ? (sc.use_credits ? "credit-weighted SGPA" : "grade points") : "no grade points"}
                  </CardDescription>
                  {sc.description && <CardDescription className="mt-1">{sc.description}</CardDescription>}
                </div>
                {can(session, "grading.manage") && (
                  <div className="flex gap-1">
                    <RecordDialog title="Add grade band" triggerLabel="Add grade" triggerVariant="outline" fields={ruleFields} action={asRecordAction(saveGradingRule)} initial={{ grading_scheme_id: sc.id, is_pass: true }} />
                    <RecordDialog mode="edit" title="Edit grading scheme" wide fields={schemeFields} action={asRecordAction(saveGradingScheme)}
                      initial={{ id: sc.id, name: sc.name, level: sc.level ?? "", description: sc.description ?? "", subject_pass_percent: sc.subject_pass_percent?.toString() ?? "", aggregate_pass_percent: sc.aggregate_pass_percent?.toString() ?? "", require_component_pass: sc.require_component_pass, require_all_subjects_pass: sc.require_all_subjects_pass, max_failed_subjects_for_compartment: String(sc.max_failed_subjects_for_compartment), use_grade_points: sc.use_grade_points, use_credits: sc.use_credits, decimals: String(sc.decimals), is_active: sc.is_active }} />
                  </div>
                )}
              </CardHeader>
              <Table>
                <TableHeader><TableRow><TableHead>Grade</TableHead><TableHead className="text-right">From %</TableHead><TableHead className="text-right">Grade point</TableHead><TableHead>Pass</TableHead><TableHead>Description</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {[...sc.grading_rules].sort((a, b) => Number(b.min_percent) - Number(a.min_percent)).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-semibold">{r.grade}</TableCell><TableCell className="text-right tabular-nums">{r.min_percent}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.grade_point ?? "—"}</TableCell><TableCell>{r.is_pass ? <Badge variant="success">Pass</Badge> : <Badge variant="destructive">Fail</Badge>}</TableCell>
                      <TableCell>{r.description}</TableCell>
                      <TableCell className="text-right">{can(session, "grading.manage") && (
                        <div className="flex justify-end">
                          <RecordDialog mode="edit" title="Edit grade band" fields={ruleFields} action={asRecordAction(saveGradingRule)} initial={{ id: r.id, grading_scheme_id: sc.id, grade: r.grade, min_percent: String(r.min_percent), grade_point: r.grade_point?.toString() ?? "", description: r.description ?? "", is_pass: r.is_pass }} />
                          <ConfirmAction size="icon" variant="ghost" icon={<Trash2 />} label="" title={`Delete grade ${r.grade}?`} description="Existing processed results keep their stored grades." action={deleteGradingRule.bind(null, { id: r.id })} success="Grade removed" />
                        </div>
                      )}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          {can(session, "attendance.configure") && <div className="flex justify-end"><RecordDialog title="Attendance status" triggerLabel="Add status" action={asRecordAction(saveAttendanceStatus)} initial={{ counts_in_total: true, is_active: true, sort_order: "10" }} fields={[
            { name: "code", label: "Code (1–4 letters)", required: true }, { name: "label", label: "Label", required: true }, { name: "sort_order", label: "Sort order", type: "number" },
            { name: "counts_as_present", label: "Counts as attended", type: "checkbox" }, { name: "counts_in_total", label: "Counts in the total (eligible sessions)", type: "checkbox" }, { name: "is_active", label: "Active", type: "checkbox" },
          ]} /></div>}
          <Card>
            <CardContent className="pt-5 text-sm text-muted-foreground">Attendance % = attended ÷ eligible × 100. A status that does not count in the total (e.g. approved leave) is excluded from both.</CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Label</TableHead><TableHead>Attended</TableHead><TableHead>In total</TableHead><TableHead>Active</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {(statuses ?? []).map((s) => (
                  <TableRow key={s.code}>
                    <TableCell className="font-mono">{s.code}</TableCell><TableCell>{s.label}</TableCell>
                    <TableCell>{s.counts_as_present ? "Yes" : "No"}</TableCell><TableCell>{s.counts_in_total ? "Yes" : "Excluded"}</TableCell><TableCell>{s.is_active ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right">{can(session, "attendance.configure") && <RecordDialog mode="edit" title={`Edit ${s.code}`} action={asRecordAction(saveAttendanceStatus)} initial={{ code: s.code, label: s.label, counts_as_present: s.counts_as_present, counts_in_total: s.counts_in_total, is_active: s.is_active, sort_order: String(s.sort_order) }} fields={[
                      { name: "label", label: "Label", required: true }, { name: "sort_order", label: "Sort order", type: "number" },
                      { name: "counts_as_present", label: "Counts as attended", type: "checkbox" }, { name: "counts_in_total", label: "Counts in the total", type: "checkbox" }, { name: "is_active", label: "Active", type: "checkbox" },
                    ]} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="exams" className="space-y-4">
          {can(session, "exams.manage") && <div className="flex justify-end"><RecordDialog title="Examination type" triggerLabel="Add type" action={asRecordAction(saveExamType)} initial={{ is_active: true, sort_order: "10" }} fields={[
            { name: "code", label: "Code", required: true }, { name: "name", label: "Name", required: true }, { name: "sort_order", label: "Sort order", type: "number" },
            { name: "is_supplementary", label: "Supplementary / improvement type", type: "checkbox" }, { name: "is_active", label: "Active", type: "checkbox" },
          ]} /></div>}
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Supplementary</TableHead><TableHead>Active</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {(types ?? []).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono">{t.code}</TableCell><TableCell>{t.name}</TableCell><TableCell>{t.is_supplementary ? "Yes" : "—"}</TableCell><TableCell>{t.is_active ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right">{can(session, "exams.manage") && <RecordDialog mode="edit" title="Edit examination type" action={asRecordAction(saveExamType)} initial={{ id: t.id, code: t.code, name: t.name, is_supplementary: t.is_supplementary, is_active: t.is_active, sort_order: String(t.sort_order) }} fields={[
                      { name: "code", label: "Code", required: true }, { name: "name", label: "Name", required: true }, { name: "sort_order", label: "Sort order", type: "number" },
                      { name: "is_supplementary", label: "Supplementary / improvement type", type: "checkbox" }, { name: "is_active", label: "Active", type: "checkbox" },
                    ]} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <Card>
            <CardContent className="space-y-2 pt-5 text-sm">
              <p><strong>Backups:</strong> Supabase performs daily backups (Pro plan: point-in-time recovery). See <code>docs/BACKUP_AND_RECOVERY.md</code> for the restore procedure and the recommended weekly off-site <code>pg_dump</code>.</p>
              <p><strong>Retention:</strong> Academic and financial records are retained permanently (archived, never deleted). Audit logs and mark revisions are append-only. See <code>docs/SECURITY_AND_PRIVACY.md</code>.</p>
              <p><strong>Personal data:</strong> Collect only required information; do not record Aadhaar numbers. Exports are limited to authorised roles and are rate-limited.</p>
              <p><strong>Files:</strong> All document buckets are private; downloads use 60-second signed URLs after an access check.</p>
              <p className="text-muted-foreground">Role permissions: {titleCase("defined in source control")} — see Users & Permissions › Permission matrix.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
