"use client";

import { useState } from "react";
import { KeyRound, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/shared/field";
import { Alert } from "@/components/ui/misc";
import { useServerAction } from "@/hooks/use-server-action";
import { changeStudentStatus, setStudentSubjects } from "@/server/student-actions";
import { createStudentAccount } from "@/server/user-actions";
import { todayIST } from "@/lib/utils";

export function ChangeStatusDialog({ studentId, currentStatus }: { studentId: string; currentStatus: string }) {
  const [open, setOpen] = useState(false);
  const options = currentStatus === "active"
    ? [["withdrawn", "Withdraw"], ["transferred", "Transfer out"], ["suspended", "Suspend"], ["archived", "Archive"]]
    : [["reinstated", "Reinstate (set active)"], ["archived", "Archive"]];
  const [event, setEvent] = useState(options[0][0]);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(todayIST());
  const { pending, run } = useServerAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><UserX /> Change status</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change student status</DialogTitle>
          <DialogDescription>The change is recorded in the student&apos;s history and the audit log. Academic records are preserved.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Action" htmlFor="status-event">
            <NativeSelect id="status-event" value={event} onChange={(e) => setEvent(e.target.value)}>
              {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Effective date" htmlFor="status-date"><Input id="status-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Reason" htmlFor="status-reason" required><Textarea id="status-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            loading={pending}
            disabled={reason.trim().length < 5}
            onClick={() => run(() => changeStudentStatus({ student_id: studentId, event: event as "withdrawn", reason, effective_date: date }), { success: "Status updated", onSuccess: () => setOpen(false) })}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SubjectsEditor({ studentId, enrolmentId, offerings, selected }: {
  studentId: string;
  enrolmentId: string;
  offerings: { id: string; label: string; is_compulsory: boolean }[];
  selected: string[];
}) {
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState<string[]>(selected);
  const { pending, run } = useServerAction();
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setIds(selected); }}>
      <DialogTrigger asChild><Button variant="outline" size="sm">Edit subjects</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subject combination</DialogTitle>
          <DialogDescription>Compulsory subjects cannot be removed. Subjects with recorded marks are protected.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {offerings.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={o.is_compulsory || ids.includes(o.id)}
                disabled={o.is_compulsory}
                onCheckedChange={(c) => setIds(c ? [...ids, o.id] : ids.filter((x) => x !== o.id))}
                aria-label={o.label}
              />
              {o.label}{o.is_compulsory && <span className="text-xs text-muted-foreground">(compulsory)</span>}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button loading={pending} onClick={() => run(() => setStudentSubjects({ student_id: studentId, enrolment_id: enrolmentId, offering_ids: ids }), { success: "Subjects updated", onSuccess: () => setOpen(false) })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateAccountDialog({ recordId, defaultEmail, action = createStudentAccount, label = "Create login" }: {
  recordId: string;
  defaultEmail?: string | null;
  action?: typeof createStudentAccount;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const { pending, run } = useServerAction();
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCreated(null); }}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><KeyRound /> {label}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create login account</DialogTitle>
          <DialogDescription>A temporary password is generated and shown once. Ask the user to change it after first sign-in.</DialogDescription>
        </DialogHeader>
        {created ? (
          <Alert variant="success" title="Account created">
            <p>Email: <strong className="text-foreground">{created.email}</strong></p>
            <p>Temporary password: <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">{created.password}</code></p>
            <p className="mt-2 text-xs">Copy this now — it will not be shown again.</p>
          </Alert>
        ) : (
          <Field label="Email" htmlFor="acct-email" required><Input id="acct-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        )}
        <DialogFooter>
          {created ? <Button onClick={() => setOpen(false)}>Done</Button> : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button loading={pending} onClick={() => run(() => action({ record_id: recordId, email }), { onSuccess: (d) => setCreated(d) })}>Create account</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
