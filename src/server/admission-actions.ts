"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, check } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { isoDate, optionalText, requiredText } from "@/lib/validation/common";
import { applicationSchema } from "@/lib/validation/admission";

function refresh(id?: string | null) {
  revalidatePath("/admissions");
  if (id) revalidatePath(`/admissions/${id}`);
}

const periodSchema = z.object({
  id: z.union([z.guid(), z.literal("")]).optional().transform((v) => v || null),
  academic_session_id: z.guid("Select a session"),
  programme_id: z.guid("Select a programme"),
  term_id: z.guid("Select a class"),
  title: requiredText("Title", 120),
  opens_on: isoDate,
  closes_on: isoDate,
  admission_fee: z.coerce.number().min(0).max(1_000_000),
  seats: z.union([z.coerce.number().int().positive(), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : Number(v))),
  min_qualifying_percent: z.union([z.coerce.number().min(0).max(100), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : Number(v))),
  eligibility_rules: optionalText(1000),
  required_documents: z.string().max(2000).default("").transform((v) => v.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20)),
  is_active: z.union([z.boolean(), z.literal("")]).optional().transform((v) => v === true),
}).refine((v) => v.closes_on >= v.opens_on, { message: "Closing date must be on or after opening date", path: ["closes_on"] });

export const saveAdmissionPeriod = createAction(periodSchema, { permission: "admissions.manage" }, async ({ id, ...v }) => {
  const supabase = await createClient();
  const row = { ...v, eligibility_rules: v.eligibility_rules ?? null };
  if (id) check(await supabase.from("admission_periods").update(row).eq("id", id));
  else check(await supabase.from("admission_periods").insert(row));
  refresh();
  return null;
});



export const createApplication = createAction(applicationSchema, { permission: "admissions.manage" }, async (v) => {
  const supabase = await createClient();
  const id = check(await supabase.rpc("create_admission", { p_data: v }));
  refresh();
  return id as string;
});

export const updateApplication = createAction(applicationSchema.omit({ admission_period_id: true }).extend({ id: z.guid() }), { permission: "admissions.manage" }, async ({ id, ...v }) => {
  const supabase = await createClient();
  const res = check(await supabase.from("admissions").update({
    ...v, email: v.email ?? null, address: v.address ?? null, guardian_name: v.guardian_name ?? null, guardian_relationship: v.guardian_relationship ?? null,
    guardian_phone: v.guardian_phone ?? null, previous_institution: v.previous_institution ?? null, previous_board: v.previous_board ?? null,
    previous_exam: v.previous_exam ?? null, previous_year: v.previous_year ?? null, previous_percentage: v.previous_percentage ?? null, phone: v.phone!,
  }).eq("id", id).select("id"));
  if (!res?.length) throw new Error("Application can no longer be edited");
  refresh(id);
  return id;
});

export const setDocumentSubmitted = createAction(z.object({ id: z.guid(), admission_id: z.guid(), submitted: z.boolean() }), { permission: "admissions.manage" }, async (v) => {
  const supabase = await createClient();
  check(await supabase.from("admission_documents").update({ submitted: v.submitted }).eq("id", v.id));
  refresh(v.admission_id);
  return null;
});

export const verifyDocument = createAction(z.object({ id: z.guid(), admission_id: z.guid(), verified: z.boolean(), remarks: z.string().max(300).optional() }), { permission: "admissions.review" }, async (v) => {
  const supabase = await createClient();
  check(await supabase.rpc("verify_admission_document", { p_document_id: v.id, p_verified: v.verified, p_remarks: v.remarks || undefined }));
  refresh(v.admission_id);
  return null;
});

export const reviewApplication = createAction(
  z.object({ id: z.guid(), status: z.enum(["under_review", "approved", "waitlisted", "rejected", "withdrawn"]), remarks: z.string().trim().max(500).optional() }),
  { permission: "admissions.review" },
  async (v) => {
    const supabase = await createClient();
    check(await supabase.rpc("review_admission", { p_admission_id: v.id, p_status: v.status, p_remarks: v.remarks ?? "" }));
    refresh(v.id);
    return null;
  },
);

export const convertApplication = createAction(
  z.object({
    id: z.guid(),
    roll_no: z.string().trim().max(20).optional(),
    payment: z.object({ amount: z.number().positive(), method_code: z.string().regex(/^[a-z_]+$/), reference_no: z.string().trim().max(60).optional() }).optional(),
  }),
  { permission: "admissions.convert" },
  async (v) => {
    const supabase = await createClient();
    const studentId = check(await supabase.rpc("convert_admission", { p_admission_id: v.id, p_roll_no: v.roll_no || undefined, p_payment: v.payment }));
    refresh(v.id);
    revalidatePath("/students");
    return studentId as string;
  },
);

