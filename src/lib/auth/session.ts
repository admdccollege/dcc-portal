import "server-only";
import { cache } from "react";
import { redirect, forbidden } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Permission, RoleKey } from "./permissions";

export type Session = {
  userId: string;
  email: string | null;
  fullName: string;
  roles: RoleKey[];
  permissions: Set<Permission>;
  staffId: string | null;
  studentId: string | null;
};

/**
 * Data Access Layer entry point. Verifies the user with the Auth server
 * (getUser re-validates the token, so revoked sessions are rejected) and loads
 * roles/permissions from the database (never from user-editable metadata).
 * Cached per request.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: access }, { data: profile }, { data: staffId }, { data: studentId }] = await Promise.all([
    supabase.rpc("my_access").single(),
    supabase.from("profiles").select("full_name, is_active").eq("id", user.id).maybeSingle(),
    supabase.rpc("current_staff_id"),
    supabase.rpc("current_student_id"),
  ]);

  if (!profile || !profile.is_active) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: profile.full_name || user.email || "User",
    roles: (access?.roles ?? []) as RoleKey[],
    permissions: new Set((access?.permissions ?? []) as Permission[]),
    staffId: (staffId as string | null) ?? null,
    studentId: (studentId as string | null) ?? null,
  };
});

/** Requires a signed-in, active user; redirects to /login otherwise. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export function can(session: Session | null, ...perms: Permission[]): boolean {
  return !!session && perms.some((p) => session.permissions.has(p));
}

/** Page guard: requires ANY of the given permissions; renders 403 otherwise. */
export async function requirePermission(...perms: Permission[]): Promise<Session> {
  const session = await requireSession();
  if (!can(session, ...perms)) forbidden();
  return session;
}

/** Page guard for staff (anyone with the dashboard) */
export async function requireStaff(): Promise<Session> {
  return requirePermission("dashboard.view");
}

/** Page guard for the student self-service portal. */
export async function requireStudent(): Promise<Session & { studentId: string }> {
  const session = await requireSession();
  if (!session.studentId || !session.permissions.has("portal.student")) forbidden();
  return session as Session & { studentId: string };
}
