"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, check, one } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { email, isoDate, optionalDate, optionalText, phone, requiredText } from "@/lib/validation/common";

const staffSchema = z.object({
  id: z.union([z.guid(), z.literal("")]).optional().transform((v) => v || null),
  employee_id: requiredText("Employee ID", 20),
  full_name: requiredText("Name", 120),
  designation: requiredText("Designation", 80),
  department_id: z.union([z.guid(), z.literal("")]).optional().transform((v) => v || null),
  email,
  phone,
  is_teaching: z.union([z.boolean(), z.literal("")]).optional().transform((v) => v === true),
  date_of_joining: optionalDate,
  status: z.enum(["active", "on_leave", "resigned", "retired"]).default("active"),
  date_of_birth: optionalDate,
  address: optionalText(400),
  qualification: optionalText(200),
});

export const saveStaff = createAction(staffSchema, { permission: "staff.manage" }, async ({ id, ...v }) => {
  const supabase = await createClient();
  const row = { ...v, email: v.email ?? null, phone: v.phone ?? null, date_of_joining: v.date_of_joining ?? null, date_of_birth: v.date_of_birth ?? null, address: v.address ?? null, qualification: v.qualification ?? null };
  if (id) {
    check(await supabase.from("staff").update(row).eq("id", id));
    revalidatePath(`/staff/${id}`);
    revalidatePath("/staff");
    return id;
  }
  const created = one(await supabase.from("staff").insert(row).select("id").single());
  revalidatePath("/staff");
  return created.id;
});

export const saveStaffAttendance = createAction(
  z.object({ date: isoDate, records: z.array(z.object({ staff_id: z.guid(), status: z.enum(["present", "absent", "leave", "duty"]), remarks: z.string().max(200).optional() })).min(1).max(500) }),
  { permission: "staff.manage" },
  async (v, session) => {
    const supabase = await createClient();
    check(await supabase.from("staff_attendance").upsert(v.records.map((r) => ({ ...r, date: v.date, recorded_by: session.userId })), { onConflict: "staff_id,date" }));
    revalidatePath("/staff");
    return v.records.length;
  },
);
