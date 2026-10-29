"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { useServerAction } from "@/hooks/use-server-action";
import { saveFeeStructure } from "@/server/fee-actions";
import { formatINR } from "@/lib/utils";

type Opt = { id: string; name: string };
type Initial = { id?: string; academic_session_id: string; programme_id: string; term_id: string; name: string; due_date: string; late_fine_per_day: string; items: { fee_head_id: string; amount: string }[] };

export function FeeStructureForm({ sessions, programmes, terms, heads, initial, triggerLabel = "New fee structure" }: {
  sessions: Opt[];
  programmes: Opt[];
  terms: { id: string; programme_id: string; name: string }[];
  heads: { id: string; name: string; is_optional: boolean }[];
  initial: Initial;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Initial>(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const { pending, run } = useServerAction();
  const total = v.items.reduce((a, i) => a + (Number(i.amount) || 0), 0);
  const set = (k: keyof Initial, val: string) => setV((s) => ({ ...s, [k]: val }));

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV(initial); setErrors({}); } }}>
      <DialogTrigger asChild><Button size="sm" variant={initial.id ? "outline" : "default"}>{!initial.id && <Plus />}{triggerLabel}</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{initial.id ? "Edit fee structure" : "New fee structure"}</DialogTitle></DialogHeader>
        {initial.id && <p className="text-xs text-muted-foreground">Changes apply to future assignments only. Fees already assigned to students keep their original amounts.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="fs-name" required error={errors.name?.[0]} className="sm:col-span-2"><Input id="fs-name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Semester Fees" /></Field>
          <Field label="Academic session" htmlFor="fs-session" required>
            <NativeSelect id="fs-session" value={v.academic_session_id} disabled={!!initial.id} onChange={(e) => set("academic_session_id", e.target.value)}>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Programme" htmlFor="fs-prog" required error={errors.programme_id?.[0]}>
            <NativeSelect id="fs-prog" value={v.programme_id} disabled={!!initial.id} onChange={(e) => setV((s) => ({ ...s, programme_id: e.target.value, term_id: "" }))}>
              <option value="">Select</option>
              {programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Class / semester" htmlFor="fs-term" hint="Leave blank to apply to every term">
            <NativeSelect id="fs-term" value={v.term_id} disabled={!!initial.id} onChange={(e) => set("term_id", e.target.value)}>
              <option value="">All terms</option>
              {terms.filter((t) => t.programme_id === v.programme_id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Due date" htmlFor="fs-due"><Input id="fs-due" type="date" value={v.due_date} onChange={(e) => set("due_date", e.target.value)} /></Field>
        </div>
        <fieldset className="space-y-2 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">Fee heads</legend>
          {v.items.map((it, i) => (
            <div key={i} className="flex gap-2">
              <NativeSelect aria-label="Fee head" value={it.fee_head_id} onChange={(e) => setV((s) => ({ ...s, items: s.items.map((x, k) => (k === i ? { ...x, fee_head_id: e.target.value } : x)) }))}>
                <option value="">Select head</option>
                {heads.map((h) => <option key={h.id} value={h.id}>{h.name}{h.is_optional ? " (optional)" : ""}</option>)}
              </NativeSelect>
              <Input aria-label="Amount" inputMode="decimal" className="w-36 text-right" value={it.amount} onChange={(e) => setV((s) => ({ ...s, items: s.items.map((x, k) => (k === i ? { ...x, amount: e.target.value } : x)) }))} />
              <Button variant="ghost" size="icon" aria-label="Remove fee head" onClick={() => setV((s) => ({ ...s, items: s.items.filter((_, k) => k !== i) }))}><Trash2 /></Button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setV((s) => ({ ...s, items: [...s.items, { fee_head_id: "", amount: "" }] }))}><Plus /> Add head</Button>
            <span className="text-sm">Total (compulsory + optional): <strong>{formatINR(total)}</strong></span>
          </div>
          {errors.items && <p className="text-xs text-destructive">{errors.items[0]}</p>}
        </fieldset>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button loading={pending} onClick={() => run(() => saveFeeStructure({
            ...v, id: v.id ?? "", late_fine_per_day: Number(v.late_fine_per_day) || 0,
            items: v.items.filter((i) => i.fee_head_id).map((i) => ({ fee_head_id: i.fee_head_id, amount: Number(i.amount) || 0 })),
          }), { success: "Fee structure saved", onSuccess: () => setOpen(false), onError: (r) => setErrors(r.fieldErrors ?? {}) })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
