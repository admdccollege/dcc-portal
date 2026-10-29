import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Session } from "@/lib/auth/session";
import { can } from "@/lib/auth/session";
import type { ReferenceData } from "@/lib/queries/reference";
import { programmeCode, termName } from "@/lib/queries/reference";

export type ReportType = "enrolment" | "admissions" | "attendance" | "exam_performance" | "fee_collection" | "outstanding" | "allocations";

export type Report = {
  type: ReportType;
  title: string;
  description: string;
  columns: { key: string; header: string; numeric?: boolean }[];
  rows: Record<string, string | number | null>[];
  note?: string;
};

export const REPORTS: { type: ReportType; label: string; perm: Parameters<typeof can>[1][] }[] = [
  { type: "enrolment", label: "Enrolment", perm: ["reports.view"] },
  { type: "admissions", label: "Admissions", perm: ["reports.view"] },
  { type: "attendance", label: "Attendance", perm: ["reports.view"] },
  { type: "exam_performance", label: "Examination performance", perm: ["reports.view"] },
  { type: "allocations", label: "Staff & course allocation", perm: ["reports.view"] },
  { type: "fee_collection", label: "Fee collection", perm: ["fees.view"] },
  { type: "outstanding", label: "Outstanding dues", perm: ["fees.view"] },
];

export function canSeeReport(session: Session, type: ReportType) {
  const r = REPORTS.find((x) => x.type === type);
  return !!r && can(session, ...r.perm);
}

/** Builds a report from live database data via the caller's RLS-scoped client. */
export async function buildReport(supabase: ServerSupabase, ref: ReferenceData, type: ReportType, opts: { sessionId?: string; from?: string; to?: string }): Promise<Report> {
  const sessionId = opts.sessionId ?? ref.currentSession?.id ?? "";
  const sessionName = ref.sessions.find((s) => s.id === sessionId)?.name ?? "";

  switch (type) {
    case "enrolment": {
      const { data } = await supabase.from("student_enrolments").select("programme_id, term_id, status, students(gender)").eq("academic_session_id", sessionId);
      const map = new Map<string, { programme: string; term: string; active: number; female: number; male: number; other: number; left: number }>();
      for (const e of data ?? []) {
        const k = `${e.programme_id}:${e.term_id}`;
        const row = map.get(k) ?? { programme: programmeCode(ref, e.programme_id), term: termName(ref, e.term_id), active: 0, female: 0, male: 0, other: 0, left: 0 };
        if (e.status === "active" || e.status === "promoted" || e.status === "completed") {
          row.active += 1;
          const g = e.students?.gender;
          if (g === "female") row.female += 1; else if (g === "male") row.male += 1; else row.other += 1;
        } else if (e.status === "withdrawn" || e.status === "transferred") row.left += 1;
        map.set(k, row);
      }
      return {
        type, title: `Student enrolment — ${sessionName}`, description: "Students enrolled per class (active, promoted or completed), by gender, plus withdrawals/transfers.",
        columns: [{ key: "programme", header: "Programme" }, { key: "term", header: "Class" }, { key: "active", header: "Enrolled", numeric: true }, { key: "female", header: "Female", numeric: true }, { key: "male", header: "Male", numeric: true }, { key: "other", header: "Other/undisclosed", numeric: true }, { key: "left", header: "Withdrawn/transferred", numeric: true }],
        rows: [...map.values()].sort((a, b) => a.programme.localeCompare(b.programme) || a.term.localeCompare(b.term)),
      };
    }
    case "admissions": {
      const { data } = await supabase.from("admissions").select("status, created_at, admission_periods(title, seats)");
      const map = new Map<string, Record<string, number | string | null>>();
      for (const a of data ?? []) {
        if (opts.from && a.created_at.slice(0, 10) < opts.from) continue;
        if (opts.to && a.created_at.slice(0, 10) > opts.to) continue;
        const k = a.admission_periods?.title ?? "—";
        const row = map.get(k) ?? { period: k, seats: a.admission_periods?.seats ?? null, total: 0, submitted: 0, under_review: 0, approved: 0, admitted: 0, rejected: 0, other: 0 };
        row.total = Number(row.total) + 1;
        const key = ["submitted", "under_review", "approved", "admitted", "rejected"].includes(a.status) ? a.status : "other";
        row[key] = Number(row[key]) + 1;
        map.set(k, row);
      }
      return {
        type, title: "Admission trends", description: "Applications by admission period and status" + (opts.from || opts.to ? ` (${opts.from ?? "…"} to ${opts.to ?? "…"})` : ""),
        columns: [{ key: "period", header: "Admission period" }, { key: "seats", header: "Seats", numeric: true }, { key: "total", header: "Applications", numeric: true }, { key: "submitted", header: "Submitted", numeric: true }, { key: "under_review", header: "Under review", numeric: true }, { key: "approved", header: "Approved", numeric: true }, { key: "admitted", header: "Admitted", numeric: true }, { key: "rejected", header: "Rejected", numeric: true }, { key: "other", header: "Other", numeric: true }],
        rows: [...map.values()],
      };
    }
    case "attendance": {
      const [{ data: summary }, { data: enrol }, { data: settings }] = await Promise.all([
        supabase.rpc("attendance_summary", { p_academic_session_id: sessionId, p_from: opts.from, p_to: opts.to }),
        supabase.from("student_enrolments").select("student_id, programme_id, term_id").eq("academic_session_id", sessionId),
        supabase.from("institution_settings").select("attendance_threshold").single(),
      ]);
      const threshold = Number(settings?.attendance_threshold ?? 75);
      const cls = new Map((enrol ?? []).map((e) => [e.student_id, `${e.programme_id}:${e.term_id}`]));
      const map = new Map<string, { programme: string; term: string; students: number; attended: number; eligible: number; below: number; norecords: number }>();
      for (const s of summary ?? []) {
        const k = cls.get(s.student_id);
        if (!k) continue;
        const [p, t] = k.split(":");
        const row = map.get(k) ?? { programme: programmeCode(ref, p), term: termName(ref, t), students: 0, attended: 0, eligible: 0, below: 0, norecords: 0 };
        row.students += 1; row.attended += Number(s.attended); row.eligible += Number(s.eligible);
        if (s.percentage === null) row.norecords += 1; else if (Number(s.percentage) < threshold) row.below += 1;
        map.set(k, row);
      }
      return {
        type, title: `Attendance by class — ${sessionName}`, description: `Attended ÷ eligible sessions; students below ${threshold}% are counted separately.`,
        columns: [{ key: "programme", header: "Programme" }, { key: "term", header: "Class" }, { key: "students", header: "Students with records", numeric: true }, { key: "pct", header: "Attendance %", numeric: true }, { key: "below", header: `Below ${threshold}%`, numeric: true }],
        rows: [...map.values()].map((r) => ({ programme: r.programme, term: r.term, students: r.students, pct: r.eligible ? Math.round((1000 * r.attended) / r.eligible) / 10 : null, below: r.below })),
        note: "Classes with no attendance recorded are not listed.",
      };
    }
    case "exam_performance": {
      const { data } = await supabase.from("examinations").select("id, name, programme_id, term_id, status, results(status, percentage, result_subjects(is_pass))").eq("academic_session_id", sessionId).eq("status", "published");
      return {
        type, title: `Examination performance — ${sessionName}`, description: "Published examinations only. Pass rate = passed ÷ candidates who appeared.",
        columns: [{ key: "exam", header: "Examination" }, { key: "cls", header: "Class" }, { key: "candidates", header: "Candidates", numeric: true }, { key: "pass", header: "Pass", numeric: true }, { key: "compartment", header: "Compartment", numeric: true }, { key: "fail", header: "Fail", numeric: true }, { key: "absent", header: "Absent", numeric: true }, { key: "rate", header: "Pass rate %", numeric: true }, { key: "avg", header: "Average %", numeric: true }, { key: "subjrate", header: "Subject pass rate %", numeric: true }],
        rows: (data ?? []).map((e) => {
          const c = (s: string) => e.results.filter((r) => r.status === s).length;
          const appeared = e.results.filter((r) => r.status !== "absent").length;
          const pcts = e.results.map((r) => r.percentage).filter((p): p is number => p !== null).map(Number);
          const subj = e.results.flatMap((r) => r.result_subjects).filter((s) => s.is_pass !== null);
          return {
            exam: e.name, cls: `${programmeCode(ref, e.programme_id)} ${termName(ref, e.term_id)}`, candidates: e.results.length, pass: c("pass"), compartment: c("compartment"), fail: c("fail"), absent: c("absent"),
            rate: appeared ? Math.round((1000 * c("pass")) / appeared) / 10 : null,
            avg: pcts.length ? Math.round((10 * pcts.reduce((a, b) => a + b, 0)) / pcts.length) / 10 : null,
            subjrate: subj.length ? Math.round((1000 * subj.filter((s) => s.is_pass).length) / subj.length) / 10 : null,
          };
        }),
      };
    }
    case "allocations": {
      const [{ data: offerings }, { data: staff }] = await Promise.all([
        supabase.from("course_offerings").select("programme_id, term_id, subjects(code, name), teacher_assignments(staff_id, role), student_subject_enrolments(count)").eq("academic_session_id", sessionId),
        supabase.rpc("staff_directory"),
      ]);
      const name = new Map((staff ?? []).map((s) => [s.id, s.full_name]));
      return {
        type, title: `Course & staff allocation — ${sessionName}`, description: "Every subject offering with its allocated teachers. Rows without a teacher need attention.",
        columns: [{ key: "cls", header: "Class" }, { key: "code", header: "Code" }, { key: "subject", header: "Subject" }, { key: "students", header: "Students", numeric: true }, { key: "teachers", header: "Teachers" }],
        rows: (offerings ?? []).map((o) => ({
          cls: `${programmeCode(ref, o.programme_id)} ${termName(ref, o.term_id)}`, code: o.subjects?.code ?? "", subject: o.subjects?.name ?? "",
          students: (o.student_subject_enrolments as unknown as { count: number }[])[0]?.count ?? 0,
          teachers: o.teacher_assignments.map((t) => `${name.get(t.staff_id) ?? "?"}${t.role === "examiner" ? " (examiner)" : ""}`).join(", ") || "NOT ALLOCATED",
        })).sort((a, b) => String(a.cls).localeCompare(String(b.cls)) || String(a.code).localeCompare(String(b.code))),
      };
    }
    case "fee_collection": {
      let q = supabase.from("payments").select("amount, status, payment_date, student_fee_assignments(fee_structures(programme_id))").eq("status", "completed");
      if (opts.from) q = q.gte("payment_date", opts.from);
      if (opts.to) q = q.lte("payment_date", opts.to);
      const { data } = await q.limit(20000);
      const map = new Map<string, { programme: string; receipts: number; amount: number }>();
      for (const p of data ?? []) {
        const pid = p.student_fee_assignments?.fee_structures?.programme_id ?? "";
        const row = map.get(pid) ?? { programme: programmeCode(ref, pid), receipts: 0, amount: 0 };
        row.receipts += 1; row.amount += Number(p.amount);
        map.set(pid, row);
      }
      return {
        type, title: "Fee collection by programme", description: `Completed payments${opts.from || opts.to ? ` from ${opts.from ?? "…"} to ${opts.to ?? "…"}` : " (all dates)"}. Reversed payments excluded.`,
        columns: [{ key: "programme", header: "Programme" }, { key: "receipts", header: "Receipts", numeric: true }, { key: "amount", header: "Amount (₹)", numeric: true }],
        rows: [...map.values()],
      };
    }
    case "outstanding": {
      const { data } = await supabase.from("student_fee_balances").select("programme_id, gross_amount, concessions, paid, balance, is_overdue").eq("academic_session_id", sessionId).eq("is_cancelled", false);
      const map = new Map<string, { programme: string; assigned: number; gross: number; concessions: number; paid: number; balance: number; overdue: number; defaulters: number }>();
      for (const b of data ?? []) {
        const row = map.get(b.programme_id!) ?? { programme: programmeCode(ref, b.programme_id), assigned: 0, gross: 0, concessions: 0, paid: 0, balance: 0, overdue: 0, defaulters: 0 };
        row.assigned += 1; row.gross += Number(b.gross_amount); row.concessions += Number(b.concessions); row.paid += Number(b.paid);
        row.balance += Math.max(0, Number(b.balance)); if (b.is_overdue) row.overdue += 1; if (Number(b.balance) > 0) row.defaulters += 1;
        map.set(b.programme_id!, row);
      }
      return {
        type, title: `Outstanding fees by programme — ${sessionName}`, description: "Assessed amounts, concessions, collections and balances (cancelled assignments excluded).",
        columns: [{ key: "programme", header: "Programme" }, { key: "assigned", header: "Assignments", numeric: true }, { key: "gross", header: "Assessed (₹)", numeric: true }, { key: "concessions", header: "Concessions (₹)", numeric: true }, { key: "paid", header: "Collected (₹)", numeric: true }, { key: "balance", header: "Outstanding (₹)", numeric: true }, { key: "defaulters", header: "With balance", numeric: true }, { key: "overdue", header: "Overdue", numeric: true }],
        rows: [...map.values()],
      };
    }
  }
}
