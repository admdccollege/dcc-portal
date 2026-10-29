"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { useServerAction } from "@/hooks/use-server-action";
import { decideConcession, recordAdjustment, requestConcession } from "@/server/fee-actions";

export function AdjustmentDialog({ assignmentId, studentId, kinds }: { assignmentId: string; studentId: string; kinds: { value: "charge" | "fine" | "refund" | "scholarship" | "concession" | "waiver"; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(kinds[0]?.value);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const { pending, run } = useServerAction();
  if (!kinds.length) return null;
  const isConcession = kind === "scholarship" || kind === "concession" || kind === "waiver";
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setAmount(""); setReason(""); } }}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Adjust</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Adjustment, concession or refund</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Type" htmlFor="adj-kind">
            <NativeSelect id="adj-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              {kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Amount (₹)" htmlFor="adj-amt" required><Input id="adj-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Reason" htmlFor="adj-reason" required hint={isConcession ? "Concessions and waivers need approval by an authorised officer (not the requester)." : undefined}>
            <Textarea id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button loading={pending} disabled={!amount || reason.trim().length < 5}
            onClick={() => run(
              () => isConcession
                ? requestConcession({ assignment_id: assignmentId, student_id: studentId, kind: kind as "scholarship", amount: Number(amount), reason })
                : recordAdjustment({ assignment_id: assignmentId, student_id: studentId, kind: kind as "charge", amount: Number(amount), reason }),
              { success: isConcession ? "Concession requested for approval" : "Adjustment recorded", onSuccess: () => setOpen(false) },
            )}>
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConcessionDecision({ id }: { id: string }) {
  const { pending, run } = useServerAction();
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="success" loading={pending} onClick={() => run(() => decideConcession({ concession_id: id, approve: true }), { success: "Concession approved" })}>Approve</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => { const r = prompt("Reason for rejection?"); if (r !== null) run(() => decideConcession({ concession_id: id, approve: false, remarks: r }), { success: "Concession rejected" }); }}>Reject</Button>
    </div>
  );
}
