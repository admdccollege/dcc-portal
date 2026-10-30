import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { URL, admin, as, stackAvailable } from "./helpers";

const up = await stackAvailable();
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

describe.skipIf(!up)("user administration (create / edit / delete)", () => {
  it("only a Super Administrator may run the deletion check", async () => {
    const principal = await as("principal");
    const { data: target } = await admin().from("profiles").select("id").eq("email", "teacher.history@dcc.example").single();
    const { error } = await principal.rpc("user_deletion_check", { p_user_id: target!.id });
    expect(error?.message).toMatch(/Super Administrator/);
  });

  it("a Super Administrator cannot delete their own account", async () => {
    const sup = await as("super");
    const { data: me } = await sup.auth.getUser();
    const { error } = await sup.rpc("user_deletion_check", { p_user_id: me.user!.id });
    expect(error?.message).toMatch(/your own account/);
  });

  it("non-managers cannot edit profiles through admin_update_profile", async () => {
    const principal = await as("principal");
    const { data: target } = await admin().from("profiles").select("id").eq("email", "teacher.history@dcc.example").single();
    const { error } = await principal.rpc("admin_update_profile", { p_user_id: target!.id, p_full_name: "X", p_phone: "" });
    expect(error).not.toBeNull();
  });

  it("deleting a user with history keeps the history, labelled with who it was", async () => {
    const sup = await as("super");
    const email = `temp.user.${Date.now()}@dcc.example`;
    const password = "TempPass12345";

    // Create a staff login with a role, as the portal does.
    const created = await admin().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Temp User" } });
    const userId = created.data.user!.id;
    expect((await sup.rpc("set_user_roles", { p_user_id: userId, p_role_keys: ["teacher"] })).error).toBeNull();
    expect((await sup.rpc("admin_update_profile", { p_user_id: userId, p_full_name: "Temp User", p_phone: "+91 90000 11111" })).error).toBeNull();

    // The user does something that is audited.
    const u = createClient<Database>(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    expect((await u.auth.signInWithPassword({ email, password })).error).toBeNull();
    await u.from("profiles").update({ full_name: "Temp User Renamed" }).eq("id", userId);
    const { count: before } = await admin().from("audit_logs").select("id", { count: "exact", head: true }).eq("actor_id", userId);

    // Delete: database check, then the Auth admin API (as deleteUser() does).
    const check = await sup.rpc("user_deletion_check", { p_user_id: userId });
    expect(check.error).toBeNull();
    expect((check.data as { roles: string[] }).roles).toEqual(["teacher"]);
    expect((await admin().auth.admin.deleteUser(userId)).error).toBeNull();

    const { data: gone } = await admin().from("profiles").select("id").eq("id", userId).maybeSingle();
    expect(gone).toBeNull();
    const { count: kept } = await admin().from("audit_logs").select("id", { count: "exact", head: true }).is("actor_id", null).like("actor_label", `%${email}%`);
    expect(kept ?? 0).toBeGreaterThanOrEqual(before ?? 0);
  });
});
