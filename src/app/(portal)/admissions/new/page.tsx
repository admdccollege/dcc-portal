import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ApplicationForm } from "@/components/admissions/application-form";
import { EmptyState } from "@/components/ui/misc";
import { todayIST } from "@/lib/utils";

export const metadata = { title: "New application" };

export default async function NewApplicationPage() {
  await requirePermission("admissions.manage");
  const supabase = await createClient();
  const { data: periods } = await supabase.from("admission_periods").select("id, title, opens_on, closes_on, is_active, required_documents, academic_session_id, term_id").order("opens_on", { ascending: false });
  const today = todayIST();
  const withOfferings = await Promise.all((periods ?? []).map(async (p) => {
    const { data } = await supabase.from("course_offerings").select("id, is_compulsory, subjects(code, name)").eq("academic_session_id", p.academic_session_id).eq("term_id", p.term_id);
    return { id: p.id, title: p.title, required_documents: p.required_documents, open: p.is_active && today >= p.opens_on && today <= p.closes_on,
      offerings: (data ?? []).map((o) => ({ id: o.id, is_compulsory: o.is_compulsory, label: `${o.subjects?.code} — ${o.subjects?.name}` })) };
  }));
  return (
    <div className="space-y-5">
      <PageHeader title="New admission application" breadcrumbs={[{ label: "Admissions", href: "/admissions" }, { label: "New" }]} />
      {withOfferings.length === 0 ? <EmptyState title="No admission periods" description="Create an admission period first (Admissions › Admission periods)." /> : <ApplicationForm periods={withOfferings} />}
    </div>
  );
}
