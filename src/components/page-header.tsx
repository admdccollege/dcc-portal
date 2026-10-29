import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function PageHeader({
  title, description, actions, breadcrumbs,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  return (
    <div className="space-y-2">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="no-print flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {b.href ? <Link href={b.href} className="hover:text-foreground hover:underline">{b.label}</Link> : <span>{b.label}</span>}
              {i < breadcrumbs.length - 1 && <ChevronRight className="size-3" aria-hidden />}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
