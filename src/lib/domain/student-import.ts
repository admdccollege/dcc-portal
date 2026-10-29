/**
 * Validation for bulk student import (CSV / Excel rows).
 * Nothing is written until every row validates; duplicates within the file and
 * against existing records are reported row-by-row.
 */
import { z } from "zod";

export const IMPORT_COLUMNS = [
  "full_name", "date_of_birth", "gender", "phone", "email", "address",
  "guardian_name", "guardian_relationship", "guardian_phone",
  "admission_no", "university_roll_no", "registration_no", "roll_no", "admission_date",
] as const;
export const REQUIRED_COLUMNS = ["full_name", "date_of_birth"] as const;

export type ImportRow = Partial<Record<(typeof IMPORT_COLUMNS)[number], string>>;

export type ValidRow = {
  full_name: string;
  date_of_birth: string;
  gender: "female" | "male" | "other" | "undisclosed";
  phone: string | null;
  email: string | null;
  address: string | null;
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_phone: string | null;
  admission_no: string | null;
  university_roll_no: string | null;
  registration_no: string | null;
  roll_no: string | null;
  admission_date: string | null;
};

export type RowIssue = { row: number; field: string; message: string };

export type ExistingKeys = {
  admissionNos: Set<string>;
  universityRollNos: Set<string>;
  registrationNos: Set<string>;
  rollNos: Set<string>;          // roll numbers already used in the target class
  nameDob: Set<string>;          // `${lower(name)}|${dob}`
};

/** Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY. Returns ISO or null. */
export function parseDate(input: string | undefined | null): string | null {
  const v = (input ?? "").trim();
  if (!v) return null;
  let y: number, m: number, d: number;
  let match = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const GENDERS: Record<string, ValidRow["gender"]> = {
  f: "female", female: "female", m: "male", male: "male", o: "other", other: "other",
  "": "undisclosed", undisclosed: "undisclosed", "prefer not to say": "undisclosed",
};

const phoneRe = /^\+?[0-9][0-9\s-]{6,18}$/;
const emailSchema = z.email();

export function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z_]/g, "");
}

export function validateImport(rows: ImportRow[], existing: ExistingKeys, today: string) {
  const issues: RowIssue[] = [];
  const valid: ValidRow[] = [];
  const seen = { admission: new Map<string, number>(), uroll: new Map<string, number>(), reg: new Map<string, number>(), roll: new Map<string, number>(), email: new Map<string, number>(), nameDob: new Map<string, number>() };

  if (rows.length === 0) issues.push({ row: 0, field: "file", message: "The file contains no data rows" });
  if (rows.length > 2000) issues.push({ row: 0, field: "file", message: "At most 2000 rows can be imported at once" });

  rows.forEach((raw, idx) => {
    const rowNo = idx + 2; // +1 header, +1 one-based
    const t = (k: keyof ImportRow) => (raw[k] ?? "").toString().trim();
    const nul = (k: keyof ImportRow) => t(k) || null;
    const add = (field: string, message: string) => issues.push({ row: rowNo, field, message });
    const before = issues.length;

    const name = t("full_name").replace(/\s+/g, " ");
    if (name.length < 2) add("full_name", "Name is required");
    if (name.length > 120) add("full_name", "Name is too long");

    const dob = parseDate(t("date_of_birth"));
    if (!dob) add("date_of_birth", "Invalid or missing date (use YYYY-MM-DD or DD/MM/YYYY)");
    else if (dob >= today || dob < "1950-01-01") add("date_of_birth", "Date of birth is out of range");

    const genderKey = t("gender").toLowerCase();
    const gender = GENDERS[genderKey];
    if (gender === undefined) add("gender", `Unknown gender "${t("gender")}" (use Female/Male/Other or leave blank)`);

    for (const f of ["phone", "guardian_phone"] as const) {
      if (t(f) && !phoneRe.test(t(f))) add(f, "Invalid phone number");
    }
    const email = t("email").toLowerCase();
    if (email && !emailSchema.safeParse(email).success) add("email", "Invalid email address");

    const admDate = t("admission_date") ? parseDate(t("admission_date")) : null;
    if (t("admission_date") && !admDate) add("admission_date", "Invalid date");

    const checkDup = (field: string, value: string | null, map: Map<string, number>, existingSet: Set<string> | null, label: string) => {
      if (!value) return;
      const key = value.toLowerCase();
      if (map.has(key)) add(field, `Duplicate ${label} (also on row ${map.get(key)})`);
      else map.set(key, rowNo);
      if (existingSet?.has(key)) add(field, `${label} already exists in the system`);
    };
    checkDup("admission_no", nul("admission_no"), seen.admission, existing.admissionNos, "admission number");
    checkDup("university_roll_no", nul("university_roll_no"), seen.uroll, existing.universityRollNos, "university roll number");
    checkDup("registration_no", nul("registration_no"), seen.reg, existing.registrationNos, "registration number");
    checkDup("roll_no", nul("roll_no"), seen.roll, existing.rollNos, "roll number");
    checkDup("email", email || null, seen.email, null, "email");
    if (name && dob) checkDup("full_name", `${name.toLowerCase()}|${dob}`, seen.nameDob, existing.nameDob, "student (same name and date of birth)");

    if (issues.length === before && dob && gender !== undefined) {
      valid.push({
        full_name: name, date_of_birth: dob, gender, phone: nul("phone"), email: email || null, address: nul("address"),
        guardian_name: nul("guardian_name"), guardian_relationship: nul("guardian_relationship"), guardian_phone: nul("guardian_phone"),
        admission_no: nul("admission_no"), university_roll_no: nul("university_roll_no"), registration_no: nul("registration_no"),
        roll_no: nul("roll_no"), admission_date: admDate,
      });
    }
  });

  return { valid, issues, ok: issues.length === 0 };
}
