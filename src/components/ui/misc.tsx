import * as React from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn("h-px w-full bg-border", className)} />;
}

const alertStyles = {
  info: { cls: "border-primary/30 bg-primary/5 text-foreground", Icon: Info },
  success: { cls: "border-success/40 bg-success/10 text-foreground", Icon: CheckCircle2 },
  warning: { cls: "border-warning/50 bg-warning/10 text-foreground", Icon: TriangleAlert },
  error: { cls: "border-destructive/40 bg-destructive/10 text-foreground", Icon: AlertCircle },
};

export function Alert({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: keyof typeof alertStyles;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const { cls, Icon } = alertStyles[variant];
  return (
    <div role={variant === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border p-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
      <div className="text-muted-foreground">{icon ?? <Inbox className="size-8" aria-hidden />}</div>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, tone = "default" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; tone?: "default" | "success" | "warning" | "destructive" }) {
  const toneCls = { default: "bg-primary/10 text-primary", success: "bg-success/15 text-success", warning: "bg-warning/20 text-warning-foreground dark:text-warning", destructive: "bg-destructive/15 text-destructive" }[tone];
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && <div className={cn("rounded-lg p-2 [&_svg]:size-5", toneCls)}>{icon}</div>}
      </div>
    </div>
  );
}
