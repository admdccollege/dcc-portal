import { describe, expect, it } from "vitest";
import { admin, as, id, offeringId, stackAvailable, today } from "./helpers";
import { summarise } from "@/lib/domain/attendance";

const up = await stackAvailable();

describe.skipIf(!up)("attendance rules", () => {
  it("summary percentages from the database match the TypeScript calculation", async () => {
    const a = admin();
    const studentId = await id("students", { email: "student.science@dcc.example" });
    const { data: session } = await a.from("academic_sessions").select("id").eq("is_current", true).single();
    const [{ data: statuses }, { data: recs }, { data: sum }] = await Promise.all([
      a.from("attendance_statuses").select("code, counts_as_present, counts_in_total"),
      a.from("attendance_records").select("status_code").eq("student_id", studentId),
      (await as("student")).rpc("attendance_summary", { p_academic_session_id: session!.id, p_student_id: studentId }),
    ]);
    const ts = summarise(recs!.map((r) => r.status_code), statuses!);
    expect(Number(sum![0].percentage)).toBe(ts.percentage);
    expect(Number(sum![0].eligible)).toBe(ts.eligible);
  });

  it("teachers cannot record attendance for unassigned subjects, future dates or outside the edit window", async () => {
    const t = await as("history");
    const phy = await offeringId("HS-SCI", 1, "HS-PHY");
    const { data: o } = await admin().from("course_offerings").select("academic_session_id, programme_id, term_id").eq("id", phy).single();
    const studentId = await id("students", { email: "student.science@dcc.example" });
    const rec = [{ student_id: studentId, status_code: "P" }];
    let r = await t.rpc("save_attendance", { p_academic_session_id: o!.academic_session_id, p_programme_id: o!.programme_id, p_term_id: o!.term_id, p_offering_id: phy, p_date: today(), p_period: 6, p_records: rec });
    expect(r.error?.code).toBe("42501");
    const p = await as("physics");
    const future = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    r = await p.rpc("save_attendance", { p_academic_session_id: o!.academic_session_id, p_programme_id: o!.programme_id, p_term_id: o!.term_id, p_offering_id: phy, p_date: future, p_period: 6, p_records: rec });
    expect(r.error?.message).toMatch(/future/);
    r = await p.rpc("save_attendance", { p_academic_session_id: o!.academic_session_id, p_programme_id: o!.programme_id, p_term_id: o!.term_id, p_offering_id: phy, p_date: "2026-08-03", p_period: 6, p_records: rec });
    expect(r.error?.code).toBe("42501");
  });

  it("re-saving the same class/date/period updates instead of duplicating; invalid statuses rejected", async () => {
    const p = await as("physics");
    const phy = await offeringId("HS-SCI", 1, "HS-PHY");
    const { data: o } = await admin().from("course_offerings").select("academic_session_id, programme_id, term_id").eq("id", phy).single();
    const studentId = await id("students", { email: "student.science@dcc.example" });
    const args = { p_academic_session_id: o!.academic_session_id, p_programme_id: o!.programme_id, p_term_id: o!.term_id, p_offering_id: phy, p_date: today(), p_period: 7 };
    expect((await p.rpc("save_attendance", { ...args, p_records: [{ student_id: studentId, status_code: "P" }] })).error).toBeNull();
    expect((await p.rpc("save_attendance", { ...args, p_records: [{ student_id: studentId, status_code: "A" }] })).error).toBeNull();
    const { data } = await admin().from("attendance_sessions").select("id, attendance_records(status_code)").eq("course_offering_id", phy).eq("date", today()).eq("period", 7);
    expect(data).toHaveLength(1);
    expect(data![0].attendance_records).toEqual([{ status_code: "A" }]);
    expect((await p.rpc("save_attendance", { ...args, p_records: [{ student_id: studentId, status_code: "ZZ" }] })).error?.message).toMatch(/Invalid attendance status/);
    expect((await p.rpc("save_attendance", { ...args, p_records: [{ student_id: studentId, status_code: "P" }, { student_id: studentId, status_code: "A" }] })).error?.message).toMatch(/Duplicate/);
  });
});

describe.skipIf(!up)("student registration and CSV import", () => {
  it("import is all-or-nothing: one invalid row saves nothing", async () => {
    const office = await as("office");
    const { data: o } = await admin().from("course_offerings").select("academic_session_id, programme_id, term_id").eq("id", await offeringId("MA-ENG", 1, "MAENG-C101")).single();
    const before = (await admin().from("students").select("id", { count: "exact", head: true })).count!;
    const rows = [
      { full_name: "Import Test One", date_of_birth: "2003-01-01", gender: "female" },
      { full_name: "Import Test Two", date_of_birth: "not-a-date", gender: "male" },
    ];
    const r = await office.rpc("import_students", { p_rows: rows, p_academic_session_id: o!.academic_session_id, p_programme_id: o!.programme_id, p_term_id: o!.term_id });
    expect(r.error?.message).toMatch(/Row 3/);
    const after = (await admin().from("students").select("id", { count: "exact", head: true })).count!;
    expect(after).toBe(before);
  });

  it("valid import creates students with generated admission numbers and compulsory subjects", async () => {
    const office = await as("office");
    const off = await offeringId("MA-ENG", 1, "MAENG-C101");
    const { data: o } = await admin().from("course_offerings").select("academic_session_id, programme_id, term_id").eq("id", off).single();
    const stamp = Date.now().toString().slice(-6);
    const r = await office.rpc("import_students", { p_rows: [{ full_name: `Import Valid ${stamp}`, date_of_birth: "2003-02-02", gender: "female", roll_no: `I${stamp}` }], p_academic_session_id: o!.academic_session_id, p_programme_id: o!.programme_id, p_term_id: o!.term_id });
    expect(r.error).toBeNull();
    const { data: s } = await admin().from("students").select("admission_no, student_enrolments(student_subject_enrolments(course_offering_id))").eq("full_name", `Import Valid ${stamp}`).single();
    expect(s!.admission_no).toMatch(/^DCC\/\d{4}\/\d{4}$/);
    expect(s!.student_enrolments[0].student_subject_enrolments.map((x) => x.course_offering_id)).toContain(off);
  });

  it("duplicate identifiers are rejected by the database", async () => {
    const office = await as("office");
    const { data: existing } = await admin().from("students").select("admission_no").limit(1).single();
    const { data: o } = await admin().from("course_offerings").select("academic_session_id, programme_id, term_id").eq("id", await offeringId("MA-ENG", 1, "MAENG-C101")).single();
    const r = await office.rpc("create_student", {
      p_student: { full_name: "Duplicate Admission", date_of_birth: "2003-03-03", admission_no: existing!.admission_no },
      p_guardian: {}, p_enrolment: { academic_session_id: o!.academic_session_id, programme_id: o!.programme_id, term_id: o!.term_id },
    });
    expect(r.error?.code).toBe("23505");
  });

  it("teachers and accountants cannot create or edit students", async () => {
    for (const who of ["physics", "accounts"] as const) {
      const c = await as(who);
      const { error } = await c.rpc("import_students", { p_rows: [{ full_name: "X", date_of_birth: "2003-01-01" }], p_academic_session_id: "00000000-0000-0000-0000-000000000000", p_programme_id: "00000000-0000-0000-0000-000000000000", p_term_id: "00000000-0000-0000-0000-000000000000" });
      expect(error?.code, who).toBe("42501");
      const sid = await id("students", { email: "student.science@dcc.example" });
      const upd = await c.from("students").update({ full_name: "Hacked" }).eq("id", sid).select("id");
      expect(upd.data ?? []).toHaveLength(0);
    }
  });

  it("admission approval requires verified documents; conversion creates the student atomically", async () => {
    const office = await as("office");
    const { data: pending } = await admin().from("admissions").select("id").eq("status", "under_review").limit(1).single();
    expect((await office.rpc("review_admission", { p_admission_id: pending!.id, p_status: "approved", p_remarks: "" })).error?.message).toMatch(/documents must be verified/);
    const { data: approved } = await admin().from("admissions").select("id, applicant_name").eq("status", "approved").limit(1).single();
    // Office has no payments.record → conversion with payment fails and nothing is created
    const failed = await office.rpc("convert_admission", { p_admission_id: approved!.id, p_payment: { amount: 1500, method_code: "cash" } });
    expect(failed.error?.code).toBe("42501");
    const { count } = await admin().from("students").select("id", { count: "exact", head: true }).eq("full_name", approved!.applicant_name);
    expect(count).toBe(0);
    const ok = await office.rpc("convert_admission", { p_admission_id: approved!.id });
    expect(ok.error).toBeNull();
    const { data: a } = await admin().from("admissions").select("status, student_id").eq("id", approved!.id).single();
    expect(a!.status).toBe("admitted");
    const { data: dues } = await admin().from("student_fee_balances").select("balance").eq("student_id", a!.student_id!);
    expect(dues!.map((d) => Number(d.balance))).toContain(1500);
  });
});
