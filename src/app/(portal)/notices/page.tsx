import Link from "next/link";
import type { Metadata } from "next";
import { Pin, Paperclip } from "lucide-react";
import { requireSession, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, param } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/shared/status-badge";
import { NoticeForm } from "@/components/notice-form";
import { formatDate, searchFilter } from "@/lib/utils";

export const metadata: Metadata = { title: "Notices" };
const CATS = ["academic", "examination", "admission", "holiday", "fee", "general"];

export default async function NoticesPage({ searchParams }: PageProps<"/notices">) {
  const session = await requireSession();
  const sp = await searchParams;
  const supabase = await createClient();
  const ref = await getReferenceData();
  const manage = can(session, "notices.manage");
  const category = CATS.includes(param(sp.category) ?? "") ? param(sp.category) : undefined;
  const status = param(sp.status);

  // RLS returns drafts only to notice managers; others see published, in-window, targeted notices.
  let q = supabase.from("notices").select("id, title, body, category, status, publish_at, expires_at, published_at, is_pinned, attachment_document_id, created_at")
    .order("is_pinned", { ascending: false }).order("published_at", { ascending: false, nullsFirst: true }).order("created_at", { ascending: false }).limit(100);
  if (category) q = q.eq("category", category as "general");
  if (manage && status && ["draft", "published", "archived"].includes(status)) q = q.eq("status", status as "draft");
  if (!manage) q = q.eq("status", "published");
  const search = searchFilter(["title", "body"], param(sp.q));
  if (search) q = q.or(search);
  const { data: notices } = await q;

  return (
    <div className="space-y-5">
      <PageHeader title="Notices & Announcements" description={manage ? "Create, target, schedule and publish notices" : "Notices for you"}
        actions={manage && <NoticeForm programmes={ref.programmes.map((p) => ({ id: p.id, code: p.code }))} terms={ref.terms} />} />
      <FilterBar searchPlaceholder="Search notices…" filters={[
        { name: "category", label: "Categories", options: CATS.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) })) },
        ...(manage ? [{ name: "status", label: "Statuses", options: [{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }, { value: "archived", label: "Archived" }] }] : []),
      ]} />
      {!notices?.length ? <EmptyState title="No notices" /> : (
        <div className="space-y-3">
          {notices.map((n) => (
            <Card key={n.id} className={n.is_pinned ? "border-primary/40" : undefined}>
              <CardContent className="space-y-1.5 pt-5">
                <div className="flex flex-wrap items-center gap-2">
                  {n.is_pinned && <Pin className="size-4 text-primary" aria-label="Pinned" />}
                  <Link href={`/notices/${n.id}`} className="font-semibold hover:underline">{n.title}</Link>
                  <StatusBadge status={n.category} />
                  {manage && <StatusBadge status={n.status} />}
                  {n.attachment_document_id && <Paperclip className="size-3.5 text-muted-foreground" aria-label="Has attachment" />}
                  <span className="ml-auto text-xs text-muted-foreground">{formatDate(n.published_at ?? n.created_at)}</span>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                {manage && n.expires_at && <p className="text-xs text-muted-foreground">Expires {formatDate(n.expires_at, true)}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
