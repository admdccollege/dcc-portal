"use client";

import { useState } from "react";
import { IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { Alert } from "@/components/ui/misc";
import { useServerAction } from "@/hooks/use-server-action";
import { recordPayment } from "@/server/fee-actions";
import { validatePaymentAmount } from "@/lib/domain/fees";
import { formatINR, todayIST } from "@/lib/utils";

export function PaymentDialog({ assignmentId, studentId, studentName, feeName, balance, methods, size = "sm" }: {
  assignmentId: string;
  studentId: string;
  studentName: string;
  feeName: string;
  balance: number;
  methods: { code: string; name: string; requires_reference: boolean }[];
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState(methods[0]?.code ?? "cash");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(todayIST());
  const [remarks, setRemarks] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const { pending, run } = useServerAction();
  const m = methods.find((x) => x.code === method);
  const amountError = amount ? validatePaymentAmount(Number(amount), balance) : "Enter an amount";
  const refError = m?.requires_reference && !reference.trim() ? `A reference number is required for ${m.name}` : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setAmount(String(balance)); setReference(""); setRemarks(""); setReceiptId(null); setDate(todayIST()); } }}>
      <DialogTrigger asChild><Button size={size} disabled={balance <= 0}><IndianRupee /> Record payment</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>{studentName} · {feeName} · Outstanding {formatINR(balance)}</DialogDescription>
        </DialogHeader>
        {receiptId ? (
          <div className="space-y-3">
            <Alert variant="success" title="Payment recorded">The receipt number has been issued. Completed payments cannot be edited; use a reversal to correct mistakes.</Alert>
            <Button asChild className="w-full"><a href={`/api/pdf/receipt/${receiptId}`} target="_blank" rel="noopener">Print receipt</a></Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount (₹)" htmlFor="pay-amount" required error={amount ? amountError ?? undefined : undefined}>
              <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Payment date" htmlFor="pay-date" required><Input id="pay-date" type="date" max={todayIST()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Method" htmlFor="pay-method" required>
              <NativeSelect id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)}>
                {methods.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Reference / transaction no." htmlFor="pay-ref" required={m?.requires_reference} error={refError ?? undefined}>
              <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <Field label="Remarks" htmlFor="pay-remarks" className="sm:col-span-2"><Input id="pay-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
            <p className="text-xs text-muted-foreground sm:col-span-2">Do not enter card numbers or bank credentials. Only record payments that have actually been received.</p>
          </div>
        )}
        {!receiptId && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={pending} disabled={!!amountError || !!refError}
              onClick={() => run(() => recordPayment({ assignment_id: assignmentId, student_id: studentId, amount: Number(amount), method_code: method, payment_date: date, reference_no: reference || undefined, remarks: remarks || undefined }), { success: "Payment recorded", onSuccess: (id) => setReceiptId(id) })}>
              Confirm payment
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
