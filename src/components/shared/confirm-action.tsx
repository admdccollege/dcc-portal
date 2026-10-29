"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerAction } from "@/hooks/use-server-action";
import type { ActionResult } from "@/lib/actions";

/**
 * Button that opens a confirmation dialog, optionally requiring a reason,
 * then calls a server action. Used for sensitive operations (reversals,
 * publication, locking, status changes).
 */
export function ConfirmAction<T>({
  label, title, description, confirmLabel = "Confirm", requireReason = false, reasonLabel = "Reason",
  action, payload, reasonField = "reason", success, variant = "default", size, icon, disabled,
}: {
  label: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  requireReason?: boolean;
  reasonLabel?: string;
  /** A server action. With `payload`, it is called as action({ ...payload, [reasonField]: reason }). */
  action: ((reason: string) => Promise<ActionResult<T>>) | ((input: never) => Promise<ActionResult<T>>);
  payload?: Record<string, unknown>;
  reasonField?: string;
  success?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { pending, run } = useServerAction();
  const tooShort = requireReason && reason.trim().length < 5;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setReason(""); }}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled} aria-label={!label ? title : undefined}>{icon}{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription asChild><div>{description}</div></DialogDescription>}
        </DialogHeader>
        {requireReason && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-reason">{reasonLabel} <span className="text-destructive">*</span></Label>
            <Textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="At least 5 characters" />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant={variant === "outline" || variant === "ghost" ? "default" : variant}
            loading={pending}
            disabled={tooShort}
            onClick={() => run(
              () => payload
                ? (action as (i: Record<string, unknown>) => Promise<ActionResult<T>>)({ ...payload, ...(requireReason ? { [reasonField]: reason.trim() } : {}) })
                : (action as (r: string) => Promise<ActionResult<T>>)(reason.trim()),
              { success, onSuccess: () => setOpen(false) },
            )}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
