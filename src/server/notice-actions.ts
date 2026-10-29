"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAction, check, one, ActionError } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { requiredText } from "@/lib/validation/common";

const audienceSchema = z.object({
  audience: z.enum(["everyone", "all_students", "all_staff", "programme", "class"]),
  programme_id: z.guid().nullable().optional(),
  term_id: z.guid().nullable().optional(),
});
const ts = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/), z.literal("")]).optional()
  .transform((v) => (v ? new Date(`${v.slice(0, 16)}:00+05:30`).toISOString() : null));

const noticeSchema = z.object({
  id: z.union([z.guid(), z.literal("")]).optional().transform((v) => v || null),
  title: requiredText("Title", 160),
  body: requiredText("Notice text", 10000),
  category: z.enum(["academic", "examination", "admission", "holiday", "fee", "general"]),
  publish_at: ts,
  expires_at: ts,
  is_pinned: z.boolean().default(false),
  audiences: z.array(audienceSchema).min(1, "Choose at least one audience").max(30),
}).refine((v) => !v.publish_at || !v.expires_at || v.expires_at > v.publish_at, { message: "Expiry must be after the publish time", path: ["expires_at"] });

export const saveNotice = createAction(noticeSchema, { permission: "notices.manage" }, async ({ id, audiences, ...v }, session) => {
  const supabase = await createClient();
  let noticeId = id;
  if (id) check(await supabase.from("notices").update(v).eq("id", id));
  else noticeId = one(await supabase.from("notices").insert({ ...v, author_id: session.userId }).select("id").single()).id;
  check(await supabase.from("notice_audiences").delete().eq("notice_id", noticeId!));
  check(await supabase.from("notice_audiences").insert(audiences.map((a) => ({
    notice_id: noticeId!, audience: a.audience,
    programme_id: a.audience === "programme" || a.audience === "class" ? a.programme_id ?? null : null,
    term_id: a.audience === "class" ? a.term_id ?? null : null,
  }))));
  revalidatePath("/notices");
  return noticeId!;
});

export const publishNotice = createAction(z.object({ id: z.guid(), publish: z.boolean() }), { permission: "notices.publish" }, async (v) => {
  const supabase = await createClient();
  check(await supabase.rpc("publish_notice", { p_notice_id: v.id, p_publish: v.publish }));
  revalidatePath("/notices");
  revalidatePath(`/notices/${v.id}`);
  return null;
});

export const deleteNotice = createAction(z.object({ id: z.guid() }), { permission: "notices.manage" }, async ({ id }) => {
  const supabase = await createClient();
  const res = check(await supabase.from("notices").delete().eq("id", id).select("id"));
  if (!res?.length) throw new ActionError("Only draft notices can be deleted. Archive published notices instead.");
  revalidatePath("/notices");
  redirect("/notices");
});

const ALLOWED = new Map([["application/pdf", "pdf"], ["image/jpeg", "jpg"], ["image/png", "png"]]);

/** Validates type (by declared MIME and magic bytes) and size, then stores the file in a PRIVATE bucket. */
export async function uploadNoticeAttachment(formData: FormData) {
  const run = createAction(z.object({ notice_id: z.guid() }), { permission: "notices.manage", rateLimitPerMinute: 10 }, async ({ notice_id }, session) => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ActionError("Choose a file.");
    if (file.size > 10 * 1024 * 1024) throw new ActionError("Files must be 10 MB or smaller.");
    const ext = ALLOWED.get(file.type);
    if (!ext) throw new ActionError("Only PDF, JPEG and PNG files are allowed.");
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const magicOk = ext === "pdf" ? head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46
      : ext === "png" ? head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47
      : head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    if (!magicOk) throw new ActionError("The file content does not match its type.");

    const supabase = await createClient();
    const path = `${notice_id}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("notice-attachments").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) throw new ActionError("Upload failed. Please try again.");
    const doc = one(await supabase.from("document_metadata").insert({
      bucket: "notice-attachments", path, owner_type: "notice", owner_id: notice_id, category: "notice",
      original_name: file.name.slice(0, 200), mime_type: file.type, size_bytes: file.size, uploaded_by: session.userId,
    }).select("id").single());
    check(await supabase.from("notices").update({ attachment_document_id: doc.id }).eq("id", notice_id));
    revalidatePath(`/notices/${notice_id}`);
    return doc.id;
  });
  return run({ notice_id: String(formData.get("notice_id") ?? "") });
}
