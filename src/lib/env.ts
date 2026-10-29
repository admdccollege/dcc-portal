/**
 * Environment access. Public values are inlined by Next.js at build time; the
 * secret key is read lazily on the server only (see supabase/admin.ts).
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseKey: () =>
    required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};
