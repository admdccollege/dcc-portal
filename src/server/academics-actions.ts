"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, check, ActionError } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { isoDate, optionalText, requiredText } from "@/lib/validation/common";

const optUuid = z.union([z.guid(), z.literal("")]).optional().transform((v) => (v ? v : null));
const bool = z.union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("")]).optional().transform((v) => v === true || v === "true");
const optNum = z.union([z.coerce.number(), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : Number(v)));

function done(path: string) {
  revalidatePath(path);
  return null;
}

// Academic sessions --------------------------------------------------------
const sessionSchema = z.object({
  id: optUuid,
  name: requiredText("Name", 20).regex(/^\d{4}-\d{2}$/, "Use the format 2026-27"),
  start_date: isoDate,
  end_date: isoDate,
  status: z.enum(["active", "inactive"]).default("active"),
}).refine((v) => v.end_date > v.start_date, { message: "End date must be after start date", path: ["end_date"] });

export const saveSession = createAction(sessionSchema, { permission: "academics.manage" }, async ({ id, ...v }) => {
  const supabase = await createClient();
  if (id) check(await supabase.from("academic_sessions").update(v).eq("id", id));
  else check(await supabase.from("academic_sessions").insert(v));
  return done("/academics");
});

export const setCurrentSession = createAction(z.object({ id: z.guid() }), { permission: "academics.manage" }, async ({ id }) => {
  const supabase = await createClient();
  check(await supabase.from("academic_sessions").update({ is_current: false }).eq("is_current", true));
  check(await supabase.from("academic_sessions").update({ is_current: true }).eq("id", id));
  revalidatePath("/", "layout");
  return null;
});

// Programmes ---------------------------------------------------------------
const programmeSchema = z.object({
  id: optUuid,
  code: requiredText("Code", 20).regex(/^[A-Z0-9-]+$/, "Use capital letters, digits and hyphens"),
  name: requiredText("Name", 120),
  level: z.enum(["higher_secondary", "undergraduate", "postgraduate"]),
  stream: optionalText(40),
  term_kind: z.enum(["class", "semester"]),
  total_terms: z.coerce.number().int().min(1).max(12),
  awarding_body: optionalText(80),
  grading_scheme_id: optUuid,
  department_id: optUuid,
  is_active: bool,
});

export const saveProgramme = createAction(programmeSchema, { permission: "academics.manage" }, async ({ id, ...v }) => {
  const supabase = await createClient();
  const row = { ...v, stream: v.stream ?? null, awarding_body: v.awarding_body ?? null };
  let programmeId = id;
  if (id) {
    check(await supabase.from("programmes").update(row).eq("id", id));
  } else {
    const created = check(await supabase.from("programmes").insert({ ...row, is_active: true }).select("id").single());
    programmeId = created?.id ?? null;
  }
  // Ensure a term row exists for every term number (never deletes existing terms).
  if (programmeId) {
    const { data: existing } = await supabase.from("programme_terms").select("sequence").eq("programme_id", programmeId);
    const have = new Set((existing ?? []).map((t) => t.sequence));
    const HS = ["Class XI", "Class XII"];
    const missing = Array.from({ length: v.total_terms }, (_, i) => i + 1).filter((n) => !have.has(n)).map((n) => ({
      programme_id: programmeId!, sequence: n,
      name: v.term_kind === "class" ? (HS[n - 1] ?? `Class ${n}`) : `Semester ${n}`,
    }));
    if (missing.length) check(await supabase.from("programme_terms").insert(missing));
  }
  return done("/academics");
});

export const renameTerm = createAction(z.object({ id: z.guid(), name: requiredText("Name", 40) }), { permission: "academics.manage" }, async (v) => {
  const supabase = await createClient();
  check(await supabase.from("programme_terms").update({ name: v.name }).eq("id", v.id));
  return done("/academics");
});

// Departments --------------------------------------------------------------
export const saveDepartment = createAction(
  z.object({ id: optUuid, code: requiredText("Code", 10).toUpperCase(), name: requiredText("Name", 80) }),
  { permission: "academics.manage" },
  async ({ id, ...v }) => {
    const supabase = await createClient();
    if (id) check(await supabase.from("departments").update(v).eq("id", id));
    else check(await supabase.from("departments").insert(v));
    return done("/academics");
  },
);

// Subjects -----------------------------------------------------------------
const subjectSchema = z.object({
  id: optUuid,
  code: requiredText("Paper code", 20).regex(/^[A-Za-z0-9-]+$/, "Letters, digits and hyphens only"),
  name: requiredText("Name", 120),
  level: z.enum(["higher_secondary", "undergraduate", "postgraduate"]),
  department_id: optUuid,
  credits: optNum,
  has_practical: bool,
  is_active: bool,
});
export const saveSubject = createAction(subjectSchema, { permission: "academics.manage" }, async ({ id, ...v }) => {
  const supabase = await createClient();
  if (id) check(await supabase.from("subjects").update(v).eq("id", id));
  else check(await supabase.from("subjects").insert({ ...v, is_active: true }));
  return done("/subjects");
});

// Course categories --------------------------------------------------------
export const saveCategory = createAction(
  z.object({ id: optUuid, code: requiredText("Code", 10).toUpperCase(), name: requiredText("Name", 80), level: z.enum(["higher_secondary", "undergraduate", "postgraduate"]), sort_order: z.coerce.number().int().min(0).max(99).default(0) }),
  { permission: "academics.manage" },
  async ({ id, ...v }) => {
    const supabase = await createClient();
    if (id) check(await supabase.from("course_categories").update(v).eq("id", id));
    else check(await supabase.from("course_categories").insert(v));
    return done("/subjects");
  },
);

// Course offerings ---------------------------------------------------------
const offeringSchema = z.object({
  id: optUuid,
  academic_session_id: z.guid(),
  programme_id: z.guid(),
  term_id: z.guid(),
  subject_id: z.guid("Select a subject"),
  category_id: optUuid,
  is_compulsory: bool,
  credits: optNum,
});
export const saveOffering = createAction(offeringSchema, { permission: "academics.manage" }, async ({ id, ...v }) => {
  const supabase = await createClient();
  if (id) check(await supabase.from("course_offerings").update({ category_id: v.category_id, is_compulsory: v.is_compulsory, credits: v.credits }).eq("id", id));
  else check(await supabase.from("course_offerings").insert(v));
  return done("/subjects");
});

export const deleteOffering = createAction(z.object({ id: z.guid() }), { permission: "academics.manage" }, async ({ id }) => {
  const supabase = await createClient();
  const res = await supabase.from("course_offerings").delete().eq("id", id);
  if (res.error?.code === "23503") throw new ActionError("This offering already has enrolled students, attendance or examinations and cannot be removed.");
  check(res);
  return done("/subjects");
});

// Teacher assignments ------------------------------------------------------
export const assignTeacher = createAction(
  z.object({ course_offering_id: z.guid(), staff_id: z.guid("Select a teacher"), role: z.enum(["teacher", "examiner"]).default("teacher") }),
  { permission: ["academics.manage", "staff.manage"] },
  async (v) => {
    const supabase = await createClient();
    check(await supabase.from("teacher_assignments").insert(v));
    revalidatePath("/subjects");
    revalidatePath("/staff");
    return null;
  },
);

export const removeAssignment = createAction(z.object({ id: z.guid() }), { permission: ["academics.manage", "staff.manage"] }, async ({ id }) => {
  const supabase = await createClient();
  check(await supabase.from("teacher_assignments").delete().eq("id", id));
  revalidatePath("/subjects");
  revalidatePath("/staff");
  return null;
});

// Copy offerings from one session to another (new academic year setup)
export const copyOfferings = createAction(
  z.object({ from_session_id: z.guid(), to_session_id: z.guid() }).refine((v) => v.from_session_id !== v.to_session_id, { message: "Choose two different sessions", path: ["to_session_id"] }),
  { permission: "academics.manage" },
  async (v) => {
    const supabase = await createClient();
    const src = check(await supabase.from("course_offerings").select("programme_id, term_id, subject_id, category_id, is_compulsory, credits").eq("academic_session_id", v.from_session_id)) ?? [];
    if (!src.length) throw new ActionError("The source session has no offerings.");
    const rows = src.map((o) => ({ ...o, academic_session_id: v.to_session_id }));
    check(await supabase.from("course_offerings").upsert(rows, { onConflict: "academic_session_id,programme_id,term_id,subject_id", ignoreDuplicates: true }));
    revalidatePath("/subjects");
    return rows.length;
  },
);
