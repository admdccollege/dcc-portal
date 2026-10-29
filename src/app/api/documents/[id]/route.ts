import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/auth/api";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Private document download. Access is decided by RLS on document_metadata
 * (and mirrored by storage.objects policies); the file is served through a
 * signed URL valid for 60 seconds. Buckets are never public.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const session = await getSession();
  if (!session) return new Response("Unauthorised", { status: 401 });
  if (!rateLimit(`doc:${session.userId}`, 60)) return new Response("Too many requests", { status: 429 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: doc } = await supabase.from("document_metadata").select("bucket, path, original_name").eq("id", id).maybeSingle();
  if (!doc) return new Response("Not found", { status: 404 });
  const { data, error } = await supabase.storage.from(doc.bucket).createSignedUrl(doc.path, 60, { download: doc.original_name });
  if (error || !data) return new Response("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
