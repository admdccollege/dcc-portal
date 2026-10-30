import "server-only";

/**
 * Demo mode ("bypass login").
 *
 * When DEMO_MODE=true the portal signs visitors in automatically as a demo
 * account, so they land straight on the dashboard without typing credentials.
 * Under the hood it still performs a real Supabase sign-in: every page, server
 * action and RLS policy keeps working exactly as it does for a normal user.
 *
 * ⚠️ Anyone who can reach the site gets the demo account's role (Super
 * Administrator by default). Only enable this on development / demo
 * deployments that hold the fictional seed data — never on production.
 */
export const DEMO_USERNAME = "admin";
export const DEMO_PASSWORD_ALIAS = "password123";

export function demoEnabled(): boolean {
  return process.env.DEMO_MODE === "true";
}

export function demoCredentials() {
  return {
    email: process.env.DEMO_LOGIN_EMAIL || "superadmin@dcc.example",
    password: process.env.DEMO_LOGIN_PASSWORD || "DccDemo@2026",
  };
}

/** True when the typed credentials are the mock "admin / password123" pair. */
export function isMockCredentials(email: unknown, password: unknown): boolean {
  return (
    demoEnabled() &&
    typeof email === "string" &&
    typeof password === "string" &&
    email.trim().toLowerCase() === DEMO_USERNAME &&
    password === DEMO_PASSWORD_ALIAS
  );
}

/** Only allow same-site relative redirects (prevents open redirects). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
