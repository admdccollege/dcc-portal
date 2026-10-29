import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, param, programmeCode, uuidParam } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { UrlControls } from "@/components/shared/url-controls";
import { EmptyState } from "@/components/ui/misc";
import { PrintButton } from "@/components/shared/print-button";
import { summarise } from "@/lib/domain/attendance";
import { todayIST } from "@/lib/utils";

export const metadata: Metadata = { title: "Attendance register" };

export default async function RegisterPage({ searchParams }: PageProps<"/attendance/register">) {
  await requirePermission("attendance.take", "attendance.view_all");
  const sp = await searchParams;
  const ref = await getReferenceData();
  const supabase = await createClient();
  const sessionId = ref.currentSession?.id;
  const termId = uuidParam(sp.term);
  const subjectId = uuidParam(sp.subject);
  const month = /^\d{4}-\d{2}$/.test(param(sp.month) ?? "") ? param(sp.month)! : todayIST().slice(0, 7);
  const term = ref.terms.find((t) => t.id === termId);
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

  const { data: offerings } = term && sessionId ? await supabase.from("course_offerings").select("id, subjects(code, name)").eq("academic_session_id", sessionId).eq("term_id", term.id) : { data: [] };
  const subject = (offerings ?? []).find((o) => o.id === subjectId);

  let grid: React.ReactNode = <EmptyState title="Select a class, subject and month" />;
  if (term && sessionId) {
    let q = supabase.from("attendance_sessions").select("id, date, period, attendance_records(student_id, status_code)")
      .eq("academic_session_id", sessionId).eq("term_id", term.id).gte("date", first).lte("date", last).order("date").order("period");
    q = subjectId ? q.eq("course_offering_id", subjectId) : q.is("course_offering_id", null);
    const [{ data: sessions }, { data: roster }, { data: statuses }] = await Promise.all([
      q,
      supabase.from("student_enrolments").select("student_id, roll_no, students(full_name)").eq("academic_session_id", sessionId).eq("term_id", term.id).in("status", ["active", "promoted", "repeated", "completed"]),
      supabase.from("attendance_statuses").select("code, label, counts_as_present, counts_in_total"),
    ]);
    const students = (roster ?? []).sort((a, b) => (a.roll_no ?? "zzz").localeCompare(b.roll_no ?? "zzz"));
    const cols = sessions ?? [];
    const cell = new Map<string, string>();
    for (const s of cols) for (const r of s.attendance_records) cell.set(`${s.id}:${r.student_id}`, r.status_code);
    grid = cols.length === 0 ? <EmptyState title="No attendance recorded in this month" /> : (
      <div className="print-area overflow-x-auto rounded-lg border bg-card">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/60">
              <th className="sticky left-0 border bg-muted p-1.5 text-left">Roll</th>
              <th className="sticky left-10 border bg-muted p-1.5 text-left">Student</th>
              {cols.map((c) => <th key={c.id} className="border p-1 text-center font-medium" title={`Period ${c.period}`}>{Number(c.date.slice(8))}<span className="block text-[9px] text-muted-foreground">P{c.period}</span></th>)}
              <th className="border p-1.5">%</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const codes = cols.map((c) => cell.get(`${c.id}:${s.student_id}`)).filter((x): x is string => !!x);
              const sum = summarise(codes, statuses ?? []);
              return (
                <tr key={s.student_id}>
                  <td className="sticky left-0 border bg-card p-1.5">{s.roll_no}</td>
                  <td className="sticky left-10 whitespace-nowrap border bg-card p-1.5">{s.students?.full_name}</td>
                  {cols.map((c) => {
                    const v = cell.get(`${c.id}:${s.student_id}`);
                    return <td key={c.id} className={`border p-1 text-center ${v === "A" ? "font-bold text-destructive" : ""}`}>{v ?? "·"}</td>;
                  })}
                  <td className="border p-1.5 text-right font-medium tabular-nums">{sum.percentage ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="p-2 text-[11px] text-muted-foreground">{(statuses ?? []).map((s) => `${s.code} = ${s.label}`).join(" · ")} · “·” = not recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance register"
        description={term ? `${programmeCode(ref, term.programme_id)} · ${term.name} · ${subject ? `${subject.subjects?.code} ${subject.subjects?.name}` : "Whole class"} · ${new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}` : "Printable monthly register"}
        breadcrumbs={[{ label: "Attendance", href: "/attendance" }, { label: "Register" }]}
        actions={<PrintButton />}
      />
      <UrlControls controls={[
        { name: "term", label: "Class", type: "select", options: ref.terms.map((t) => ({ value: t.id, label: `${programmeCode(ref, t.programme_id)} · ${t.name}` })), resets: ["subject"] },
        { name: "subject", label: "Subject", type: "select", options: (offerings ?? []).map((o) => ({ value: o.id, label: `${o.subjects?.code} — ${o.subjects?.name}` })), placeholder: "Whole class", width: "w-full sm:w-64" },
        { name: "month", label: "Month", type: "month", defaultValue: month, width: "w-full sm:w-44" },
      ]} />
      {grid}
    </div>
  );
}
