"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction, ActionError, check, one } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { ROLE_KEYS } from "@/lib/auth/permissions";
import { uuid, phone } from "@/lib/validation/common";

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

async function createAuthUser(email: string, fullName: string, chosenPassword?: string) {
  const admin = createAdminClient();
  const password = chosenPassword ?? tempPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw new ActionError(authAdminErrorMessage(error, "Could not create the account"));
  return { userId: data.user.id, password };
}

/**
 * Turns a Supabase Auth admin error into a message an administrator can act on,
 * and logs the underlying cause (visible in the hosting provider's runtime logs).
 */
function authAdminErrorMessage(error: { message?: string; code?: string; status?: number } | null, action: string): string {
  const message = error?.message ?? "no response";
  const code = error?.code ?? "";
  const status = error?.status ?? 0;
  console.error(`[auth admin] ${action}: status=${status} code=${code} message=${message}`);
  const m = message.toLowerCase();
  if (code === "email_exists" || code === "user_already_exists" || m.includes("already")) {
    return "A login with this email already exists. Find it in the user list and use “Edit user & roles” to add roles or link a staff record instead of creating a new login.";
  }
  if (status === 401 || status === 403 || m.includes("invalid api key") || m.includes("jwt") || code === "no_authorization" || code === "bad_jwt") {
    return `${action}: the server's Supabase secret key is missing, wrong, or from a different Supabase project. Set DCC_SUPABASE_SECRET_KEY (or SUPABASE_SECRET_KEY) in the hosting settings to the secret key of the same Supabase project as NEXT_PUBLIC_SUPABASE_URL, then redeploy.`;
  }
  if (code === "email_address_invalid" || m.includes("email address") && m.includes("invalid")) {
    return `${action}: Supabase rejected this email address as invalid. Use a real address (test domains such as example.com are refused).`;
  }
  if (code === "weak_password" || m.includes("password")) {
    return `${action}: ${message}`;
  }
  return `${action}: ${message}`;
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


// -----------------------------------------------------------------------------
// Direct user administration (Users & Permissions page)
// -----------------------------------------------------------------------------

const roleList = z.array(z.enum(ROLE_KEYS as [string, ...string[]])).min(1, "Choose at least one role");

const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

/** The Student role is exclusive (a login is either a student or staff). */
function checkRoleMix(roles: string[]) {
  if (roles.includes("student") && roles.length > 1) {
    throw new ActionError("The Student role cannot be combined with staff roles.");
  }
}

async function targetIsSuperAdmin(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("user_roles").select("roles(key)").eq("user_id", userId);
  return (data ?? []).some((r) => r.roles?.key === "super_admin");
}

export const createUser = createAction(
  z.object({
    full_name: z.string().trim().min(2, "Enter the full name").max(200),
    email: z.email("Enter a valid email address").max(200).transform((v) => v.toLowerCase()),
    phone,
    roles: roleList,
    password: z.union([password, z.literal("")]).optional().transform((v) => (v ? v : undefined)),
    staff_id: z.union([uuid, z.literal("")]).optional().transform((v) => (v ? v : undefined)),
    student_id: z.union([uuid, z.literal("")]).optional().transform((v) => (v ? v : undefined)),
  }),
  { permission: "users.manage", rateLimitPerMinute: 20 },
  async (input, session) => {
    checkRoleMix(input.roles);
    if (input.roles.includes("super_admin") && !session.roles.includes("super_admin")) {
      throw new ActionError("Only a Super Administrator can create another Super Administrator.");
    }
    const isStudent = input.roles.includes("student");
    if (isStudent && !input.student_id) throw new ActionError("Choose the student record this login belongs to.");
    if (!isStudent && input.student_id) throw new ActionError("A student record can only be linked to a Student login.");
    if (isStudent && input.staff_id) throw new ActionError("A Student login cannot be linked to a staff record.");

    const supabase = await createClient();
    if (input.staff_id) {
      const staff = one(await supabase.from("staff").select("id, profile_id").eq("id", input.staff_id).single());
      if (staff.profile_id) throw new ActionError("That staff member already has a login account.");
    }
    if (input.student_id) {
      const student = one(await supabase.from("students").select("id, profile_id").eq("id", input.student_id).single());
      if (student.profile_id) throw new ActionError("That student already has a login account.");
    }

    const { userId, password: pw } = await createAuthUser(input.email, input.full_name, input.password);
    const admin = createAdminClient();
    try {
      check(await supabase.rpc("set_user_roles", { p_user_id: userId, p_role_keys: input.roles }));
      if (input.phone) check(await supabase.rpc("admin_update_profile", { p_user_id: userId, p_full_name: input.full_name, p_phone: input.phone }));
      if (input.staff_id) check(await admin.from("staff").update({ profile_id: userId, email: input.email }).eq("id", input.staff_id));
      if (input.student_id) check(await admin.from("students").update({ profile_id: userId, email: input.email }).eq("id", input.student_id));
    } catch (err) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined); // roll back the half-created account
      throw err;
    }
    await admin.rpc("log_audit_as", {
      p_actor: session.userId, p_action: "account.create", p_entity_type: "profiles", p_entity_id: userId,
      p_details: { email: input.email, roles: input.roles, staff_id: input.staff_id ?? null, student_id: input.student_id ?? null },
    });
    revalidatePath("/users");
    return { email: input.email, password: input.password ? null : pw };
  },
);

export const updateUser = createAction(
  z.object({
    user_id: uuid,
    full_name: z.string().trim().min(2, "Enter the full name").max(200),
    email: z.email("Enter a valid email address").max(200).transform((v) => v.toLowerCase()),
    phone,
    roles: z.array(z.enum(ROLE_KEYS as [string, ...string[]])),
    // undefined = leave as is; "" = unlink; uuid = link this staff record to the login
    staff_id: z.union([uuid, z.literal("")]).optional(),
  }),
  { permission: "users.manage" },
  async (input, session) => {
    checkRoleMix(input.roles);
    if (input.staff_id && input.roles.includes("student")) throw new ActionError("A Student login cannot be linked to a staff record.");
    const supabase = await createClient();
    const current = one(await supabase.from("profiles").select("id, email").eq("id", input.user_id).single());

    // Name/phone (audited; the database refuses edits to a Super Administrator by non-super users).
    check(await supabase.rpc("admin_update_profile", { p_user_id: input.user_id, p_full_name: input.full_name, p_phone: input.phone ?? "" }));

    if ((current.email ?? "").toLowerCase() !== input.email) {
      if ((await targetIsSuperAdmin(input.user_id)) && !session.roles.includes("super_admin")) {
        throw new ActionError("Only a Super Administrator can change a Super Administrator's email.");
      }
      const admin = createAdminClient();
      const { error } = await admin.auth.admin.updateUserById(input.user_id, { email: input.email, email_confirm: true });
      if (error) throw new ActionError(authAdminErrorMessage(error, "Could not change the email address"));
      // Keep linked records' contact email in step with the login.
      await admin.from("staff").update({ email: input.email }).eq("profile_id", input.user_id);
      await admin.from("students").update({ email: input.email }).eq("profile_id", input.user_id);
      await admin.rpc("log_audit_as", { p_actor: session.userId, p_action: "account.change_email", p_entity_type: "profiles", p_entity_id: input.user_id, p_details: { from: current.email, to: input.email } });
    }

    // Roles (audited and permission-checked by the database).
    check(await supabase.rpc("set_user_roles", { p_user_id: input.user_id, p_role_keys: input.roles }));

    // Staff record link (e.g. give an existing login the Teacher role for their own staff record).
    if (input.staff_id !== undefined) {
      const linked = check(await supabase.from("staff").select("id").eq("profile_id", input.user_id));
      const currentStaffId = linked?.[0]?.id ?? "";
      if (currentStaffId !== input.staff_id) {
        const admin = createAdminClient();
        if (input.staff_id) {
          const staff = one(await supabase.from("staff").select("id, full_name, profile_id").eq("id", input.staff_id).single());
          if (staff.profile_id) throw new ActionError(`${staff.full_name} is already linked to another login.`);
        }
        if (currentStaffId) check(await admin.from("staff").update({ profile_id: null }).eq("id", currentStaffId));
        if (input.staff_id) check(await admin.from("staff").update({ profile_id: input.user_id, email: input.email }).eq("id", input.staff_id));
        await admin.rpc("log_audit_as", {
          p_actor: session.userId, p_action: "account.link_staff", p_entity_type: "profiles", p_entity_id: input.user_id,
          p_details: { from_staff_id: currentStaffId || null, to_staff_id: input.staff_id || null },
        });
        revalidatePath("/staff");
      }
    }
    revalidatePath("/users");
    return null;
  },
);

export const deleteUser = createAction(z.object({ user_id: uuid }), { permission: "users.manage", rateLimitPerMinute: 20 }, async (input, session) => {
  if (!session.roles.includes("super_admin")) throw new ActionError("Only a Super Administrator can delete user accounts.");
  const supabase = await createClient();
  // Database check: Super Administrator only, never yourself, never the last Super Administrator.
  const snapshot = check(await supabase.rpc("user_deletion_check", { p_user_id: input.user_id }));
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(input.user_id);
  if (error) throw new ActionError(authAdminErrorMessage(error, "Could not delete the account"));
  // Records the user created (payments, marks, attendance, audit history) are kept;
  // linked staff/student records stay and simply lose their login.
  await admin.rpc("log_audit_as", { p_actor: session.userId, p_action: "account.delete", p_entity_type: "profiles", p_entity_id: input.user_id, p_details: snapshot });
  revalidatePath("/users");
  return null;
});

export const setTemporaryPassword = createAction(
  z.object({ user_id: uuid, password: z.union([password, z.literal("")]).optional().transform((v) => (v ? v : undefined)) }),
  { permission: "users.manage", rateLimitPerMinute: 10 },
  async (input, session) => {
    if (input.user_id === session.userId) throw new ActionError("Change your own password from Account › Password.");
    if ((await targetIsSuperAdmin(input.user_id)) && !session.roles.includes("super_admin")) {
      throw new ActionError("Only a Super Administrator can reset a Super Administrator's password.");
    }
    const pw = input.password ?? tempPassword();
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(input.user_id, { password: pw });
    if (error) throw new ActionError(authAdminErrorMessage(error, "Could not set the password"));
    await admin.rpc("log_audit_as", { p_actor: session.userId, p_action: "account.set_password", p_entity_type: "profiles", p_entity_id: input.user_id, p_details: {} });
    return { password: input.password ? null : pw };
  },
);
