"use server";

import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { z } from "zod";
import { createAction, ActionError, check } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { createStudentSchema, updateStudentSchema } from "@/lib/validation/student";
import { reason, uuid } from "@/lib/validation/common";
import { IMPORT_COLUMNS, normaliseHeader, validateImport, type ImportRow, type RowIssue } from "@/lib/domain/student-import";
import { todayIST } from "@/lib/utils";

export const createStudent = createAction(createStudentSchema, { permission: "students.manage" }, async (input) => {
  const supabase = await createClient();
  const id = check(
    await supabase.rpc("create_student", {
      p_student: {
        full_name: input.full_name, date_of_birth: input.date_of_birth, gender: input.gender, phone: input.phone,
        email: input.email, address: input.address, admission_no: input.admission_no,
        university_roll_no: input.university_roll_no, registration_no: input.registration_no,
        admission_date: input.admission_date, scholarship_note: input.scholarship_note,
      },
      p_guardian: { name: input.guardian_name, relationship: input.guardian_relationship, phone: input.guardian_phone, email: input.guardian_email },
      p_enrolment: { academic_session_id: input.academic_session_id, programme_id: input.programme_id, term_id: input.term_id, roll_no: input.roll_no, section: input.section },
      p_offering_ids: input.offering_ids,
    }),
  );
  revalidatePath("/students");
  return id as string;
});

export const updateStudent = createAction(updateStudentSchema, { permission: "students.manage" }, async (input) => {
  const supabase = await createClient();
  const { id, guardian_name, guardian_relationship, guardian_phone, guardian_email, admission_no, ...rest } = input;
  const update = {
    ...rest,
    phone: rest.phone ?? null, email: rest.email ?? null, address: rest.address ?? null,
    university_roll_no: rest.university_roll_no ?? null, registration_no: rest.registration_no ?? null,
    scholarship_note: rest.scholarship_note ?? null,
    ...(rest.admission_date ? { admission_date: rest.admission_date } : {}),
    ...(admission_no ? { admission_no } : {}),
  };
  const res = check(await supabase.from("students").update(update).eq("id", id).select("id"));
  if (!res?.length) throw new ActionError("Student not found or you are not allowed to edit it.");

  if (guardian_name) {
    const { data: g } = await supabase.from("student_guardians").select("id").eq("student_id", id).eq("is_primary", true).maybeSingle();
    const row = { name: guardian_name, relationship: guardian_relationship ?? "Guardian", phone: guardian_phone ?? null, email: guardian_email ?? null };
    if (g) check(await supabase.from("student_guardians").update(row).eq("id", g.id));
    else check(await supabase.from("student_guardians").insert({ ...row, student_id: id, is_primary: true }));
  }
  revalidatePath(`/students/${id}`);
  return id;
});

export const changeStudentStatus = createAction(
  z.object({ student_id: uuid, event: z.enum(["withdrawn", "transferred", "suspended", "reinstated", "archived"]), reason, effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  { permission: "students.manage" },
  async (input) => {
    const supabase = await createClient();
    check(await supabase.rpc("change_student_status", { p_student_id: input.student_id, p_event: input.event, p_reason: input.reason, p_effective_date: input.effective_date }));
    revalidatePath(`/students/${input.student_id}`);
    return null;
  },
);

export const setStudentSubjects = createAction(
  z.object({ enrolment_id: uuid, offering_ids: z.array(z.guid()).max(30), student_id: uuid }),
  { permission: "students.manage" },
  async (input) => {
    const supabase = await createClient();
    check(await supabase.rpc("set_student_subjects", { p_enrolment_id: input.enrolment_id, p_offering_ids: input.offering_ids }));
    revalidatePath(`/students/${input.student_id}`);
    return null;
  },
);

export const promoteStudents = createAction(
  z.object({ enrolment_ids: z.array(z.guid()).min(1, "Select at least one student").max(500), target_session_id: uuid, action: z.enum(["promote", "repeat", "graduate"]), reason: z.string().trim().max(300).optional() }),
  { permission: "students.promote" },
  async (input) => {
    const supabase = await createClient();
    const n = check(await supabase.rpc("promote_students", { p_enrolment_ids: input.enrolment_ids, p_target_session_id: input.target_session_id, p_action: input.action, p_reason: input.reason ?? undefined }));
    revalidatePath("/students");
    return n as number;
  },
);

// ---------------------------------------------------------------------------
// Bulk import
// ---------------------------------------------------------------------------
const MAX_FILE = 2 * 1024 * 1024;

async function parseFile(file: File): Promise<ImportRow[]> {
  if (file.size === 0) throw new ActionError("The file is empty.");
  if (file.size > MAX_FILE) throw new ActionError("The file is larger than 2 MB.");
  const name = file.name.toLowerCase();
  const allowed = new Set<string>(IMPORT_COLUMNS);
  const pick = (rec: Record<string, unknown>) => {
    const row: ImportRow = {};
    for (const [k, v] of Object.entries(rec)) {
      const key = normaliseHeader(k);
      if (allowed.has(key)) row[key as keyof ImportRow] = v === null || v === undefined ? "" : String(v);
    }
    return row;
  };
  if (name.endsWith(".csv")) {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy" });
    if (parsed.errors.length && !parsed.data.length) throw new ActionError("Could not read the CSV file.");
    return parsed.data.map(pick);
  }
  if (name.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws) throw new ActionError("The workbook has no sheets.");
    const headers: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => (headers[col] = String(cell.text ?? "")));
    const rows: ImportRow[] = [];
    ws.eachRow((row, idx) => {
      if (idx === 1) return;
      const rec: Record<string, string> = {};
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        const v = cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : String(cell.text ?? "");
        if (headers[col]) rec[headers[col]] = v;
      });
      if (Object.values(rec).some((v) => v.trim())) rows.push(pick(rec));
    });
    return rows;
  }
  throw new ActionError("Upload a .csv or .xlsx file.");
}

async function existingKeys(supabase: Awaited<ReturnType<typeof createClient>>, sessionId: string, programmeId: string, termId: string, rows: ImportRow[]) {
  const vals = (k: keyof ImportRow) => [...new Set(rows.map((r) => (r[k] ?? "").trim()).filter(Boolean))].slice(0, 2000);
  const [adm, ur, reg, roll, names] = await Promise.all([
    vals("admission_no").length ? supabase.from("students").select("admission_no").in("admission_no", vals("admission_no")) : { data: [] },
    vals("university_roll_no").length ? supabase.from("students").select("university_roll_no").in("university_roll_no", vals("university_roll_no")) : { data: [] },
    vals("registration_no").length ? supabase.from("students").select("registration_no").in("registration_no", vals("registration_no")) : { data: [] },
    supabase.from("student_enrolments").select("roll_no").eq("academic_session_id", sessionId).eq("programme_id", programmeId).eq("term_id", termId).eq("status", "active").not("roll_no", "is", null),
    supabase.from("students").select("full_name, date_of_birth").in("full_name", vals("full_name").map((n) => n.replace(/\s+/g, " "))),
  ]);
  const lower = (xs: (string | null)[]) => new Set(xs.filter((x): x is string => !!x).map((x) => x.toLowerCase()));
  return {
    admissionNos: lower((adm.data ?? []).map((r: { admission_no: string }) => r.admission_no)),
    universityRollNos: lower((ur.data ?? []).map((r: { university_roll_no: string | null }) => r.university_roll_no)),
    registrationNos: lower((reg.data ?? []).map((r: { registration_no: string | null }) => r.registration_no)),
    rollNos: lower((roll.data ?? []).map((r) => r.roll_no)),
    nameDob: new Set((names.data ?? []).map((r) => `${r.full_name.toLowerCase()}|${r.date_of_birth}`)),
  };
}

const importTarget = z.object({ academic_session_id: uuid, programme_id: uuid, term_id: uuid, commit: z.boolean() });

export type ImportPreview = { total: number; validCount: number; issues: RowIssue[]; sample: Record<string, string | null>[]; imported?: number };

export async function importStudents(formData: FormData) {
  const run = createAction(
    importTarget,
    { permission: ["students.import"], rateLimitPerMinute: 10 },
    async (target): Promise<ImportPreview> => {
      const file = formData.get("file");
      if (!(file instanceof File)) throw new ActionError("Choose a file to upload.");
      const rows = await parseFile(file);
      const supabase = await createClient();
      const keys = await existingKeys(supabase, target.academic_session_id, target.programme_id, target.term_id, rows);
      const result = validateImport(rows, keys, todayIST());
      const preview: ImportPreview = {
        total: rows.length,
        validCount: result.valid.length,
        issues: result.issues.slice(0, 200),
        sample: result.valid.slice(0, 5).map((r) => ({ full_name: r.full_name, date_of_birth: r.date_of_birth, gender: r.gender, roll_no: r.roll_no, admission_no: r.admission_no })),
      };
      if (!target.commit) return preview;
      if (!result.ok) throw new ActionError("Fix all reported problems before importing. Nothing was saved.");
      const n = check(await supabase.rpc("import_students", {
        p_rows: result.valid, p_academic_session_id: target.academic_session_id, p_programme_id: target.programme_id, p_term_id: target.term_id,
      }));
      revalidatePath("/students");
      return { ...preview, imported: n as number };
    },
  );
  return run({
    academic_session_id: String(formData.get("academic_session_id") ?? ""),
    programme_id: String(formData.get("programme_id") ?? ""),
    term_id: String(formData.get("term_id") ?? ""),
    commit: formData.get("commit") === "true",
  });
}
