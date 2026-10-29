"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { useServerAction } from "@/hooks/use-server-action";
import { convertApplication, reviewApplication, setDocumentSubmitted, verifyDocument } from "@/server/admission-actions";
import { formatINR } from "@/lib/utils";

export function DocumentRow({ doc, admissionId, canManage, canReview, locked }: {
  doc: { id: string; document_name: string; is_required: boolean; submitted: boolean; verified: boolean; remarks: string | null; verified_at: string | null };
  admissionId: string; canManage: boolean; canReview: boolean; locked: boolean;
}) {
  const { pending, run } = useServerAction();
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span className="flex items-center gap-2">
        {doc.verified ? <CheckCircle2 className="size-4 text-success" aria-label="Verified" /> : <span className="size-4 rounded-full border" aria-hidden />}
        {doc.document_name}{doc.is_required && <span className="text-xs text-muted-foreground">(required)</span>}
      </span>
      <span className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs">
          <Checkbox checked={doc.submitted} disabled={!canManage || locked || pending || doc.verified} aria-label={`${doc.document_name} submitted`}
            onCheckedChange={(c) => run(() => setDocumentSubmitted({ id: doc.id, admission_id: admissionId, submitted: !!c }))} />
          Submitted
        </label>
        {canReview && !locked && (
          <Button size="sm" variant={doc.verified ? "outline" : "success"} loading={pending} disabled={!doc.submitted && !doc.verified}
            onClick={() => run(() => verifyDocument({ id: doc.id, admission_id: admissionId, verified: !doc.verified }), { success: doc.verified ? "Verification removed" : "Document verified" })}>
            {doc.verified ? "Unverify" : "Verify"}
          </Button>
        )}
      </span>
    </li>
  );
}

export function ReviewDialog({ id, current }: { id: string; current: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"under_review" | "approved" | "waitlisted" | "rejected" | "withdrawn">(current === "submitted" ? "under_review" : "approved");
  const [remarks, setRemarks] = useState("");
  const { pending, run } = useServerAction();
  const needs = ["rejected", "waitlisted", "withdrawn"].includes(status);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Review decision</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Review application</DialogTitle><DialogDescription>Approval requires every required document to be verified and eligibility rules to be met.</DialogDescription></DialogHeader>
        <Field label="Decision" htmlFor="rv-status">
          <NativeSelect id="rv-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="under_review">Mark under review</option>
            <option value="approved">Approve</option>
            <option value="waitlisted">Waitlist</option>
            <option value="rejected">Reject</option>
            <option value="withdrawn">Withdrawn by applicant</option>
          </NativeSelect>
        </Field>
        <Field label="Remarks" htmlFor="rv-remarks" required={needs}><Textarea id="rv-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button loading={pending} disabled={needs && remarks.trim().length < 3} onClick={() => run(() => reviewApplication({ id, status, remarks }), { success: "Decision recorded", onSuccess: () => setOpen(false) })}>Save decision</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConvertDialog({ id, fee, canRecordPayment, methods }: { id: string; fee: number; canRecordPayment: boolean; methods: { code: string; name: string; requires_reference: boolean }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [roll, setRoll] = useState("");
  const [pay, setPay] = useState(fee > 0 && canRecordPayment);
  const [method, setMethod] = useState(methods[0]?.code ?? "cash");
  const [reference, setReference] = useState("");
  const { pending, run } = useServerAction();
  const m = methods.find((x) => x.code === method);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="success"><UserPlus /> Admit as student</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Convert to student record</DialogTitle><DialogDescription>Creates the student, enrolment, subject allocation{fee > 0 ? " and admission fee" : ""} in one step.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Field label="Roll number (optional)" htmlFor="cv-roll"><Input id="cv-roll" value={roll} onChange={(e) => setRoll(e.target.value)} /></Field>
          {fee > 0 && (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm">Admission fee: <strong>{formatINR(fee)}</strong></p>
              {canRecordPayment ? (
                <>
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={pay} onCheckedChange={(c) => setPay(!!c)} aria-label="Record payment now" /> Record payment received now</label>
                  {pay && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Method" htmlFor="cv-method"><NativeSelect id="cv-method" value={method} onChange={(e) => setMethod(e.target.value)}>{methods.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}</NativeSelect></Field>
                      <Field label="Reference" htmlFor="cv-ref" required={m?.requires_reference}><Input id="cv-ref" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
                    </div>
                  )}
                </>
              ) : <p className="text-xs text-muted-foreground">The fee will be added to the student&apos;s dues; the accounts office records the payment.</p>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button loading={pending} disabled={pay && m?.requires_reference && !reference.trim()}
            onClick={() => run(() => convertApplication({ id, roll_no: roll || undefined, payment: pay ? { amount: fee, method_code: method, reference_no: reference || undefined } : undefined }), {
              success: "Student admitted", onSuccess: (studentId) => router.push(`/students/${studentId}`),
            })}>Admit student</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
