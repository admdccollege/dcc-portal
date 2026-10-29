"use client";

import { useState } from "react";
import { MoreHorizontal, ShieldCheck, KeyRound, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useServerAction } from "@/hooks/use-server-action";
import { sendPasswordReset, setUserActive, setUserRoles } from "@/server/user-actions";
import { ROLES, ROLE_KEYS } from "@/lib/auth/permissions";

export function UserRowActions({ userId, name, roles, active, isSelf, canGrantSuper }: { userId: string; name: string; roles: string[]; active: boolean; isSelf: boolean; canGrantSuper: boolean }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string[]>(roles);
  const { pending, run } = useServerAction();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => { setSel(roles); setOpen(true); }} disabled={isSelf && !canGrantSuper}><ShieldCheck /> Edit roles</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run(() => sendPasswordReset({ user_id: userId }), { success: "Password reset email sent" })}><KeyRound /> Send password reset</DropdownMenuItem>
          {!isSelf && (
            <DropdownMenuItem className={active ? "text-destructive focus:text-destructive" : ""} onSelect={() => {
              if (confirm(active ? `Deactivate ${name}? They will be signed out and unable to sign in.` : `Reactivate ${name}?`)) run(() => setUserActive({ user_id: userId, active: !active }), { success: active ? "Account deactivated" : "Account reactivated" });
            }}><Power /> {active ? "Deactivate" : "Reactivate"}</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Roles for {name}</DialogTitle><DialogDescription>Changes take effect immediately and are recorded in the audit log.</DialogDescription></DialogHeader>
          <div className="space-y-2">
            {ROLE_KEYS.map((r) => (
              <label key={r} className="flex items-start gap-2 text-sm">
                <Checkbox className="mt-0.5" checked={sel.includes(r)} disabled={r === "super_admin" && !canGrantSuper} aria-label={ROLES[r].name}
                  onCheckedChange={(c) => setSel(c ? [...sel, r] : sel.filter((x) => x !== r))} />
                <span><span className="font-medium">{ROLES[r].name}</span><span className="block text-xs text-muted-foreground">{ROLES[r].description}</span></span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={pending} onClick={() => run(() => setUserRoles({ user_id: userId, roles: sel }), { success: "Roles updated", onSuccess: () => setOpen(false) })}>Save roles</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
