"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, ActionError, check, one } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { ROLE_KEYS } from "@/lib/auth/permissions";
import { uuid } from "@/lib/validation/common";

/**
 * Account administration. The service-role client is used ONLY for Supabase
 * Auth admin calls (create user / send recovery), after requirePermission
 * ('users.manage') has been verified by createAction. Role grants always go
 * through the audited public.set_user_roles() as the signed-in admin.
 */

function tempPassword() {
  // 16 chars from a crypto source; shown once to the administrator.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("") + "9a";
}

async function createAuthUser(email: string, fullName: string) {
  const admin = createAdminClient();
  const password = tempPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes("already")) throw new ActionError("An account with this email already exists.");
    throw new ActionError("Could not create the account. Check the email address and try again.");
  }
  return { userId: data.user.id, password };
}

const linkSchema = z.object({ record_id: uuid, email: z.email("Enter a valid email address").max(200) });

export const createStudentAccount = createAction(linkSchema, { permission: "users.manage", rateLimitPerMinute: 20 }, async (input, session) => {
  const supabase = await createClient();
  const student = one(await supabase.from("students").select("id, full_name, profile_id").eq("id", input.record_id).single());
  if (student.profile_id) throw new ActionError("This student already has a login account.");
  const { userId, password } = await createAuthUser(input.email, student.full_name);
  // Role grant (audited) as the signed-in admin; then link the record.
  check(await supabase.rpc("set_user_roles", { p_user_id: userId, p_role_keys: ["student"] }));
  const admin = createAdminClient();
  check(await admin.from("students").update({ profile_id: userId, email: input.email }).eq("id", student.id));
  await admin.rpc("log_audit_as", { p_actor: session.userId, p_action: "account.create", p_entity_type: "students", p_entity_id: student.id, p_details: { email: input.email } });
  revalidatePath(`/students/${student.id}`);
  return { email: input.email, password };
});

export const createStaffAccount = createAction(
  linkSchema.extend({ roles: z.array(z.enum(ROLE_KEYS as [string, ...string[]])).min(1, "Choose at least one role") }),
  { permission: "users.manage", rateLimitPerMinute: 20 },
  async (input, session) => {
    if (input.roles.includes("student")) throw new ActionError("Staff accounts cannot have the Student role.");
    const supabase = await createClient();
    const staff = one(await supabase.from("staff").select("id, full_name, profile_id").eq("id", input.record_id).single());
    if (staff.profile_id) throw new ActionError("This staff member already has a login account.");
    const { userId, password } = await createAuthUser(input.email, staff.full_name);
    const roleRes = await supabase.rpc("set_user_roles", { p_user_id: userId, p_role_keys: input.roles });
    if (roleRes.error) {
      await createAdminClient().auth.admin.deleteUser(userId); // roll back the half-created account
      check(roleRes);
    }
    const admin = createAdminClient();
    check(await admin.from("staff").update({ profile_id: userId, email: input.email }).eq("id", staff.id));
    await admin.rpc("log_audit_as", { p_actor: session.userId, p_action: "account.create", p_entity_type: "staff", p_entity_id: staff.id, p_details: { email: input.email, roles: input.roles } });
    revalidatePath(`/staff/${staff.id}`);
    revalidatePath("/users");
    return { email: input.email, password };
  },
);

export const setUserRoles = createAction(
  z.object({ user_id: uuid, roles: z.array(z.enum(ROLE_KEYS as [string, ...string[]])) }),
  { permission: "users.manage" },
  async (input) => {
    const supabase = await createClient();
    check(await supabase.rpc("set_user_roles", { p_user_id: input.user_id, p_role_keys: input.roles }));
    revalidatePath("/users");
    return null;
  },
);

export const setUserActive = createAction(z.object({ user_id: uuid, active: z.boolean() }), { permission: "users.manage" }, async (input) => {
  const supabase = await createClient();
  check(await supabase.rpc("set_profile_active", { p_user_id: input.user_id, p_active: input.active }));
  if (!input.active) {
    // Revoke refresh tokens so the user is signed out everywhere.
    await createAdminClient().auth.admin.signOut(input.user_id).catch(() => undefined);
  }
  revalidatePath("/users");
  return null;
});

export const sendPasswordReset = createAction(z.object({ user_id: uuid }), { permission: "users.manage", rateLimitPerMinute: 10 }, async (input, session) => {
  const supabase = await createClient();
  const profile = one(await supabase.from("profiles").select("email").eq("id", input.user_id).single());
  if (!profile.email) throw new ActionError("This account has no email address.");
  const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
    redirectTo: `${publicEnv.siteUrl()}/auth/confirm?next=/auth/reset-password`,
  });
  if (error) throw new ActionError("Could not send the reset email. Check the email configuration.");
  await createAdminClient().rpc("log_audit_as", { p_actor: session.userId, p_action: "account.reset_password", p_entity_type: "profiles", p_entity_id: input.user_id, p_details: {} });
  return null;
});
