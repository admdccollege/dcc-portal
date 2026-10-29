"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { Alert } from "@/components/ui/misc";
import { useServerAction } from "@/hooks/use-server-action";
import { createStaffAccount } from "@/server/user-actions";
import { ROLES, ROLE_KEYS } from "@/lib/auth/permissions";

export function StaffAccountDialog({ staffId, defaultEmail }: { staffId: string; defaultEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [roles, setRoles] = useState<string[]>(["teacher"]);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const { pending, run } = useServerAction();
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCreated(null); }}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><KeyRound /> Create login</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create staff login</DialogTitle><DialogDescription>A temporary password is shown once. Roles determine what the user can access.</DialogDescription></DialogHeader>
        {created ? (
          <Alert variant="success" title="Account created">
            <p>Email: <strong className="text-foreground">{created.email}</strong></p>
            <p>Temporary password: <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">{created.password}</code></p>
          </Alert>
        ) : (
          <div className="space-y-3">
            <Field label="Email" htmlFor="sa-email" required><Input id="sa-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Roles</legend>
              {ROLE_KEYS.filter((r) => r !== "student").map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={roles.includes(r)} onCheckedChange={(c) => setRoles(c ? [...roles, r] : roles.filter((x) => x !== r))} aria-label={ROLES[r].name} />
                  {ROLES[r].name} <span className="text-xs text-muted-foreground">— {ROLES[r].description}</span>
                </label>
              ))}
            </fieldset>
          </div>
        )}
        <DialogFooter>
          {created ? <Button onClick={() => setOpen(false)}>Done</Button> : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button loading={pending} disabled={!roles.length} onClick={() => run(() => createStaffAccount({ record_id: staffId, email, roles }), { onSuccess: (d) => setCreated(d) })}>Create account</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
