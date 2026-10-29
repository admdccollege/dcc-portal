"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, check } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { optionalText, requiredText } from "@/lib/validation/common";

const bool = z.union([z.boolean(), z.literal("")]).optional().transform((v) => v === true);
const optPct = z.union([z.coerce.number().min(0).max(100), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : Number(v)));

export const saveInstitution = createAction(
  z.object({
    name: requiredText("Name", 160), short_name: requiredText("Short name", 10), address: requiredText("Address", 300),
    phone: optionalText(40), email: z.union([z.email(), z.literal("")]).optional(), website: optionalText(160),
    attendance_threshold: z.coerce.number().min(0).max(100), attendance_edit_window_days: z.coerce.number().int().min(0).max(60),
    admission_no_prefix: requiredText("Admission prefix", 10).regex(/^[A-Z0-9-]+$/, "Capital letters, digits, hyphen"),
    application_no_prefix: requiredText("Application prefix", 10).regex(/^[A-Z0-9-]+$/, "Capital letters, digits, hyphen"),
    receipt_no_prefix: requiredText("Receipt prefix", 10).regex(/^[A-Z0-9-]+$/, "Capital letters, digits, hyphen"),
    financial_year_start_month: z.coerce.number().int().min(1).max(12),
    marksheet_footer_note: requiredText("Marksheet note", 400),
  }),
  { permission: "settings.manage" },
  async (v, session) => {
    const supabase = await createClient();
    check(await supabase.from("institution_settings").update({ ...v, phone: v.phone ?? null, email: v.email || null, website: v.website ?? null, updated_by: session.userId }).eq("id", 1));
    revalidatePath("/", "layout");
    return null;
  },
);

export const saveGradingScheme = createAction(
  z.object({
    id: z.union([z.guid(), z.literal("")]).optional().transform((v) => v || null),
    name: requiredText("Name", 120), level: z.union([z.enum(["higher_secondary", "undergraduate", "postgraduate"]), z.literal("")]).optional().transform((v) => v || null),
    description: optionalText(1000), subject_pass_percent: optPct, aggregate_pass_percent: optPct,
    require_component_pass: bool, require_all_subjects_pass: bool,
    max_failed_subjects_for_compartment: z.coerce.number().int().min(0).max(10).default(0),
    use_grade_points: bool, use_credits: bool, decimals: z.coerce.number().int().min(0).max(4).default(2), is_active: bool,
  }),
  { permission: "grading.manage" },
  async ({ id, ...v }) => {
    const supabase = await createClient();
    const row = { ...v, description: v.description ?? null };
    if (id) check(await supabase.from("grading_schemes").update(row).eq("id", id));
    else check(await supabase.from("grading_schemes").insert(row));
    revalidatePath("/settings");
    return null;
  },
);

export const saveGradingRule = createAction(
  z.object({
    id: z.union([z.guid(), z.literal("")]).optional().transform((v) => v || null),
    grading_scheme_id: z.guid(), grade: requiredText("Grade", 6), min_percent: z.coerce.number().min(0).max(100),
    grade_point: z.union([z.coerce.number().min(0).max(10), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : Number(v))),
    is_pass: bool, description: optionalText(80),
  }),
  { permission: "grading.manage" },
  async ({ id, ...v }) => {
    const supabase = await createClient();
    const row = { ...v, description: v.description ?? null };
    if (id) check(await supabase.from("grading_rules").update(row).eq("id", id));
    else check(await supabase.from("grading_rules").insert(row));
    revalidatePath("/settings");
    return null;
  },
);

export const deleteGradingRule = createAction(z.object({ id: z.guid() }), { permission: "grading.manage" }, async ({ id }) => {
  const supabase = await createClient();
  check(await supabase.from("grading_rules").delete().eq("id", id));
  revalidatePath("/settings");
  return null;
});

export const saveExamType = createAction(
  z.object({ id: z.union([z.guid(), z.literal("")]).optional().transform((v) => v || null), code: requiredText("Code", 10).toUpperCase(), name: requiredText("Name", 80), is_supplementary: bool, is_active: bool, sort_order: z.coerce.number().int().min(0).max(99).default(0) }),
  { permission: "exams.manage" },
  async ({ id, ...v }) => {
    const supabase = await createClient();
    if (id) check(await supabase.from("examination_types").update(v).eq("id", id));
    else check(await supabase.from("examination_types").insert(v));
    revalidatePath("/settings");
    return null;
  },
);
