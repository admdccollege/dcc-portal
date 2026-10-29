import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { param } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { UrlControls } from "@/components/shared/url-controls";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Pagination, pageRange, parsePage } from "@/components/shared/pagination";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit logs" };
const ENTITIES = ["students", "staff", "student_enrolments", "admissions", "admission_documents", "examinations", "examination_subjects", "payments", "payment_adjustments", "fee_concessions", "student_fee_assignments", "fee_structure_items", "grading_rules", "grading_schemes", "notices", "profiles", "institution_settings", "role_permissions", "timetable_entries", "teacher_assignments", "attendance_sessions"];

function summarise(details: unknown): string {
  const d = (details ?? {}) as Record<string, unknown>;
  if (d.changed && typeof d.changed === "object") {
    return Object.entries(d.changed as Record<string, { from: unknown; to: unknown }>).slice(0, 4).map(([k, v]) => `${k}: ${JSON.stringify(v.from)} → ${JSON.stringify(v.to)}`).join("; ");
  }
  if (d.new) return "created";
  return JSON.stringify(d).slice(0, 160);
}

export default async function AuditPage({ searchParams }: PageProps<"/settings/audit">) {
  await requirePermission("audit.view");
  const sp = await searchParams;
  const supabase = await createClient();
  const page = parsePage(sp.page);
  const [from, to] = pageRange(page, 50);
  const entity = ENTITIES.includes(param(sp.entity) ?? "") ? param(sp.entity) : undefined;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(param(sp.date) ?? "") ? param(sp.date) : undefined;
  const action = param(sp.action)?.replace(/[^a-z_.]/g, "");

  let q = supabase.from("audit_logs").select("id, action, entity_type, entity_id, details, created_at, actor_id, profiles(full_name, email)", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (entity) q = q.eq("entity_type", entity);
  if (action) q = q.ilike("action", `${action}%`);
  if (day) q = q.gte("created_at", `${day}T00:00:00+05:30`).lt("created_at", `${day}T23:59:59.999+05:30`);
  const { data: logs, count } = await q;

  return (
    <div className="space-y-5">
      <PageHeader title="Audit logs" description="Append-only record of sensitive changes: student records, marks corrections, results workflow, payments, roles and settings."
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Audit logs" }]}
        actions={<Button size="sm" variant="outline" asChild><a href={`/api/export/audit?format=csv${entity ? `&entity=${entity}` : ""}${day ? `&date=${day}` : ""}`}><Download /> Export CSV</a></Button>} />
      <UrlControls controls={[
        { name: "entity", label: "Record type", type: "select", options: ENTITIES.map((e) => ({ value: e, label: e.replace(/_/g, " ") })), placeholder: "All records" },
        { name: "action", label: "Action", type: "select", options: ["insert", "update", "delete", "exam.", "results.", "marks.", "roles.", "account.", "fees.", "admission.", "students.", "attendance.", "notice.", "user."].map((a) => ({ value: a, label: a })), placeholder: "All actions" },
        { name: "date", label: "Date", type: "date", width: "w-44" },
      ]} />
      <Card>
        {!logs?.length ? <div className="p-6"><EmptyState title="No audit entries" /></div> : (
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Record</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-xs">{formatDate(l.created_at, true)}</TableCell>
                  <TableCell className="text-sm">{l.profiles?.full_name ?? (l.actor_id ? "User" : "System")}</TableCell>
                  <TableCell className="font-mono text-xs">{l.action}</TableCell>
                  <TableCell className="text-xs">{l.entity_type}<span className="block font-mono text-muted-foreground">{l.entity_id?.slice(0, 8)}</span></TableCell>
                  <TableCell className="max-w-md truncate text-xs text-muted-foreground" title={JSON.stringify(l.details)}>{summarise(l.details)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Pagination page={page} total={count ?? 0} basePath="/settings/audit" params={sp} size={50} />
    </div>
  );
}
