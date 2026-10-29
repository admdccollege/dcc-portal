import { createElement } from "react";
import { getSession, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { exportResponse } from "@/lib/export";
import { buildReport, canSeeReport, REPORTS, type ReportType } from "@/lib/reports";
import { getReferenceData } from "@/lib/queries/reference";
import { TabularReportDocument } from "@/lib/pdf/simple";
import { loadInstitution, pdfResponse } from "@/lib/pdf/render";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorised", { status: 401 });
  const url = new URL(request.url);
  const type = url.searchParams.get("type") as ReportType;
  if (!REPORTS.some((r) => r.type === type) || !canSeeReport(session, type)) return new Response("Forbidden", { status: 403 });
  const isFee = type === "fee_collection" || type === "outstanding";
  if (!can(session, isFee ? "fees.export" : "reports.export")) return new Response("Forbidden", { status: 403 });
  if (!rateLimit(`report:${session.userId}`, 10)) return new Response("Too many requests", { status: 429 });
  const d = (k: string) => { const v = url.searchParams.get(k); return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined; };
  const sessionParam = url.searchParams.get("session");
  const supabase = await createClient();
  const ref = await getReferenceData();
  const report = await buildReport(supabase, ref, type, { sessionId: sessionParam && /^[0-9a-f-]{36}$/i.test(sessionParam) ? sessionParam : undefined, from: d("from"), to: d("to") });
  const format = url.searchParams.get("format");
  if (format === "pdf") {
    const inst = await loadInstitution(supabase);
    return pdfResponse(createElement(TabularReportDocument, {
      inst, title: report.title, subtitle: report.description,
      columns: report.columns.map((c) => ({ header: c.header, align: c.numeric ? ("right" as const) : undefined })),
      rows: report.rows.map((r) => report.columns.map((c) => r[c.key] ?? null)),
    }), `${type}.pdf`);
  }
  return exportResponse(format, report.rows, report.columns.map((c) => ({ header: c.header, value: (r: Record<string, string | number | null>) => r[c.key] })), type, report.title);
}
