import type { Metadata } from "next";
import { Download, FileText } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, param, uuidParam } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { UrlControls } from "@/components/shared/url-controls";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { SimpleBarChart, type ChartFormat } from "@/components/charts";
import { buildReport, canSeeReport, REPORTS, type ReportType } from "@/lib/reports";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports & analytics" };

const CHART: Partial<Record<ReportType, { label: (r: Record<string, string | number | null>) => string; value: string; format: ChartFormat; aria: string }>> = {
  enrolment: { label: (r) => `${r.programme} ${String(r.term).replace("Semester ", "S").replace("Class ", "")}`, value: "active", format: "number", aria: "Enrolment by class" },
  attendance: { label: (r) => `${r.programme} ${String(r.term).replace("Semester ", "S").replace("Class ", "")}`, value: "pct", format: "percent", aria: "Attendance percentage by class" },
  exam_performance: { label: (r) => String(r.exam).slice(0, 18), value: "rate", format: "percent", aria: "Pass rate by examination" },
  fee_collection: { label: (r) => String(r.programme), value: "amount", format: "inr_k", aria: "Fee collection by programme" },
  outstanding: { label: (r) => String(r.programme), value: "balance", format: "inr_k", aria: "Outstanding fees by programme" },
  admissions: { label: (r) => String(r.period).slice(0, 20), value: "total", format: "number", aria: "Applications by admission period" },
};

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const session = await requirePermission("reports.view", "fees.view");
  const sp = await searchParams;
  const ref = await getReferenceData();
  const supabase = await createClient();
  const available = REPORTS.filter((r) => canSeeReport(session, r.type));
  const type = (available.find((r) => r.type === param(sp.type))?.type ?? available[0]?.type) as ReportType;
  const sessionId = uuidParam(sp.session) ?? ref.currentSession?.id;
  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const from = isDate(param(sp.from)) ? param(sp.from) : undefined;
  const to = isDate(param(sp.to)) ? param(sp.to) : undefined;
  const report = await buildReport(supabase, ref, type, { sessionId, from, to });
  const isFee = type === "fee_collection" || type === "outstanding";
  const canExport = can(session, isFee ? "fees.export" : "reports.export");
  const qs = new URLSearchParams(Object.entries({ type, session: sessionId, from, to }).filter(([, v]) => v) as [string, string][]).toString();
  const chart = CHART[type];
  const numericTotals = report.columns.filter((c) => c.numeric && !["pct", "rate", "avg", "subjrate", "seats"].includes(c.key));

  return (
    <div className="space-y-5">
      <PageHeader title="Reports & Analytics" description="Live reports from the database, limited to what your role may see."
        actions={canExport && (
          <>
            <Button size="sm" variant="outline" asChild><a href={`/api/reports?format=csv&${qs}`}><Download /> CSV</a></Button>
            <Button size="sm" variant="outline" asChild><a href={`/api/reports?format=xlsx&${qs}`}><Download /> Excel</a></Button>
            <Button size="sm" variant="outline" asChild><a href={`/api/reports?format=pdf&${qs}`} target="_blank" rel="noopener"><FileText /> PDF</a></Button>
          </>
        )} />
      <UrlControls controls={[
        { name: "type", label: "Report", type: "select", options: available.map((r) => ({ value: r.type, label: r.label })), placeholder: available[0]?.label ?? "Report", width: "w-full sm:w-60" },
        { name: "session", label: "Academic session", type: "select", options: ref.sessions.map((s) => ({ value: s.id, label: s.name })), placeholder: "Current session" },
        { name: "from", label: "From", type: "date", width: "w-full sm:w-40" },
        { name: "to", label: "To", type: "date", width: "w-full sm:w-40" },
      ]} />
      <Card>
        <CardHeader><CardTitle>{report.title}</CardTitle><CardDescription>{report.description}</CardDescription></CardHeader>
        {chart && report.rows.length > 0 && (
          <CardContent>
            <SimpleBarChart data={report.rows.map((r) => ({ label: chart.label(r), value: r[chart.value] === null ? null : Number(r[chart.value]) }))} format={chart.format} ariaLabel={chart.aria} />
          </CardContent>
        )}
        {report.rows.length === 0 ? <CardContent><EmptyState title="No data for these filters" /></CardContent> : (
          <Table>
            <TableHeader><TableRow>{report.columns.map((c) => <TableHead key={c.key} className={c.numeric ? "text-right" : ""}>{c.header}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {report.rows.map((r, i) => (
                <TableRow key={i}>{report.columns.map((c) => <TableCell key={c.key} className={c.numeric ? "text-right tabular-nums" : String(r[c.key]) === "NOT ALLOCATED" ? "font-medium text-destructive" : ""}>{r[c.key] === null ? "—" : c.numeric ? formatNumber(r[c.key]) : r[c.key]}</TableCell>)}</TableRow>
              ))}
            </TableBody>
            {numericTotals.length > 0 && (
              <TableFooter>
                <TableRow>{report.columns.map((c, i) => <TableCell key={c.key} className={c.numeric ? "text-right tabular-nums" : ""}>{i === 0 ? "Total" : numericTotals.includes(c) ? formatNumber(report.rows.reduce((a, r) => a + Number(r[c.key] ?? 0), 0)) : ""}</TableCell>)}</TableRow>
              </TableFooter>
            )}
          </Table>
        )}
        {report.note && <CardContent className="pt-3 text-xs text-muted-foreground">{report.note}</CardContent>}
      </Card>
    </div>
  );
}
