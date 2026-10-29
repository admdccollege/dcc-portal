import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, uuidParam, programmeCode } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { PromotionTool } from "@/components/students/promotion-tool";
import { EmptyState } from "@/components/ui/misc";

export const metadata = { title: "Promote students" };

export default async function PromotePage({ searchParams }: PageProps<"/students/promote">) {
  await requirePermission("students.promote");
  const sp = await searchParams;
  const ref = await getReferenceData();
  const supabase = await createClient();
  const termId = uuidParam(sp.term);
  const sessionId = uuidParam(sp.session) ?? ref.currentSession?.id;
  const term = ref.terms.find((t) => t.id === termId);
  const programme = ref.programmes.find((p) => p.id === term?.programme_id);

  let rows: { id: string; roll_no: string | null; name: string; admission_no: string; percentage: number | null }[] = [];
  if (termId && sessionId) {
    const { data } = await supabase.from("student_enrolments").select("id, roll_no, student_id, students(full_name, admission_no)")
      .eq("academic_session_id", sessionId).eq("term_id", termId).eq("status", "active").order("roll_no");
    const { data: att } = await supabase.rpc("attendance_summary", { p_academic_session_id: sessionId, p_term_id: termId });
    rows = (data ?? []).map((e) => ({
      id: e.id, roll_no: e.roll_no, name: e.students?.full_name ?? "", admission_no: e.students?.admission_no ?? "",
      percentage: att?.find((a) => a.student_id === e.student_id)?.percentage ?? null,
    }));
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Promote students" description="Move students to the next class/semester, repeat a term, or graduate them. Previous enrolments and records are preserved." breadcrumbs={[{ label: "Students", href: "/students" }, { label: "Promote" }]} />
      <FilterBar showSearch={false} filters={[
        { name: "session", label: "Session", options: ref.sessions.map((s) => ({ value: s.id, label: s.name })), allLabel: "Current session" },
        { name: "term", label: "Class", options: ref.terms.map((t) => ({ value: t.id, label: `${programmeCode(ref, t.programme_id)} · ${t.name}` })), allLabel: "Select class" },
      ]} />
      {!termId ? <EmptyState title="Select a class" description="Choose the class whose students you want to promote." /> : (
        <PromotionTool
          rows={rows}
          isFinalTerm={!!term && !!programme && term.sequence >= programme.total_terms}
          sessions={ref.sessions.map((s) => ({ id: s.id, name: s.name }))}
          currentSessionId={sessionId!}
          threshold={Number(ref.settings?.attendance_threshold ?? 75)}
        />
      )}
    </div>
  );
}
