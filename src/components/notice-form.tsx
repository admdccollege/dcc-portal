"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { useServerAction } from "@/hooks/use-server-action";
import { saveNotice } from "@/server/notice-actions";

type Audience = { audience: "everyone" | "all_students" | "all_staff" | "programme" | "class"; programme_id?: string | null; term_id?: string | null };
type Values = { id?: string; title: string; body: string; category: string; publish_at: string; expires_at: string; is_pinned: boolean; audiences: Audience[] };

export function NoticeForm({ initial, programmes, terms }: { initial?: Values; programmes: { id: string; code: string }[]; terms: { id: string; programme_id: string; name: string }[] }) {
  const router = useRouter();
  const blank: Values = { title: "", body: "", category: "general", publish_at: "", expires_at: "", is_pinned: false, audiences: [{ audience: "everyone" }] };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Values>(initial ?? blank);
  const [target, setTarget] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const { pending, run } = useServerAction();
  const has = (a: Audience["audience"]) => v.audiences.some((x) => x.audience === a);
  const toggle = (a: Audience["audience"], on: boolean) => setV((s) => ({ ...s, audiences: on ? [...s.audiences, { audience: a }] : s.audiences.filter((x) => x.audience !== a) }));
  const label = (a: Audience) => a.audience === "class" ? `${programmes.find((p) => p.id === a.programme_id)?.code} · ${terms.find((t) => t.id === a.term_id)?.name}` : `${programmes.find((p) => p.id === a.programme_id)?.code} (all classes)`;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV(initial ?? blank); setErrors({}); } }}>
      <DialogTrigger asChild>{initial ? <Button size="sm" variant="outline"><Pencil /> Edit</Button> : <Button size="sm"><Plus /> New notice</Button>}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{initial ? "Edit notice" : "New notice"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" htmlFor="n-title" required error={errors.title?.[0]} className="sm:col-span-2"><Input id="n-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
          <Field label="Category" htmlFor="n-cat">
            <NativeSelect id="n-cat" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>
              {["academic", "examination", "admission", "holiday", "fee", "general"].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
            </NativeSelect>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><Checkbox checked={v.is_pinned} onCheckedChange={(c) => setV({ ...v, is_pinned: !!c })} aria-label="Pin notice" /> Pin to top</label>
          <Field label="Publish from (IST)" htmlFor="n-pub" hint="Blank = immediately when published"><Input id="n-pub" type="datetime-local" value={v.publish_at} onChange={(e) => setV({ ...v, publish_at: e.target.value })} /></Field>
          <Field label="Expires (IST)" htmlFor="n-exp" error={errors.expires_at?.[0]}><Input id="n-exp" type="datetime-local" value={v.expires_at} onChange={(e) => setV({ ...v, expires_at: e.target.value })} /></Field>
          <Field label="Notice text" htmlFor="n-body" required error={errors.body?.[0]} className="sm:col-span-2"><Textarea id="n-body" rows={7} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} /></Field>
        </div>
        <fieldset className="space-y-2 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">Audience</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {([["everyone", "Everyone"], ["all_students", "All students"], ["all_staff", "All staff"]] as const).map(([a, l]) => (
              <label key={a} className="flex items-center gap-2"><Checkbox checked={has(a)} onCheckedChange={(c) => toggle(a, !!c)} aria-label={l} />{l}</label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {v.audiences.filter((a) => a.audience === "programme" || a.audience === "class").map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">{label(a)}
                <button type="button" aria-label="Remove audience" onClick={() => setV((s) => ({ ...s, audiences: s.audiences.filter((x) => x !== a) }))} className="cursor-pointer"><X className="size-3" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <NativeSelect aria-label="Add programme or class" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Add a programme or class…</option>
              {programmes.map((p) => (
                <optgroup key={p.id} label={p.code}>
                  <option value={`p:${p.id}`}>{p.code} — all classes</option>
                  {terms.filter((t) => t.programme_id === p.id).map((t) => <option key={t.id} value={`c:${p.id}:${t.id}`}>{p.code} · {t.name}</option>)}
                </optgroup>
              ))}
            </NativeSelect>
            <Button type="button" variant="outline" disabled={!target} onClick={() => {
              const [k, p, t] = target.split(":");
              setV((s) => ({ ...s, audiences: [...s.audiences, k === "p" ? { audience: "programme", programme_id: p } : { audience: "class", programme_id: p, term_id: t }] }));
              setTarget("");
            }}>Add</Button>
          </div>
          {errors.audiences && <p className="text-xs text-destructive">{errors.audiences[0]}</p>}
        </fieldset>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button loading={pending} onClick={() => run(() => saveNotice({ ...v, id: v.id ?? "", category: v.category as "general" }), {
            success: "Notice saved (publish it to make it visible)", onSuccess: (id) => { setOpen(false); router.push(`/notices/${id}`); }, onError: (r) => setErrors(r.fieldErrors ?? {}),
          })}>Save draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AttachmentUpload({ noticeId, action }: { noticeId: string; action: (fd: FormData) => Promise<{ ok: boolean; error?: string }> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <Input type="file" accept=".pdf,.jpg,.jpeg,.png" aria-label="Attach a file" disabled={busy} onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setBusy(true); setError(null);
        const fd = new FormData(); fd.set("file", f); fd.set("notice_id", noticeId);
        const r = await action(fd);
        setBusy(false);
        if (!r.ok) setError(r.error ?? "Upload failed"); else router.refresh();
        e.target.value = "";
      }} />
      <p className="text-xs text-muted-foreground">PDF, JPEG or PNG up to 10 MB. Stored privately.</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
