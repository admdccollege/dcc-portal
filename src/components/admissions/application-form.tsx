"use client";

import { useRouter } from "next/navigation";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/shared/field";
import { useServerAction } from "@/hooks/use-server-action";
import { createApplication } from "@/server/admission-actions";
import { applicationSchema, type ApplicationInput } from "@/lib/validation/admission";

type Period = { id: string; title: string; offerings: { id: string; label: string; is_compulsory: boolean }[]; required_documents: string[]; open: boolean };

export function ApplicationForm({ periods }: { periods: Period[] }) {
  const router = useRouter();
  const { pending, run } = useServerAction();
  const { register, handleSubmit, control, setValue, setError, formState: { errors } } = useForm<ApplicationInput>({
    resolver: zodResolver(applicationSchema) as unknown as Resolver<ApplicationInput>,
    defaultValues: { gender: "undisclosed", preferred_offering_ids: [], admission_period_id: periods.find((p) => p.open)?.id ?? "" },
  });
  const err = (k: keyof ApplicationInput) => errors[k]?.message as string | undefined;
  const reg = (k: keyof ApplicationInput) => ({ id: k, "aria-invalid": !!err(k) || undefined, ...register(k) });
  const periodId = useWatch({ control, name: "admission_period_id" });
  const chosen = useWatch({ control, name: "preferred_offering_ids" }) ?? [];
  const period = periods.find((p) => p.id === periodId);

  return (
    <form noValidate className="space-y-5" onSubmit={handleSubmit((v) => run(() => createApplication(v), {
      success: "Application created", onSuccess: (id) => router.push(`/admissions/${id}`),
      onError: (r) => Object.entries(r.fieldErrors ?? {}).forEach(([k, m]) => setError(k as keyof ApplicationInput, { message: m[0] })),
    }))}>
      <Card>
        <CardHeader><CardTitle>Programme</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Admission period" htmlFor="admission_period_id" required error={err("admission_period_id")}>
            <NativeSelect {...reg("admission_period_id")} onChange={(e) => { setValue("admission_period_id", e.target.value); setValue("preferred_offering_ids", []); }}>
              <option value="">Select</option>
              {periods.map((p) => <option key={p.id} value={p.id}>{p.title}{p.open ? "" : " (closed)"}</option>)}
            </NativeSelect>
          </Field>
          {period && period.offerings.some((o) => !o.is_compulsory) && (
            <fieldset className="rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">Subject preferences (optional subjects)</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {period.offerings.filter((o) => !o.is_compulsory).map((o) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={chosen.includes(o.id)} aria-label={o.label} onCheckedChange={(c) => setValue("preferred_offering_ids", c ? [...chosen, o.id] : chosen.filter((x) => x !== o.id))} />{o.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {period && period.required_documents.length > 0 && <p className="text-sm text-muted-foreground">Documents required: {period.required_documents.join(", ")}. A checklist is created automatically.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Applicant</CardTitle><CardDescription>Do not record Aadhaar or other unnecessary identity numbers.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Full name" htmlFor="applicant_name" required error={err("applicant_name")} className="lg:col-span-2"><Input {...reg("applicant_name")} /></Field>
          <Field label="Date of birth" htmlFor="date_of_birth" required error={err("date_of_birth")}><Input type="date" {...reg("date_of_birth")} /></Field>
          <Field label="Gender" htmlFor="gender"><NativeSelect {...reg("gender")}><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="undisclosed">Prefer not to say</option></NativeSelect></Field>
          <Field label="Phone" htmlFor="phone" required error={err("phone")}><Input type="tel" {...reg("phone")} /></Field>
          <Field label="Email" htmlFor="email" error={err("email")}><Input type="email" {...reg("email")} /></Field>
          <Field label="Address" htmlFor="address" className="sm:col-span-2 lg:col-span-3"><Textarea rows={2} {...reg("address")} /></Field>
          <Field label="Guardian name" htmlFor="guardian_name"><Input {...reg("guardian_name")} /></Field>
          <Field label="Relationship" htmlFor="guardian_relationship"><Input {...reg("guardian_relationship")} /></Field>
          <Field label="Guardian phone" htmlFor="guardian_phone" error={err("guardian_phone")}><Input type="tel" {...reg("guardian_phone")} /></Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Previous qualification</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Institution" htmlFor="previous_institution" className="lg:col-span-2"><Input {...reg("previous_institution")} /></Field>
          <Field label="Board / University" htmlFor="previous_board"><Input {...reg("previous_board")} /></Field>
          <Field label="Examination" htmlFor="previous_exam"><Input placeholder="Class X / XII / B.A." {...reg("previous_exam")} /></Field>
          <Field label="Year" htmlFor="previous_year" error={err("previous_year")}><Input inputMode="numeric" {...reg("previous_year")} /></Field>
          <Field label="Percentage" htmlFor="previous_percentage" error={err("previous_percentage")}><Input inputMode="decimal" {...reg("previous_percentage")} /></Field>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" loading={pending}>Submit application</Button>
      </div>
    </form>
  );
}
