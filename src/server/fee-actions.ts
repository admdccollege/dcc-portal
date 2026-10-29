"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, check, one, ActionError } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { isoDate, money, optionalDate, reason, requiredText } from "@/lib/validation/common";

function refresh(studentId?: string | null) {
  revalidatePath("/fees");
  if (studentId) revalidatePath(`/fees/students/${studentId}`);
}

const structureSchema = z.object({
  id: z.union([z.guid(), z.literal("")]).optional().transform((v) => v || null),
  academic_session_id: z.guid("Select a session"),
  programme_id: z.guid("Select a programme"),
  term_id: z.union([z.guid(), z.literal("")]).optional().transform((v) => v || null),
  name: requiredText("Name", 80),
  due_date: optionalDate,
  late_fine_per_day: z.coerce.number().min(0).max(10000).default(0),
  items: z.array(z.object({ fee_head_id: z.guid(), amount: z.coerce.number().min(0).max(10_000_000) })).min(1, "Add at least one fee head"),
});

export const saveFeeStructure = createAction(structureSchema, { permission: "fees.manage" }, async ({ id, items, ...v }) => {
  const supabase = await createClient();
  if (new Set(items.map((i) => i.fee_head_id)).size !== items.length) throw new ActionError("Each fee head can appear only once.");
  const row = { ...v, due_date: v.due_date ?? null };
  let structureId = id;
  if (id) {
    check(await supabase.from("fee_structures").update(row).eq("id", id));
    // Items only affect FUTURE assignments (existing assignments are snapshotted).
    check(await supabase.from("fee_structure_items").delete().eq("fee_structure_id", id));
  } else {
    structureId = one(await supabase.from("fee_structures").insert(row).select("id").single()).id;
  }
  check(await supabase.from("fee_structure_items").insert(items.filter((i) => i.amount > 0).map((i) => ({ ...i, fee_structure_id: structureId! }))));
  refresh();
  return structureId;
});

export const assignFeeToClass = createAction(
  z.object({ fee_structure_id: z.guid(), optional_head_ids: z.array(z.guid()).default([]) }),
  { permission: "fees.manage" },
  async (v) => {
    const supabase = await createClient();
    const fs = one(await supabase.from("fee_structures").select("academic_session_id, programme_id, term_id").eq("id", v.fee_structure_id).single());
    let q = supabase.from("student_enrolments").select("student_id").eq("academic_session_id", fs.academic_session_id).eq("programme_id", fs.programme_id).eq("status", "active");
    if (fs.term_id) q = q.eq("term_id", fs.term_id);
    const students = (check(await q) ?? []).map((s) => s.student_id);
    if (!students.length) throw new ActionError("No active students are enrolled in this class.");
    const n = check(await supabase.rpc("assign_fee_structure", { p_fee_structure_id: v.fee_structure_id, p_student_ids: students, p_optional_head_ids: v.optional_head_ids }));
    refresh();
    return n as number;
  },
);

export const assignFeeToStudent = createAction(
  z.object({ fee_structure_id: z.guid("Select a fee structure"), student_id: z.guid() }),
  { permission: "fees.manage" },
  async (v) => {
    const supabase = await createClient();
    const n = check(await supabase.rpc("assign_fee_structure", { p_fee_structure_id: v.fee_structure_id, p_student_ids: [v.student_id] }));
    if (!n) throw new ActionError("This fee is already assigned to the student (or the student is not active).");
    refresh(v.student_id);
    return n as number;
  },
);

/** The database locks the assignment, re-checks the balance and issues the receipt number atomically. */
export const recordPayment = createAction(
  z.object({
    assignment_id: z.guid(),
    student_id: z.guid(),
    amount: money,
    method_code: z.string().regex(/^[a-z_]+$/, "Select a payment method"),
    payment_date: isoDate,
    reference_no: z.string().trim().max(60).optional(),
    remarks: z.string().trim().max(200).optional(),
  }),
  { permission: "payments.record", rateLimitPerMinute: 60 },
  async (v) => {
    const supabase = await createClient();
    const id = check(await supabase.rpc("record_payment", {
      p_assignment_id: v.assignment_id, p_amount: v.amount, p_method_code: v.method_code, p_payment_date: v.payment_date,
      p_reference_no: v.reference_no || undefined, p_remarks: v.remarks || undefined,
    }));
    refresh(v.student_id);
    return id as string;
  },
);

export const reversePayment = createAction(z.object({ payment_id: z.guid(), student_id: z.guid(), reason }), { permission: "payments.reverse" }, async (v) => {
  const supabase = await createClient();
  check(await supabase.rpc("reverse_payment", { p_payment_id: v.payment_id, p_reason: v.reason }));
  refresh(v.student_id);
  return null;
});

export const requestConcession = createAction(
  z.object({ assignment_id: z.guid(), student_id: z.guid(), kind: z.enum(["scholarship", "concession", "waiver"]), amount: money, reason }),
  { permission: ["fees.manage", "concessions.approve"] },
  async (v) => {
    const supabase = await createClient();
    check(await supabase.rpc("request_concession", { p_assignment_id: v.assignment_id, p_kind: v.kind, p_amount: v.amount, p_reason: v.reason }));
    refresh(v.student_id);
    return null;
  },
);

export const decideConcession = createAction(
  z.object({ concession_id: z.guid(), approve: z.boolean(), remarks: z.string().trim().max(300).optional() }),
  { permission: "concessions.approve" },
  async (v) => {
    const supabase = await createClient();
    check(await supabase.rpc("decide_concession", { p_concession_id: v.concession_id, p_approve: v.approve, p_remarks: v.remarks || undefined }));
    refresh();
    return null;
  },
);

export const recordAdjustment = createAction(
  z.object({ assignment_id: z.guid(), student_id: z.guid(), kind: z.enum(["charge", "fine", "refund"]), amount: money, reason }),
  { permission: ["fees.manage", "payments.reverse"] },
  async (v) => {
    const supabase = await createClient();
    check(await supabase.rpc("record_fee_adjustment", { p_assignment_id: v.assignment_id, p_kind: v.kind, p_amount: v.amount, p_reason: v.reason }));
    refresh(v.student_id);
    return null;
  },
);

export const cancelAssignment = createAction(z.object({ assignment_id: z.guid(), student_id: z.guid(), reason }), { permission: "fees.manage" }, async (v) => {
  const supabase = await createClient();
  check(await supabase.rpc("cancel_fee_assignment", { p_assignment_id: v.assignment_id, p_reason: v.reason }));
  refresh(v.student_id);
  return null;
});

export const saveFeeHead = createAction(
  z.object({
    id: z.union([z.guid(), z.literal("")]).optional().transform((v) => v || null),
    code: requiredText("Code", 10).toUpperCase(), name: requiredText("Name", 80),
    category: z.enum(["admission", "semester", "tuition", "laboratory", "hostel", "examination", "fine", "miscellaneous"]),
    is_optional: z.union([z.boolean(), z.literal("")]).optional().transform((v) => v === true),
    is_active: z.union([z.boolean(), z.literal("")]).optional().transform((v) => v === true),
  }),
  { permission: "fees.manage" },
  async ({ id, ...v }) => {
    const supabase = await createClient();
    if (id) check(await supabase.from("fee_heads").update(v).eq("id", id));
    else check(await supabase.from("fee_heads").insert(v));
    refresh();
    return null;
  },
);

export const savePaymentMethod = createAction(
  z.object({
    code: z.string().trim().toLowerCase().regex(/^[a-z_]+$/, "Lowercase letters and underscores"), name: requiredText("Name", 60),
    requires_reference: z.union([z.boolean(), z.literal("")]).optional().transform((v) => v === true),
    is_active: z.union([z.boolean(), z.literal("")]).optional().transform((v) => v === true),
  }),
  { permission: "fees.manage" },
  async (v) => {
    const supabase = await createClient();
    check(await supabase.from("payment_methods").upsert(v, { onConflict: "code" }));
    refresh();
    return null;
  },
);
