import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { demoCredentials, demoEnabled, safeNext } from "@/lib/demo";

/**
 * GET /auth/demo — one-tap demo entry (used by the Android app and by the
 * proxy when DEMO_MODE=true). Signs in as the demo account and goes straight
 * to the dashboard (or ?next=…).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  if (!demoEnabled()) return NextResponse.redirect(`${origin}/login`);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(demoCredentials());
  if (error) return NextResponse.redirect(`${origin}/login?error=demo_failed`);
  if (!(await getSession())) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=demo_failed`);
  }

  // "/" sends staff roles to /dashboard and students to /my.
  return NextResponse.redirect(`${origin}${safeNext(searchParams.get("next"))}`);
}
