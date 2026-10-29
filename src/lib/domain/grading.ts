/**
 * Result computation rules — TypeScript mirror of public.compute_exam_results().
 *
 * The database function is authoritative (results are only ever stored by it).
 * This module powers live previews in the marks-entry screen and is unit
 * tested; an integration test asserts both implementations agree.
 */

export type MarkStatus = "present" | "absent" | "exempted" | "malpractice" | "withheld";
export type SubjectStatus = "pass" | "fail" | "absent" | "exempted" | "withheld" | "incomplete";
export type ResultStatus = "pass" | "fail" | "compartment" | "absent" | "withheld" | "incomplete";

export type GradingScheme = {
  subject_pass_percent: number | null;
  aggregate_pass_percent: number | null;
  require_component_pass: boolean;
  require_all_subjects_pass: boolean;
  max_failed_subjects_for_compartment: number;
  use_grade_points: boolean;
  use_credits: boolean;
  decimals: number;
};

export type GradingRule = { grade: string; min_percent: number; grade_point: number | null; is_pass: boolean };

export type ComponentInput = {
  component: string;
  max_marks: number;
  pass_marks: number | null;
  /** undefined/null mark = missing (no record). Never treated as zero. */
  mark: { status: MarkStatus; marks_obtained: number | null } | null;
};

export type SubjectInput = { code: string; credits: number | null; components: ComponentInput[] };

export type SubjectResult = {
  code: string;
  max: number | null;
  obtained: number | null;
  percentage: number | null;
  grade: string | null;
  grade_point: number | null;
  is_pass: boolean | null;
  status: SubjectStatus;
};

export type StudentResult = {
  total_max: number | null;
  total_obtained: number | null;
  percentage: number | null;
  grade: string | null;
  grade_point: number | null;
  credits_earned: number | null;
  failed_subjects: number;
  status: ResultStatus;
  subjects: SubjectResult[];
};

export function round(value: number, decimals: number): number {
  // Postgres numeric round(): half away from zero
  const f = 10 ** decimals;
  return (Math.sign(value) * Math.round(Math.abs(value) * f + Number.EPSILON)) / f;
}

/** Highest passing rule whose min_percent ≤ pct, or the lowest failing rule. */
export function gradeFor(rules: GradingRule[], pct: number, pass: boolean): GradingRule | null {
  if (pass) {
    return [...rules].filter((r) => r.is_pass && r.min_percent <= pct).sort((a, b) => b.min_percent - a.min_percent)[0] ?? null;
  }
  return [...rules].filter((r) => !r.is_pass).sort((a, b) => a.min_percent - b.min_percent)[0] ?? null;
}

export function computeSubject(subject: SubjectInput, scheme: GradingScheme, rules: GradingRule[]): SubjectResult {
  let max = 0;
  let obtained = 0;
  let threshold = 0;
  let componentsOk = true;
  let anyPresent = false;
  let allExempt = true;
  let withheld = false;
  let incomplete = false;

  for (const c of subject.components) {
    if (!c.mark) {
      incomplete = true;
      continue;
    }
    if (c.mark.status === "exempted") continue;
    allExempt = false;
    if (c.mark.status === "malpractice" || c.mark.status === "withheld") withheld = true;
    max += c.max_marks;
    threshold += c.pass_marks ?? 0;
    if (c.mark.status === "present") {
      if (c.mark.marks_obtained === null) {
        incomplete = true; // a "present" mark without a value is invalid → incomplete
        continue;
      }
      anyPresent = true;
      obtained += c.mark.marks_obtained;
      if (c.pass_marks !== null && c.mark.marks_obtained < c.pass_marks) componentsOk = false;
    } else {
      componentsOk = false; // absent/withheld component cannot be passed
    }
  }

  const base = { code: subject.code };
  if (incomplete) {
    return { ...base, max, obtained, percentage: null, grade: null, grade_point: null, is_pass: null, status: "incomplete" };
  }
  if (allExempt) {
    return { ...base, max: null, obtained: null, percentage: null, grade: null, grade_point: null, is_pass: null, status: "exempted" };
  }

  const pct = round((100 * obtained) / max, scheme.decimals);
  let pass: boolean;
  let status: SubjectStatus;
  if (withheld) {
    pass = false;
    status = "withheld";
  } else {
    pass =
      (!scheme.require_component_pass || componentsOk) &&
      (scheme.subject_pass_percent !== null ? pct >= scheme.subject_pass_percent : obtained >= threshold);
    if (!anyPresent) pass = false;
    status = !anyPresent ? "absent" : pass ? "pass" : "fail";
  }
  const g = gradeFor(rules, pct, pass);
  return { ...base, max, obtained, percentage: pct, grade: g?.grade ?? null, grade_point: g?.grade_point ?? null, is_pass: pass, status };
}

export function computeStudentResult(subjects: SubjectInput[], scheme: GradingScheme, rules: GradingRule[]): StudentResult {
  const results = subjects.map((s) => computeSubject(s, scheme, rules));
  let tMax = 0, tObt = 0, failed = 0, counted = 0, gpSum = 0, creditSum = 0, creditsEarned = 0;
  let anyPresent = false, withheld = false, incomplete = false;
  const gps: number[] = [];

  results.forEach((r, i) => {
    const credits = subjects[i].credits;
    if (r.status === "incomplete") { incomplete = true; return; }
    if (r.status === "exempted") return;
    if (r.status === "withheld") withheld = true;
    if (!r.is_pass) failed += 1;
    if (r.status !== "absent" && r.status !== "withheld") anyPresent = true;
    // A withheld subject still contributes when any of its components was present
    if (r.status === "withheld") {
      const comp = subjects[i].components;
      if (comp.some((c) => c.mark?.status === "present")) anyPresent = true;
    }
    tMax += r.max ?? 0;
    tObt += r.obtained ?? 0;
    counted += 1;
    if (r.grade_point !== null) {
      gps.push(r.grade_point);
      if (credits && credits > 0) { gpSum += r.grade_point * credits; creditSum += credits; }
    }
    if (r.is_pass && credits !== null) creditsEarned += credits;
  });

  const pct = counted > 0 ? round((100 * tObt) / tMax, scheme.decimals) : null;
  const aggOk = scheme.aggregate_pass_percent === null || (pct !== null && pct >= scheme.aggregate_pass_percent);

  let status: ResultStatus;
  if (incomplete) status = "incomplete";
  else if (withheld) status = "withheld";
  else if (counted > 0 && !anyPresent) status = "absent";
  else if (counted === 0) status = "incomplete";
  else if ((failed === 0 || !scheme.require_all_subjects_pass) && aggOk) status = "pass";
  else if (failed >= 1 && failed <= scheme.max_failed_subjects_for_compartment && aggOk) status = "compartment";
  else status = "fail";

  let grade: string | null = null;
  let gp: number | null = null;
  if (pct !== null && (status === "pass" || status === "fail" || status === "compartment")) {
    grade = gradeFor(rules, pct, status === "pass")?.grade ?? null;
    if (scheme.use_grade_points) {
      if (scheme.use_credits && creditSum > 0) gp = round(gpSum / creditSum, 2);
      else if (gps.length > 0) gp = round(gps.reduce((a, b) => a + b, 0) / gps.length, 2);
    }
  }

  return {
    total_max: counted > 0 ? tMax : null,
    total_obtained: counted > 0 ? tObt : null,
    percentage: status === "incomplete" ? null : pct,
    grade,
    grade_point: gp,
    credits_earned: scheme.use_credits ? creditsEarned : null,
    failed_subjects: failed,
    status,
    subjects: results,
  };
}

/** Validates a single marks-entry cell. Returns an error message or null. */
export function validateMark(value: string, maxMarks: number): string | null {
  const v = value.trim();
  if (v === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return "Enter a number with up to 2 decimals";
  const n = Number(v);
  if (n < 0) return "Marks cannot be negative";
  if (n > maxMarks) return `Maximum is ${maxMarks}`;
  return null;
}
