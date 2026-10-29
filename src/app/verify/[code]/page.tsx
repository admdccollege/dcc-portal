import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ShieldCheck, ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export const metadata: Metadata = { title: "Verification result", robots: { index: false } };

/** Public page: exposes only minimal information about PUBLISHED results (via public.verify_result). */
export default async function VerifyCodePage({ params }: PageProps<"/verify/[code]">) {
  const { code } = await params;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = !rateLimit(`verify:${ip}`, 20);
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
  let row: { student_name: string; programme: string; term: string; examination: string; academic_session: string; result_status: string; published_at: string; is_provisional: boolean } | null = null;
  if (!limited && clean.length >= 8) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("verify_result", { p_code: clean });
    row = data?.[0] ?? null;
  }
  // Mask the name partially to limit disclosure (e.g. "Gr*** Ha****").
  const mask = (n: string) => n.split(" ").map((w) => (w.length <= 2 ? w : w.slice(0, 2) + "*".repeat(w.length - 2))).join(" ");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        {limited ? <p className="text-sm">Too many verification attempts. Please try again in a minute.</p> : row ? (
          <>
            <div className="flex items-center gap-3 text-success"><ShieldCheck className="size-8" /><h1 className="text-lg font-semibold">Authentic statement of marks</h1></div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Student</dt><dd className="font-medium">{mask(row.student_name)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Result</dt><dd className="font-medium uppercase">{row.result_status}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Programme</dt><dd>{row.programme}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Class / semester</dt><dd>{row.term}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Examination</dt><dd>{row.examination}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Session</dt><dd>{row.academic_session}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-muted-foreground">Published</dt><dd>{new Date(row.published_at).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" })}{row.is_provisional ? " · Provisional" : ""}</dd></div>
            </dl>
            <p className="text-xs text-muted-foreground">Compare these details with the document. This is a college-issued statement, not an official university or council marksheet.</p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 text-destructive"><ShieldX className="size-8" /><h1 className="text-lg font-semibold">No matching published result</h1></div>
            <p className="text-sm text-muted-foreground">The code <span className="font-mono">{clean || "—"}</span> does not match any published statement. Check the code or contact the college office.</p>
          </>
        )}
        <Link href="/verify" className="block text-sm text-primary hover:underline">Verify another code</Link>
      </div>
    </main>
  );
}
