"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/shared/field";
import { useServerAction } from "@/hooks/use-server-action";
import type { ActionResult } from "@/lib/actions";
import { cn } from "@/lib/utils";

export type FieldConfig = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime-local" | "time" | "email" | "select" | "checkbox" | "textarea";
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  placeholder?: string;
  step?: string;
  full?: boolean;
  /** Show this field only when another field has one of these values */
  showIf?: { field: string; values: string[] };
};

type Values = Record<string, string | boolean>;

/**
 * Generic create/edit dialog driven by a field list. Values are sent to the
 * given server action as plain strings/booleans; the action validates with zod.
 */
export function RecordDialog({
  title, description, fields, initial = {}, action, success = "Saved", mode = "create", triggerLabel, triggerVariant, triggerSize = "sm", wide,
}: {
  title: string;
  description?: string;
  fields: FieldConfig[];
  initial?: Values;
  action: (values: Values) => Promise<ActionResult<unknown>>;
  success?: string;
  mode?: "create" | "edit";
  triggerLabel?: string;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const { pending, run } = useServerAction();

  const set = (k: string, v: string | boolean) => setValues((s) => ({ ...s, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setValues(initial); setErrors({}); } }}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button size={triggerSize} variant={triggerVariant}><Plus /> {triggerLabel ?? title}</Button>
        ) : (
          triggerLabel ? (
            <Button size={triggerSize} variant={triggerVariant ?? "outline"}><Pencil /> {triggerLabel}</Button>
          ) : (
            <Button size="icon" variant={triggerVariant ?? "ghost"} aria-label={`Edit: ${title}`} className="size-8"><Pencil /></Button>
          )
        )}
      </DialogTrigger>
      <DialogContent className={cn(wide && "max-w-2xl")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => action(values), { success, onSuccess: () => setOpen(false), onError: (r) => setErrors(r.fieldErrors ?? {}) });
          }}
        >
          <div className={cn("grid gap-3", wide && "sm:grid-cols-2")}>
            {fields.map((f, idx) => {
              if (f.showIf && !f.showIf.values.includes(String(values[f.showIf.field] ?? ""))) return null;
              const id = `rd-${f.name}`;
              const err = errors[f.name]?.[0];
              const common = { id, "aria-invalid": !!err || undefined, required: f.required };
              if (f.type === "checkbox") {
                return (
                  <label key={`${f.name}-${idx}`} className={cn("flex items-center gap-2 text-sm", wide && f.full && "sm:col-span-2")}>
                    <Checkbox checked={!!values[f.name]} onCheckedChange={(c) => set(f.name, !!c)} aria-label={f.label} />
                    {f.label}
                    {f.hint && <span className="text-xs text-muted-foreground">— {f.hint}</span>}
                  </label>
                );
              }
              return (
                <Field key={`${f.name}-${idx}`} label={f.label} htmlFor={id} error={err} hint={f.hint} required={f.required} className={cn(wide && f.full && "sm:col-span-2")}>
                  {f.type === "select" ? (
                    <NativeSelect {...common} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)}>
                      <option value="">{f.required ? "Select…" : "— None —"}</option>
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </NativeSelect>
                  ) : f.type === "textarea" ? (
                    <Textarea {...common} rows={4} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />
                  ) : (
                    <Input {...common} type={f.type ?? "text"} step={f.step} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />
                  )}
                </Field>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>{mode === "create" ? "Create" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
