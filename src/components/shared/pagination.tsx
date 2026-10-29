import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PAGE_SIZE = 25;

export function pageRange(page: number, size = PAGE_SIZE): [number, number] {
  const from = (Math.max(1, page) - 1) * size;
  return [from, from + size - 1];
}

export function parsePage(v: string | string[] | undefined): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function Pagination({ page, total, basePath, params, size = PAGE_SIZE }: {
  page: number;
  total: number;
  basePath: string;
  params: Record<string, string | string[] | undefined>;
  size?: number;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v && k !== "page") sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <div className="no-print flex items-center justify-between gap-2 px-1 py-3 text-sm text-muted-foreground">
      <span>{total === 0 ? "No records" : `Showing ${from}–${to} of ${total}`}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" asChild={page > 1} disabled={page <= 1} aria-label="Previous page">
          {page > 1 ? <Link href={href(page - 1)}><ChevronLeft /></Link> : <span><ChevronLeft /></span>}
        </Button>
        <span className="px-2 tabular-nums">{page} / {pages}</span>
        <Button variant="outline" size="sm" asChild={page < pages} disabled={page >= pages} aria-label="Next page">
          {page < pages ? <Link href={href(page + 1)}><ChevronRight /></Link> : <span><ChevronRight /></span>}
        </Button>
      </div>
    </div>
  );
}
