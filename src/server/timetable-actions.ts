"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, check, ActionError } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

const entrySchema = z.object({
  id: z.union([z.guid(), z.literal("")]).optional().transform((v) => v || null),
  academic_session_id: z.guid(),
  programme_id: z.guid(),
  term_id: z.guid(),
  section: z.string().trim().max(10).default(""),
  course_offering_id: z.guid("Select a subject"),
  staff_id: z.union([z.guid(), z.literal("")]).optional().transform((v) => v || null),
  day_of_week: z.coerce.number().int().min(1).max(6),
  period_no: z.coerce.number().int().min(1).max(12),
  room: z.string().trim().max(30).optional().transform((v) => v || null),
});

/** Checks class/teacher/room conflicts first (friendly message); unique indexes enforce them regardless. */
export const saveTimetableEntry = createAction(entrySchema, { permission: "timetable.manage" }, async ({ id, ...v }) => {
  const supabase = await createClient();
  const { data: conflicts } = await supabase.rpc("timetable_conflicts", {
    p_session_id: v.academic_session_id, p_programme_id: v.programme_id, p_term_id: v.term_id, p_section: v.section,
    p_staff_id: v.staff_id as string, p_room: v.room as string, p_day: v.day_of_week, p_period: v.period_no, p_exclude_id: id as string,
  });
  if (conflicts?.length) throw new ActionError(`Scheduling conflict: ${conflicts.map((c) => c.description).join("; ")}.`);
  if (id) check(await supabase.from("timetable_entries").update(v).eq("id", id));
  else check(await supabase.from("timetable_entries").insert(v));
  revalidatePath("/timetable");
  return null;
});

export const deleteTimetableEntry = createAction(z.object({ id: z.guid() }), { permission: "timetable.manage" }, async ({ id }) => {
  const supabase = await createClient();
  check(await supabase.from("timetable_entries").delete().eq("id", id));
  revalidatePath("/timetable");
  return null;
});
