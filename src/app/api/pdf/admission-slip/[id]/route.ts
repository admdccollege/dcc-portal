import { createElement } from "react";
import { apiGuard, isUuid } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import { AdmissionSlipDocument } from "@/lib/pdf/simple";
import { loadInstitution, pdfResponse } from "@/lib/pdf/render";

export async function GET(_req: Request, ctx: RouteContext<"/api/pdf/admission-slip/[id]">) {
  const guard = await apiGuard(["admissions.view"]);
  if (guard instanceof Response) return guard;
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: a } = await supabase.from("admissions")
    .select("*, students(admission_no), admission_documents(document_name, verified, submitted), admission_periods(title, admission_fee, programmes(name), programme_terms(name), academic_sessions(name))")
    .eq("id", id).maybeSingle();
  if (!a) return new Response("Not found", { status: 404 });
  const inst = await loadInstitution(supabase);
  const p = a.admission_periods;
  return pdfResponse(createElement(AdmissionSlipDocument, {
    inst,
    a: {
      application_no: a.application_no, applicant_name: a.applicant_name, date_of_birth: a.date_of_birth, phone: a.phone, email: a.email,
      guardian_name: a.guardian_name, period: p?.title ?? "", programme: p?.programmes?.name ?? "", term: p?.programme_terms?.name ?? "",
      session: p?.academic_sessions?.name ?? "", status: a.status, reviewed_at: a.reviewed_at, admission_no: a.students?.admission_no ?? null,
      fee: Number(p?.admission_fee ?? 0), fee_paid: a.admission_fee_paid, documents: a.admission_documents,
    },
  }), `admission_${a.application_no}.pdf`);
}
