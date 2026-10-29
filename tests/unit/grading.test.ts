import { describe, expect, it } from "vitest";
import {
  computeStudentResult, computeSubject, gradeFor, validateMark, type GradingRule, type GradingScheme, type SubjectInput,
} from "@/lib/domain/grading";

const hsScheme: GradingScheme = {
  subject_pass_percent: 30, aggregate_pass_percent: 30, require_component_pass: true, require_all_subjects_pass: true,
  max_failed_subjects_for_compartment: 2, use_grade_points: false, use_credits: false, decimals: 2,
};
const hsRules: GradingRule[] = [
  { grade: "A+", min_percent: 90, grade_point: null, is_pass: true },
  { grade: "A", min_percent: 75, grade_point: null, is_pass: true },
  { grade: "B", min_percent: 60, grade_point: null, is_pass: true },
  { grade: "C", min_percent: 45, grade_point: null, is_pass: true },
  { grade: "D", min_percent: 30, grade_point: null, is_pass: true },
  { grade: "F", min_percent: 0, grade_point: null, is_pass: false },
];
const ugScheme: GradingScheme = { ...hsScheme, subject_pass_percent: 40, aggregate_pass_percent: null, max_failed_subjects_for_compartment: 0, use_grade_points: true, use_credits: true };
const ugRules: GradingRule[] = [
  { grade: "O", min_percent: 90, grade_point: 10, is_pass: true },
  { grade: "A", min_percent: 70, grade_point: 8, is_pass: true },
  { grade: "B", min_percent: 50, grade_point: 6, is_pass: true },
  { grade: "P", min_percent: 40, grade_point: 4, is_pass: true },
  { grade: "F", min_percent: 0, grade_point: 0, is_pass: false },
];

const theory = (marks: number | null, status: "present" | "absent" | "exempted" | "withheld" = "present", max = 100, pass = 30) => ({
  component: "theory", max_marks: max, pass_marks: pass, mark: { status, marks_obtained: status === "present" ? marks : null },
});
const missing = (max = 100) => ({ component: "theory", max_marks: max, pass_marks: 30, mark: null });
const subj = (code: string, ...components: SubjectInput["components"]): SubjectInput => ({ code, credits: 4, components });

describe("gradeFor", () => {
  it("picks the highest passing band at or below the percentage", () => {
    expect(gradeFor(hsRules, 92, true)?.grade).toBe("A+");
    expect(gradeFor(hsRules, 75, true)?.grade).toBe("A");
    expect(gradeFor(hsRules, 74.99, true)?.grade).toBe("B");
    expect(gradeFor(hsRules, 30, true)?.grade).toBe("D");
  });
  it("returns the failing grade when not passed, regardless of percentage", () => {
    expect(gradeFor(hsRules, 80, false)?.grade).toBe("F");
  });
});

describe("computeSubject", () => {
  it("passes a subject meeting the pass percentage and component pass marks", () => {
    const r = computeSubject(subj("ENG", theory(62)), hsScheme, hsRules);
    expect(r).toMatchObject({ status: "pass", is_pass: true, percentage: 62, grade: "B" });
  });

  it("fails when a component is below its pass marks even if the total is high", () => {
    const r = computeSubject(
      subj("PHY", theory(48, "present", 50, 15), { component: "practical", max_marks: 20, pass_marks: 6, mark: { status: "present", marks_obtained: 5 } }),
      hsScheme, hsRules,
    );
    expect(r.percentage).toBe(75.71);
    expect(r.is_pass).toBe(false);
    expect(r.status).toBe("fail");
    expect(r.grade).toBe("F");
  });

  it("marks missing marks as incomplete — never as zero", () => {
    const r = computeSubject(subj("CHE", missing()), hsScheme, hsRules);
    expect(r.status).toBe("incomplete");
    expect(r.percentage).toBeNull();
    expect(r.is_pass).toBeNull();
  });

  it("treats an absent candidate as absent (not passed) with 0 obtained", () => {
    const r = computeSubject(subj("MAT", theory(null, "absent")), hsScheme, hsRules);
    expect(r).toMatchObject({ status: "absent", is_pass: false, obtained: 0, max: 100 });
  });

  it("excludes exempted components from max and obtained", () => {
    const r = computeSubject(
      subj("BIO", theory(40, "present", 50, 15), { component: "practical", max_marks: 50, pass_marks: 15, mark: { status: "exempted", marks_obtained: null } }),
      hsScheme, hsRules,
    );
    expect(r).toMatchObject({ max: 50, obtained: 40, percentage: 80, status: "pass" });
  });

  it("is exempted when every component is exempted", () => {
    const r = computeSubject(subj("PE", theory(null, "exempted")), hsScheme, hsRules);
    expect(r.status).toBe("exempted");
  });

  it("uses the sum of component pass marks when no subject percentage is configured", () => {
    const scheme = { ...hsScheme, subject_pass_percent: null, require_component_pass: false };
    const comps = [theory(20, "present", 50, 15), { component: "practical", max_marks: 50, pass_marks: 15, mark: { status: "present" as const, marks_obtained: 12 } }];
    expect(computeSubject(subj("X", ...comps), scheme, hsRules).is_pass).toBe(true); // 32 >= 30
    comps[0] = theory(17, "present", 50, 15);
    expect(computeSubject(subj("X", ...comps), scheme, hsRules).is_pass).toBe(false); // 29 < 30
  });

  it("withholds the subject on malpractice", () => {
    const r = computeSubject(subj("ENG", theory(null, "withheld")), hsScheme, hsRules);
    expect(r.status).toBe("withheld");
  });
});

describe("computeStudentResult", () => {
  it("passes when all subjects pass and aggregate is met", () => {
    const r = computeStudentResult([subj("A", theory(70)), subj("B", theory(80))], hsScheme, hsRules);
    expect(r).toMatchObject({ status: "pass", total_max: 200, total_obtained: 150, percentage: 75, grade: "A", failed_subjects: 0 });
  });

  it("gives compartment for 1–2 failed subjects when configured", () => {
    const r = computeStudentResult([subj("A", theory(20)), subj("B", theory(80)), subj("C", theory(70))], hsScheme, hsRules);
    expect(r.status).toBe("compartment");
    expect(r.failed_subjects).toBe(1);
  });

  it("fails when failed subjects exceed the compartment limit", () => {
    const r = computeStudentResult([subj("A", theory(10)), subj("B", theory(10)), subj("C", theory(10))], hsScheme, hsRules);
    expect(r.status).toBe("fail");
    expect(r.grade).toBe("F");
  });

  it("is incomplete if any subject is missing marks, with no percentage", () => {
    const r = computeStudentResult([subj("A", theory(90)), subj("B", missing())], hsScheme, hsRules);
    expect(r.status).toBe("incomplete");
    expect(r.percentage).toBeNull();
  });

  it("is absent when absent in every subject", () => {
    const r = computeStudentResult([subj("A", theory(null, "absent")), subj("B", theory(null, "absent"))], hsScheme, hsRules);
    expect(r.status).toBe("absent");
  });

  it("computes credit-weighted SGPA for UG", () => {
    const subjects: SubjectInput[] = [
      { code: "M1", credits: 4, components: [theory(92, "present", 100, 40)] }, // O 10
      { code: "M2", credits: 2, components: [theory(55, "present", 100, 40)] }, // B 6
    ];
    const r = computeStudentResult(subjects, ugScheme, ugRules);
    expect(r.status).toBe("pass");
    expect(r.grade_point).toBe(8.67); // (10*4 + 6*2) / 6
    expect(r.credits_earned).toBe(6);
  });

  it("fails UG when any course fails (no compartment configured)", () => {
    const subjects: SubjectInput[] = [
      { code: "M1", credits: 4, components: [theory(92, "present", 100, 40)] },
      { code: "M2", credits: 4, components: [theory(35, "present", 100, 40)] },
    ];
    const r = computeStudentResult(subjects, ugScheme, ugRules);
    expect(r.status).toBe("fail");
    expect(r.credits_earned).toBe(4);
  });

  it("applies the aggregate pass percentage", () => {
    const scheme = { ...hsScheme, subject_pass_percent: 30, aggregate_pass_percent: 50 };
    const r = computeStudentResult([subj("A", theory(40)), subj("B", theory(45))], scheme, hsRules);
    expect(r.status).toBe("fail");
  });
});

describe("validateMark", () => {
  it("accepts blank and valid numbers", () => {
    expect(validateMark("", 50)).toBeNull();
    expect(validateMark("45.5", 50)).toBeNull();
    expect(validateMark("50", 50)).toBeNull();
  });
  it("rejects values above maximum, negatives and bad formats", () => {
    expect(validateMark("51", 50)).toMatch(/Maximum/);
    expect(validateMark("-1", 50)).not.toBeNull();
    expect(validateMark("12.345", 50)).not.toBeNull();
    expect(validateMark("abc", 50)).not.toBeNull();
  });
});
