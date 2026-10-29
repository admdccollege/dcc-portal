import { createElement } from "react";
import { apiGuard, isUuid } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import { loadMarksheets } from "@/lib/pdf/marksheet-data";
import { MarksheetDocument } from "@/lib/pdf/marksheet";
import { loadInstitution, pdfResponse } from "@/lib/pdf/render";

export async function GET(_req: Request, ctx: RouteContext<"/api/pdf/marksheets/[examId]">) {
  const guard = await apiGuard(["results.view"], 5);
  if (guard instanceof Response) return guard;
  const { examId } = await ctx.params;
  if (!isUuid(examId)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const items = await loadMarksheets(supabase, { examId });
  if (!items.length) return new Response("No results", { status: 404 });
  const inst = await loadInstitution(supabase);
  return pdfResponse(createElement(MarksheetDocument, { items, inst }), `marksheets_${items[0].exam.name}.pdf`);
}
