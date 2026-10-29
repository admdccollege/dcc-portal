"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export async function markNotificationsRead() {
  const session = await getSession();
  if (!session) return;
  const supabase = await createClient();
  // RLS + column grant restrict this to the caller's own read_at field.
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).eq("user_id", session.userId);
  revalidatePath("/", "layout");
}
