"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, check } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { isoDate } from "@/lib/validation/common";

const saveSchema = z.object({
  academic_session_id: z.guid(),
  programme_id: z.guid(),
  term_id: z.guid(),
  course_offering_id: z.guid().nullable(),
  date: isoDate,
  period: z.coerce.number().int().min(1).max(12),
  topic: z.string().trim().max(200).optional(),
  records: z.array(z.object({ student_id: z.guid(), status_code: z.string().regex(/^[A-Z]{1,4}$/), remarks: z.string().trim().max(200).optional() })).min(1, "No students to save").max(400),
});

/** Permission (assignment, edit cutoff, lock) is enforced by public.save_attendance(). */
export const saveAttendance = createAction(saveSchema, { permission: ["attendance.take", "attendance.manage"], rateLimitPerMinute: 60 }, async (v) => {
  const supabase = await createClient();
  check(await supabase.rpc("save_attendance", {
    p_academic_session_id: v.academic_session_id, p_programme_id: v.programme_id, p_term_id: v.term_id,
    p_offering_id: v.course_offering_id as string, p_date: v.date, p_period: v.period, p_records: v.records, p_topic: v.topic ?? undefined,
  }));
  revalidatePath("/attendance");
  return v.records.length;
});

export const setAttendanceLock = createAction(z.object({ id: z.guid(), locked: z.boolean() }), { permission: "attendance.manage" }, async (v) => {
  const supabase = await createClient();
  check(await supabase.rpc("set_attendance_lock", { p_session_id: v.id, p_locked: v.locked }));
  revalidatePath("/attendance");
  return null;
});

export const sendLowAttendanceAlerts = createAction(
  z.object({ academic_session_id: z.guid(), programme_id: z.guid().optional(), term_id: z.guid().optional() }),
  { permission: ["attendance.manage", "attendance.view_all"], rateLimitPerMinute: 5 },
  async (v) => {
    const supabase = await createClient();
    const n = check(await supabase.rpc("send_low_attendance_alerts", { p_academic_session_id: v.academic_session_id, p_programme_id: v.programme_id, p_term_id: v.term_id }));
    return n as number;
  },
);

export const saveAttendanceStatus = createAction(
  z.object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z]{1,4}$/, "1–4 capital letters"),
    label: z.string().trim().min(2).max(40),
    counts_as_present: z.union([z.boolean(), z.literal("")]).transform((v) => v === true),
    counts_in_total: z.union([z.boolean(), z.literal("")]).transform((v) => v === true),
    is_active: z.union([z.boolean(), z.literal("")]).transform((v) => v === true),
    sort_order: z.coerce.number().int().min(0).max(99).default(0),
  }).refine((v) => !v.counts_as_present || v.counts_in_total, { message: "A status counted as present must also count in the total", path: ["counts_in_total"] }),
  { permission: "attendance.configure" },
  async (v) => {
    const supabase = await createClient();
    check(await supabase.from("attendance_statuses").upsert(v, { onConflict: "code" }));
    revalidatePath("/settings");
    return null;
  },
);
