import { createElement } from "react";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/auth/api";
import { rateLimit } from "@/lib/rate-limit";
import { loadMarksheets } from "@/lib/pdf/marksheet-data";
import { MarksheetDocument } from "@/lib/pdf/marksheet";
import { loadInstitution, pdfResponse } from "@/lib/pdf/render";

export async function GET(_req: Request, ctx: RouteContext<"/api/pdf/marksheet/[id]">) {
  const session = await getSession();
  if (!session) return new Response("Unauthorised", { status: 401 });
  if (!rateLimit(`pdf:${session.userId}`, 30)) return new Response("Too many requests", { status: 429 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const items = await loadMarksheets(supabase, { resultId: id }); // RLS: results.view or own published result
  if (!items.length) return new Response("Not found", { status: 404 });
  const inst = await loadInstitution(supabase);
  return pdfResponse(createElement(MarksheetDocument, { items, inst }), `marksheet_${items[0].student.admission_no}.pdf`);
}
