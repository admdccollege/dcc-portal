/**
 * Bootstrap the first Super Administrator in a NEW production project.
 * (The development seed must never be run in production.)
 *
 *   ADMIN_EMAIL=principal.office@college.example ADMIN_NAME="Full Name" pnpm create-admin
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in the environment
 * (or .env.local). A strong random temporary password is printed once; the
 * administrator should sign in and change it immediately (or use "Forgot password").
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.DCC_SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.ADMIN_EMAIL;
  const name = process.env.ADMIN_NAME ?? "Super Administrator";
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Set ADMIN_EMAIL to a valid email address.");

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const password = randomBytes(18).toString("base64url") + "7a";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error || !data.user) throw new Error(`Could not create user: ${error?.message}`);

  const { data: role, error: roleErr } = await admin.from("roles").select("id").eq("key", "super_admin").single();
  if (roleErr || !role) throw new Error("Roles are missing — run the database migrations first.");
  const { error: grantErr } = await admin.from("user_roles").insert({ user_id: data.user.id, role_id: role.id });
  if (grantErr) throw new Error(`Could not grant role: ${grantErr.message}`);
  await admin.rpc("log_audit_as", { p_actor: data.user.id, p_action: "bootstrap.super_admin", p_entity_type: "profiles", p_entity_id: data.user.id, p_details: { email } });

  console.log("\nSuper Administrator created.");
  console.log(`  Email:              ${email}`);
  console.log(`  Temporary password: ${password}`);
  console.log("\nSign in and change this password immediately. This password is not stored anywhere else.\n");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
