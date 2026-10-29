import { notFound } from "next/navigation";
import { Paperclip, Send, Archive, Trash2 } from "lucide-react";
import { requireSession, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, programmeCode, termName, UUID_RE } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { NoticeForm, AttachmentUpload } from "@/components/notice-form";
import { deleteNotice, publishNotice, uploadNoticeAttachment } from "@/server/notice-actions";
import { formatDate, titleCase, toISTInput } from "@/lib/utils";

export const metadata = { title: "Notice" };

export default async function NoticePage({ params }: PageProps<"/notices/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createClient();
  const ref = await getReferenceData();
  const { data: n } = await supabase.from("notices").select("*, notice_audiences(audience, programme_id, term_id), document_metadata!notices_attachment_document_id_fkey(id, original_name, size_bytes)").eq("id", id).maybeSingle();
  if (!n) notFound(); // RLS hides drafts, expired and untargeted notices
  const manage = can(session, "notices.manage");
  const { data: author } = manage && n.author_id ? await supabase.from("profiles").select("full_name").eq("id", n.author_id).maybeSingle() : { data: null };
  const audienceLabel = (a: { audience: string; programme_id: string | null; term_id: string | null }) =>
    a.audience === "class" ? `${programmeCode(ref, a.programme_id)} · ${termName(ref, a.term_id)}` : a.audience === "programme" ? `${programmeCode(ref, a.programme_id)} (all classes)` : titleCase(a.audience);
  const doc = n.document_metadata;

  return (
    <div className="space-y-5">
      <PageHeader
        title={n.title}
        description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={n.category} />{manage && <StatusBadge status={n.status} />} Published {formatDate(n.published_at, true)}{author?.full_name ? ` · by ${author.full_name}` : ""}</span>}
        breadcrumbs={[{ label: "Notices", href: "/notices" }, { label: n.title }]}
        actions={manage && (
          <>
            {n.status !== "archived" && <NoticeForm programmes={ref.programmes.map((p) => ({ id: p.id, code: p.code }))} terms={ref.terms}
              initial={{ id: n.id, title: n.title, body: n.body, category: n.category, publish_at: toISTInput(n.publish_at), expires_at: toISTInput(n.expires_at), is_pinned: n.is_pinned, audiences: n.notice_audiences as never }} />}
            {can(session, "notices.publish") && n.status === "draft" && <ConfirmAction size="sm" variant="success" icon={<Send />} label="Publish" title="Publish this notice?" description="It becomes visible to the selected audience from the publish time until expiry." action={publishNotice.bind(null, { id: n.id, publish: true })} success="Notice published" />}
            {can(session, "notices.publish") && n.status === "published" && <ConfirmAction size="sm" variant="outline" icon={<Archive />} label="Archive" title="Archive this notice?" description="It will no longer be visible to students and staff." action={publishNotice.bind(null, { id: n.id, publish: false })} success="Notice archived" />}
            {n.status === "draft" && <ConfirmAction size="sm" variant="ghost" icon={<Trash2 />} label="Delete" title="Delete this draft?" action={deleteNotice.bind(null, { id: n.id })} success="Deleted" />}
          </>
        )}
      />
      <Card>
        <CardContent className="pt-5">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{n.body}</div>
          {doc && (
            <a href={`/api/documents/${doc.id}`} className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-primary hover:bg-muted">
              <Paperclip className="size-4" /> {doc.original_name} <span className="text-xs text-muted-foreground">({Math.round(doc.size_bytes / 1024)} KB)</span>
            </a>
          )}
        </CardContent>
      </Card>
      {manage && (
        <Card>
          <CardHeader><CardTitle>Publication details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Audience</p><p>{n.notice_audiences.map(audienceLabel).join(", ") || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Visible from</p><p>{formatDate(n.publish_at, true)}</p></div>
            <div><p className="text-xs text-muted-foreground">Expires</p><p>{formatDate(n.expires_at, true)}</p></div>
            {n.status !== "archived" && <div className="sm:col-span-3"><p className="mb-1 text-xs text-muted-foreground">{doc ? "Replace attachment" : "Attachment"}</p><AttachmentUpload noticeId={n.id} action={uploadNoticeAttachment} /></div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
