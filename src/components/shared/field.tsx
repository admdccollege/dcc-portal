"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Accessible label + control + error message wrapper. */
export function Field({ label, htmlFor, error, hint, required, className, children }: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive" aria-hidden> *</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${htmlFor}-error`} className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}
