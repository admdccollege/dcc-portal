import { beforeAll, describe, expect, it } from "vitest";
import { admin, as, id, offeringId, stackAvailable } from "./helpers";
import { computeStudentResult, type GradingRule, type GradingScheme, type SubjectInput } from "@/lib/domain/grading";

const up = await stackAvailable();

describe.skipIf(!up)("examinations, marks and result publication", () => {
  let publishedExam: string;
  let draftResultsExam: string;
  let studentId: string;

  beforeAll(async () => {
    publishedExam = await id("examinations", { name: "Unit Test I" });
    draftResultsExam = await id("examinations", { name: "Internal Assessment I" });
    studentId = await id("students", { email: "student.science@dcc.example" });
  });

  it("database result computation matches the TypeScript grading rules for every seeded result", async () => {
    const a = admin();
    const { data: exam } = await a.from("examinations").select("grading_scheme_id").eq("id", publishedExam).single();
    const [{ data: scheme }, { data: rules }, { data: results }, { data: subjects }, { data: marks }] = await Promise.all([
      a.from("grading_schemes").select("*").eq("id", exam!.grading_scheme_id).single(),
      a.from("grading_rules").select("grade, min_percent, grade_point, is_pass").eq("grading_scheme_id", exam!.grading_scheme_id),
      a.from("results").select("*, result_subjects(course_offering_id, subject_code)").eq("examination_id", publishedExam),
      a.from("examination_subjects").select("id, course_offering_id, component, max_marks, pass_marks, course_offerings(credits, subjects(code, credits))").eq("examination_id", publishedExam),
      a.from("marks").select("examination_subject_id, student_id, status, marks_obtained").in("examination_subject_id", (await a.from("examination_subjects").select("id").eq("examination_id", publishedExam)).data!.map((x) => x.id)),
    ]);
    expect(results!.length).toBeGreaterThan(10);
    const sch = { ...scheme!, subject_pass_percent: scheme!.subject_pass_percent === null ? null : Number(scheme!.subject_pass_percent), aggregate_pass_percent: scheme!.aggregate_pass_percent === null ? null : Number(scheme!.aggregate_pass_percent) } as GradingScheme;
    const rl = rules!.map((r) => ({ ...r, min_percent: Number(r.min_percent), grade_point: r.grade_point === null ? null : Number(r.grade_point) })) as GradingRule[];
    for (const r of results!) {
      const offs = r.result_subjects.map((x) => x.course_offering_id);
      const input: SubjectInput[] = offs.map((o) => {
        const comps = subjects!.filter((s) => s.course_offering_id === o);
        return {
          code: comps[0].course_offerings!.subjects!.code,
          credits: comps[0].course_offerings!.credits ?? comps[0].course_offerings!.subjects!.credits ?? null,
          components: comps.map((c) => {
            const m = marks!.find((x) => x.examination_subject_id === c.id && x.student_id === r.student_id);
            return { component: c.component, max_marks: Number(c.max_marks), pass_marks: c.pass_marks === null ? null : Number(c.pass_marks), mark: m ? { status: m.status, marks_obtained: m.marks_obtained === null ? null : Number(m.marks_obtained) } : null };
          }),
        };
      });
      const ts = computeStudentResult(input, sch, rl);
      expect(ts.status, r.id).toBe(r.status);
      expect(ts.percentage).toBe(r.percentage === null ? null : Number(r.percentage));
      expect(ts.grade).toBe(r.grade);
      expect(ts.failed_subjects).toBe(r.failed_subjects);
      expect(ts.total_obtained).toBe(r.total_obtained === null ? null : Number(r.total_obtained));
    }
  });

  it("students see their own result only after publication", async () => {
    const s = await as("student");
    const { data } = await s.from("results").select("id, examination_id, student_id");
    expect(data?.length).toBe(1);
    expect(data![0].examination_id).toBe(publishedExam);
    expect(data![0].student_id).toBe(studentId);
    // Marks of the unpublished IA exam must be invisible to the student
    const ia = await admin().from("examination_subjects").select("id").eq("examination_id", draftResultsExam);
    const { data: m } = await s.from("marks").select("id").in("examination_subject_id", ia.data!.map((x) => x.id));
    expect(m).toHaveLength(0);
  });

  it("a teacher cannot enter marks for a subject they are not assigned to", async () => {
    const t = await as("history"); // teaches HIS/VAC, not BSc Physics
    const es = await admin().from("examination_subjects").select("id, course_offering_id").eq("examination_id", draftResultsExam).eq("course_offering_id", await offeringId("FYUP-BSC", 1, "PHY-MJ-101")).single();
    const { error } = await t.rpc("save_marks", { p_exam_subject_id: es.data!.id, p_entries: [] });
    expect(error?.code).toBe("42501");
  });

  it("students and accountants cannot modify marks", async () => {
    for (const who of ["student", "accounts"] as const) {
      const c = await as(who);
      const es = await admin().from("examination_subjects").select("id").eq("examination_id", draftResultsExam).limit(1).single();
      const { error } = await c.rpc("save_marks", { p_exam_subject_id: es.data!.id, p_entries: [] });
      expect(error?.code, who).toBe("42501");
      const upd = await c.from("marks").update({ marks_obtained: 1 }).eq("examination_subject_id", es.data!.id).select("id");
      expect(upd.data ?? []).toHaveLength(0);
    }
  });

  it("validates marks against maximum, rejects non-candidates and duplicates", async () => {
    const t = await as("physics");
    const off = await offeringId("FYUP-BSC", 1, "PHY-MJ-101");
    const es = (await admin().from("examination_subjects").select("id, max_marks").eq("examination_id", draftResultsExam).eq("course_offering_id", off).single()).data!;
    const { data: cand } = await admin().from("student_subject_enrolments").select("student_enrolments(student_id)").eq("course_offering_id", off).limit(1).single();
    const sid = cand!.student_enrolments!.student_id;
    let r = await t.rpc("save_marks", { p_exam_subject_id: es.id, p_entries: [{ student_id: sid, marks: Number(es.max_marks) + 1, status: "present" }] });
    expect(r.error?.message).toMatch(/outside/);
    r = await t.rpc("save_marks", { p_exam_subject_id: es.id, p_entries: [{ student_id: sid, marks: 5, status: "present" }, { student_id: sid, marks: 6, status: "present" }] });
    expect(r.error?.message).toMatch(/Duplicate/);
    const outsider = await id("students", { email: "student.arts@dcc.example" });
    r = await t.rpc("save_marks", { p_exam_subject_id: es.id, p_entries: [{ student_id: outsider, marks: 5, status: "present" }] });
    expect(r.error?.message).toMatch(/not candidates/);
    r = await t.rpc("save_marks", { p_exam_subject_id: es.id, p_entries: [{ student_id: sid, marks: 12.5, status: "present" }] });
    expect(r.error).toBeNull();
    const { data: rev } = await admin().from("mark_revisions").select("new_marks").eq("examination_subject_id", es.id).eq("student_id", sid).order("changed_at", { ascending: false }).limit(1).single();
    expect(Number(rev!.new_marks)).toBe(12.5);
  });

  it("missing marks block locking; never silently treated as zero", async () => {
    const ex = await as("exams");
    const { error } = await ex.rpc("transition_examination", { p_exam_id: draftResultsExam, p_to: "marks_locked" });
    expect(error?.message).toMatch(/missing/);
    const p = await ex.rpc("compute_exam_results", { p_exam_id: draftResultsExam });
    expect(p.error?.message).toMatch(/locked/);
  });

  it("an accountant cannot process, approve or publish results", async () => {
    const acc = await as("accounts");
    expect((await acc.rpc("compute_exam_results", { p_exam_id: publishedExam })).error?.code).toBe("42501");
    expect((await acc.rpc("transition_examination", { p_exam_id: publishedExam, p_to: "published" })).error?.code).toBe("42501");
  });

  it("published results are immutable and cannot be re-processed", async () => {
    const ex = await as("exams");
    expect((await ex.rpc("compute_exam_results", { p_exam_id: publishedExam })).error).not.toBeNull();
    const del = await admin().from("results").delete().eq("examination_id", publishedExam);
    expect(del.error?.message).toMatch(/cannot be modified/);
    const upd = await admin().from("examinations").update({ name: "Tampered" }).eq("id", publishedExam);
    expect(upd.error?.message).toMatch(/published examination cannot be modified/);
  });

  it("full workflow: absent candidates, lock, process, approval required before publication", async () => {
    const a = admin();
    const ex = await as("exams");
    const principal = await as("principal");
    // A small exam for FYUP-BA Sem 3 (one subject)
    const off = await offeringId("FYUP-BA", 3, "ENG-MJ-301");
    const { data: o } = await a.from("course_offerings").select("academic_session_id, programme_id, term_id").eq("id", off).single();
    const { data: type } = await a.from("examination_types").select("id").eq("code", "UT").single();
    const { data: prog } = await a.from("programmes").select("grading_scheme_id").eq("id", o!.programme_id).single();
    const { data: exam, error: e1 } = await ex.from("examinations").insert({ ...o!, examination_type_id: type!.id, grading_scheme_id: prog!.grading_scheme_id!, name: `Workflow test ${Date.now()}` }).select("id").single();
    expect(e1).toBeNull();
    const examId = exam!.id;
    const { data: es } = await ex.from("examination_subjects").insert({ examination_id: examId, course_offering_id: off, component: "theory", max_marks: 50, pass_marks: 20 }).select("id").single();
    expect((await ex.rpc("transition_examination", { p_exam_id: examId, p_to: "marks_entry" })).error).toBeNull();
    const { data: cands } = await a.from("student_subject_enrolments").select("student_enrolments!inner(student_id)").eq("course_offering_id", off);
    const ids = cands!.map((c) => c.student_enrolments.student_id);
    expect(ids.length).toBeGreaterThan(2);
    const entries = ids.map((sid, i) => (i === 0 ? { student_id: sid, status: "absent", marks: null } : { student_id: sid, status: "present", marks: i === 1 ? 10 : 35 }));
    expect((await ex.rpc("save_marks", { p_exam_subject_id: es!.id, p_entries: entries })).error).toBeNull();
    expect((await ex.rpc("transition_examination", { p_exam_id: examId, p_to: "marks_locked" })).error).toBeNull();
    // Locked: no more changes
    expect((await ex.rpc("save_marks", { p_exam_subject_id: es!.id, p_entries: [{ student_id: ids[2], status: "present", marks: 1 }] })).error?.message).toMatch(/not open/);
    expect((await ex.rpc("compute_exam_results", { p_exam_id: examId })).data).toBe(ids.length);
    const { data: res } = await a.from("results").select("student_id, status, percentage").eq("examination_id", examId);
    expect(res!.find((r) => r.student_id === ids[0])!.status).toBe("absent");
    expect(res!.find((r) => r.student_id === ids[1])!.status).toBe("fail");
    expect(res!.find((r) => r.student_id === ids[2])!.status).toBe("pass");
    // Publication requires approval first; exam controller cannot approve
    expect((await ex.rpc("transition_examination", { p_exam_id: examId, p_to: "published" })).error?.message).toMatch(/approved/);
    expect((await ex.rpc("transition_examination", { p_exam_id: examId, p_to: "results_approved" })).error?.code).toBe("42501");
    expect((await principal.rpc("transition_examination", { p_exam_id: examId, p_to: "results_approved" })).error).toBeNull();
    expect((await principal.rpc("transition_examination", { p_exam_id: examId, p_to: "published" })).error?.code).toBe("42501");
    expect((await ex.rpc("transition_examination", { p_exam_id: examId, p_to: "published" })).error).toBeNull();
    // Withdrawal requires results.unpublish (super admin) and a reason
    expect((await ex.rpc("transition_examination", { p_exam_id: examId, p_to: "results_processed", p_reason: "test" })).error?.code).toBe("42501");
    const sup = await as("super");
    expect((await sup.rpc("transition_examination", { p_exam_id: examId, p_to: "results_processed" })).error?.message).toMatch(/reason/);
  });

  it("public verification returns minimal data for published results only", async () => {
    const a = admin();
    const { data: pub } = await a.from("results").select("verification_code").eq("examination_id", publishedExam).limit(1).single();
    const { data } = await (await import("./helpers")).anon().rpc("verify_result", { p_code: pub!.verification_code });
    expect(data).toHaveLength(1);
    expect(Object.keys(data![0]).sort()).toEqual(["academic_session", "admission_no", "examination", "is_provisional", "percentage", "programme", "published_at", "result_status", "student_name", "term"].sort());
    const bad = await (await import("./helpers")).anon().rpc("verify_result", { p_code: "NOTAREALCODE" });
    expect(bad.data).toHaveLength(0);
  });
});
