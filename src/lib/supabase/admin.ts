import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Service-role client. BYPASSES Row Level Security.
 *
 * Use ONLY for Supabase Auth administration (creating accounts, sending
 * password resets) after the caller's permission has been verified with
 * requirePermission(). Never import this from client components; the
 * `server-only` import makes that a build error.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not configured. Account administration requires the server-side secret key.",
    );
  }
  return createClient<Database>(publicEnv.supabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
