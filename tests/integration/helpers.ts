/**
 * Integration-test helpers: real Supabase Auth sign-ins against the LOCAL stack
 * (`supabase start` + `supabase db reset`). Every query runs with the user's
 * JWT, so these tests exercise Row Level Security and the SQL functions exactly
 * as the application does.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import type { Database } from "@/lib/supabase/database.types";

config({ path: ".env.local" });

export const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET = process.env.SUPABASE_SECRET_KEY!;
export const PASSWORD = "DccDemo@2026";

export type DB = SupabaseClient<Database>;

export const USERS = {
  super: "superadmin@dcc.example",
  principal: "principal@dcc.example",
  office: "office@dcc.example",
  exams: "exams@dcc.example",
  accounts: "accounts@dcc.example",
  physics: "teacher.physics@dcc.example",
  history: "teacher.history@dcc.example",
  student: "student.science@dcc.example",
  studentArts: "student.arts@dcc.example",
} as const;

const cache = new Map<string, DB>();

export async function as(user: keyof typeof USERS): Promise<DB> {
  const email = USERS[user];
  const hit = cache.get(email);
  if (hit) return hit;
  const client = createClient<Database>(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}. Is the local stack running and seeded?`);
  cache.set(email, client);
  return client;
}

export function anon(): DB {
  return createClient<Database>(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Service-role client: ONLY for test setup/inspection, never for assertions about access. */
export function admin(): DB {
  return createClient<Database>(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function stackAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${URL}/auth/v1/health`, { headers: { apikey: KEY } });
    return r.ok;
  } catch {
    return false;
  }
}

export async function id(table: string, filter: Record<string, string>): Promise<string> {
  let q = admin().from(table as "students").select("id");
  for (const [k, v] of Object.entries(filter)) q = q.eq(k as "id", v);
  const { data, error } = await q.limit(1).single();
  if (error || !data) throw new Error(`Lookup failed: ${table} ${JSON.stringify(filter)}`);
  return (data as { id: string }).id;
}

export async function offeringId(programme: string, termSeq: number, subjectCode: string): Promise<string> {
  const { data } = await admin()
    .from("course_offerings")
    .select("id, subjects!inner(code), programme_terms!inner(sequence), programmes!inner(code)")
    .eq("subjects.code", subjectCode).eq("programme_terms.sequence", termSeq).eq("programmes.code", programme)
    .single();
  if (!data) throw new Error(`Offering not found ${programme} ${termSeq} ${subjectCode}`);
  return data.id;
}

export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
