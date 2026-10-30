"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { publicEnv } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import { demoCredentials, demoEnabled, isMockCredentials, safeNext } from "@/lib/demo";

export type FormState = { error?: string; message?: string } | null;

/** Signs in as the configured demo account. Returns an error message or null. */
async function signInAsDemoUser(): Promise<string | null> {
  if (!demoEnabled()) return "Demo mode is not enabled on this server.";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(demoCredentials());
  if (error) return "Demo sign-in failed. Check DEMO_LOGIN_EMAIL / DEMO_LOGIN_PASSWORD and that the demo seed is loaded.";
  const session = await getSession();
  if (!session) {
    await supabase.auth.signOut();
    return "The demo account is inactive.";
  }
  return null;
}

/** "Bypass Login / Demo Mode" button on the sign-in page. */
export async function signInDemo(_prev: FormState, formData: FormData): Promise<FormState> {
  const error = await signInAsDemoUser();
  if (error) return { error };
  const next = formData.get("next");
  redirect(safeNext(typeof next === "string" ? next : undefined));
}

async function clientKey() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

const signInSchema = z.object({
  email: z.email("Enter a valid email address").max(200),
  password: z.string().min(1, "Enter your password").max(200),
  next: z.string().optional(),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  // Demo mode: the mock credentials "admin / password123" sign in as the demo account.
  if (isMockCredentials(formData.get("email"), formData.get("password"))) {
    const error = await signInAsDemoUser();
    if (error) return { error };
    const next = formData.get("next");
    redirect(safeNext(typeof next === "string" ? next : undefined));
  }

  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ip = await clientKey();
  // Limits are configurable (e.g. many users behind one college NAT); defaults are conservative.
  const ipLimit = Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE ?? 20) || 20;
  const accountLimit = Number(process.env.AUTH_RATE_LIMIT_PER_ACCOUNT ?? 5) || 5;
  if (!rateLimit(`login:${ip}`, ipLimit) || !rateLimit(`login:${parsed.data.email.toLowerCase()}`, accountLimit)) {
    return { error: "Too many sign-in attempts. Please wait a minute and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: "Invalid email or password." };

  // Deactivated accounts are refused even if the password is correct.
  const session = await getSession();
  if (!session) {
    await supabase.auth.signOut();
    return { error: "Your account is inactive. Please contact the college office." };
  }
  await supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", session.userId);
  redirect(safeNext(parsed.data.next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const resetSchema = z.object({ email: z.email("Enter a valid email address").max(200) });

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const ip = await clientKey();
  if (!rateLimit(`reset:${ip}`, 5)) return { error: "Too many requests. Please try again later." };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl()}/auth/confirm?next=/auth/reset-password`,
  });
  // Same response whether or not the account exists (prevents account enumeration).
  return { message: "If an account exists for that email, a password reset link has been sent." };
}

const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, "Use at least 10 characters")
      .max(128)
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Please request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message.includes("different") ? "Choose a password different from your current one." : "Could not update password. Please try again." };
  return { message: "Your password has been updated." };
}
