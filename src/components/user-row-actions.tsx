"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, KeyRound, Mail, Power, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { Alert } from "@/components/ui/misc";
import { RolePicker } from "@/components/users/role-picker";
import { useServerAction } from "@/hooks/use-server-action";
import { deleteUser, sendPasswordReset, setTemporaryPassword, setUserActive, updateUser } from "@/server/user-actions";

export type UserRowData = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roles: string[];
  active: boolean;
  linked: "staff" | "student" | null;
  /** The staff record linked to this login, if any. */
  staff: { id: string; label: string } | null;
};

export type StaffOption = { id: string; label: string };

export function UserRowActions({ user, isSelf, isSuper, staffOptions = [] }: { user: UserRowData; isSelf: boolean; isSuper: boolean; staffOptions?: StaffOption[] }) {
  const [dialog, setDialog] = useState<null | "edit" | "password" | "delete">(null);
  const { pending, run } = useServerAction();
  const targetIsSuper = user.roles.includes("super_admin");
  // Non-super user managers may not touch Super Administrator accounts.
  const canEdit = isSuper || !targetIsSuper;
  const label = user.name || user.email || "user";

  // Edit form state
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [roles, setRoles] = useState<string[]>(user.roles);
  const [staffId, setStaffId] = useState(user.staff?.id ?? "");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  // Password / delete state
  const [newPw, setNewPw] = useState("");
  const [shownPw, setShownPw] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const openEdit = () => { setName(user.name); setEmail(user.email); setPhone(user.phone ?? ""); setRoles(user.roles); setStaffId(user.staff?.id ?? ""); setErrors({}); setDialog("edit"); };
  const close = () => { setDialog(null); setNewPw(""); setShownPw(null); setConfirmText(""); };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${label}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={openEdit} disabled={!canEdit}><Pencil /> Edit user &amp; roles</DropdownMenuItem>
          {!isSelf && <DropdownMenuItem onSelect={() => setDialog("password")} disabled={!canEdit}><KeyRound /> Set temporary password</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => run(() => sendPasswordReset({ user_id: user.id }), { success: "Password reset email sent" })}><Mail /> Send reset email</DropdownMenuItem>
          {!isSelf && (
            <DropdownMenuItem disabled={!canEdit} className={user.active ? "text-destructive focus:text-destructive" : ""} onSelect={() => {
              if (confirm(user.active ? `Deactivate ${label}? They will be signed out and unable to sign in.` : `Reactivate ${label}?`)) run(() => setUserActive({ user_id: user.id, active: !user.active }), { success: user.active ? "Account deactivated" : "Account reactivated" });
            }}><Power /> {user.active ? "Deactivate" : "Reactivate"}</DropdownMenuItem>
          )}
          {isSuper && !isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDialog("delete")}><Trash2 /> Delete user</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit */}
      <Dialog open={dialog === "edit"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit {label}</DialogTitle><DialogDescription>Changes take effect immediately and are recorded in the audit log.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <Field label="Full name" htmlFor={`e-name-${user.id}`} required error={errors.full_name?.[0]}>
              <Input id={`e-name-${user.id}`} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email (used to sign in)" htmlFor={`e-email-${user.id}`} required error={errors.email?.[0]}>
              <Input id={`e-email-${user.id}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Phone" htmlFor={`e-phone-${user.id}`} error={errors.phone?.[0]}>
              <Input id={`e-phone-${user.id}`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <RolePicker value={roles} onChange={setRoles} canGrantSuper={isSuper} idPrefix={`e-${user.id}`} />
            {!roles.includes("student") && user.linked !== "student" && (
              <Field label="Staff record" htmlFor={`e-staff-${user.id}`} hint="Link this login to the person's staff record. Teachers need this to see their classes and timetable.">
                <NativeSelect id={`e-staff-${user.id}`} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                  <option value="">— Not linked —</option>
                  {user.staff && <option value={user.staff.id}>{user.staff.label}</option>}
                  {staffOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </NativeSelect>
              </Field>
            )}
            {roles.includes("teacher") && !staffId && <Alert variant="warning">A Teacher without a linked staff record will not see any classes.</Alert>}
            {user.linked === "student" && !roles.includes("student") && <Alert variant="warning">This login is linked to a student record. Removing the Student role stops the student portal from working for them.</Alert>}
            {user.linked === "staff" && roles.includes("student") && <Alert variant="warning">This login is linked to a staff record; the Student role is meant for student logins.</Alert>}
            {!roles.length && <Alert variant="warning">With no role the user can sign in but sees nothing.</Alert>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button loading={pending} onClick={() => run(() => updateUser({ user_id: user.id, full_name: name, email, phone, roles, staff_id: roles.includes("student") || user.linked === "student" ? undefined : staffId }), {
              success: "User updated", onSuccess: close, onError: (r) => setErrors(r.fieldErrors ?? {}),
            })}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temporary password */}
      <Dialog open={dialog === "password"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set a temporary password</DialogTitle><DialogDescription>For {label}. Useful when password-reset emails are not set up.</DialogDescription></DialogHeader>
          {shownPw ? (
            <Alert variant="success" title="Password set">
              <div className="flex items-center gap-2"><code className="rounded bg-muted px-2 py-1 text-foreground">{shownPw}</code>
                <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(shownPw)}><Copy /> Copy</Button></div>
              <p className="mt-1 text-xs">Shown once. Ask the user to change it after signing in.</p>
            </Alert>
          ) : (
            <Field label="New password (leave empty to generate one)" htmlFor={`pw-${user.id}`} hint="At least 10 characters with a letter and a number.">
              <Input id={`pw-${user.id}`} type="text" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
            </Field>
          )}
          <DialogFooter>
            {shownPw ? <Button onClick={close}>Done</Button> : (
              <>
                <Button variant="outline" onClick={close}>Cancel</Button>
                <Button loading={pending} onClick={() => run(() => setTemporaryPassword({ user_id: user.id, password: newPw }), {
                  success: "Password updated", onSuccess: (d) => (d.password ? setShownPw(d.password) : close()),
                })}>Set password</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={dialog === "delete"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {label}?</DialogTitle><DialogDescription>This permanently removes the login. It cannot be undone.</DialogDescription></DialogHeader>
          <Alert variant="warning">
            Records this user created — payments, marks, attendance and the audit history — are kept and will show the user as deleted.
            {user.linked === "student" && " The student record stays; only its login is removed."}
            {user.linked === "staff" && " The staff record stays; only its login is removed."}
            {" "}To block access but keep the account, use Deactivate instead.
          </Alert>
          <Field label={`Type ${user.email} to confirm`} htmlFor={`del-${user.id}`}>
            <Input id={`del-${user.id}`} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button variant="destructive" loading={pending} disabled={confirmText.trim().toLowerCase() !== user.email.toLowerCase()}
              onClick={() => run(() => deleteUser({ user_id: user.id }), { success: `${label} deleted`, onSuccess: close })}>
              <Trash2 /> Delete user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
