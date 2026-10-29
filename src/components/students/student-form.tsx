"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/shared/field";
import { useServerAction } from "@/hooks/use-server-action";
import { createStudentSchema, updateStudentSchema, GENDERS, type CreateStudentInput, type UpdateStudentInput } from "@/lib/validation/student";
import { createStudent, updateStudent } from "@/server/student-actions";
import { titleCase } from "@/lib/utils";

type Opt = { id: string; name: string };
type Offering = { id: string; programme_id: string; term_id: string; academic_session_id: string; is_compulsory: boolean; label: string };

type Props =
  | { mode: "create"; sessions: Opt[]; programmes: (Opt & { code: string })[]; terms: { id: string; programme_id: string; name: string }[]; offerings: Offering[]; defaults: Partial<CreateStudentInput> }
  | { mode: "edit"; defaults: UpdateStudentInput };

export function StudentForm(props: Props) {
  const router = useRouter();
  const { pending, run } = useServerAction();
  const schema = props.mode === "create" ? createStudentSchema : updateStudentSchema;
  type FormValues = CreateStudentInput & { id?: string };
  const form = useForm<FormValues>({
    resolver: zodResolver(schema as typeof createStudentSchema) as unknown as Resolver<FormValues>,
    defaultValues: { gender: "undisclosed", offering_ids: [], ...(props.defaults as object) },
  });
  const { register, handleSubmit, formState: { errors }, control, setValue, setError } = form;
  const err = (k: string) => (errors as Record<string, { message?: string }>)[k]?.message;

  const programmeId = useWatch({ control, name: "programme_id" });
  const termId = useWatch({ control, name: "term_id" });
  const sessionId = useWatch({ control, name: "academic_session_id" });
  const selected = useWatch({ control, name: "offering_ids" }) ?? [];

  const classOfferings = useMemo(
    () => (props.mode === "create" ? props.offerings.filter((o) => o.programme_id === programmeId && o.term_id === termId && o.academic_session_id === sessionId) : []),
    [props, programmeId, termId, sessionId],
  );

  const onSubmit = handleSubmit((values) => {
    const action = props.mode === "create" ? () => createStudent(values) : () => updateStudent(values as unknown as UpdateStudentInput);
    run(action, {
      success: props.mode === "create" ? "Student record created" : "Student record updated",
      onSuccess: (id) => router.push(`/students/${id}`),
      onError: (r) => {
        for (const [k, v] of Object.entries(r.fieldErrors ?? {})) setError(k as keyof CreateStudentInput, { message: v[0] });
      },
    });
  });

  const reg = (name: keyof FormValues) => ({ id: name, "aria-invalid": !!err(name) || undefined, ...register(name) });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Card>
        <CardHeader><CardTitle>Personal details</CardTitle><CardDescription>Collect only information that is required. Do not record Aadhaar numbers here.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Full name" htmlFor="full_name" error={err("full_name")} required className="lg:col-span-2"><Input {...reg("full_name")} autoComplete="off" /></Field>
          <Field label="Date of birth" htmlFor="date_of_birth" error={err("date_of_birth")} required><Input type="date" {...reg("date_of_birth")} /></Field>
          <Field label="Gender" htmlFor="gender" error={err("gender")}>
            <NativeSelect {...reg("gender")}>{GENDERS.map((g) => <option key={g} value={g}>{titleCase(g)}</option>)}</NativeSelect>
          </Field>
          <Field label="Phone" htmlFor="phone" error={err("phone")}><Input type="tel" {...reg("phone")} /></Field>
          <Field label="Email" htmlFor="email" error={err("email")}><Input type="email" {...reg("email")} /></Field>
          <Field label="Residential address" htmlFor="address" error={err("address")} className="sm:col-span-2 lg:col-span-3"><Textarea rows={2} {...reg("address")} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Guardian</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Guardian name" htmlFor="guardian_name" error={err("guardian_name")} className="lg:col-span-2"><Input {...reg("guardian_name")} /></Field>
          <Field label="Relationship" htmlFor="guardian_relationship" error={err("guardian_relationship")}><Input placeholder="Father / Mother / …" {...reg("guardian_relationship")} /></Field>
          <Field label="Guardian phone" htmlFor="guardian_phone" error={err("guardian_phone")}><Input type="tel" {...reg("guardian_phone")} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Admission & identifiers</CardTitle><CardDescription>Leave the admission number blank to generate the next number automatically.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Admission number" htmlFor="admission_no" error={err("admission_no")} hint={props.mode === "create" ? "Auto-generated if blank" : undefined}><Input {...reg("admission_no")} /></Field>
          <Field label="Admission date" htmlFor="admission_date" error={err("admission_date")}><Input type="date" {...reg("admission_date")} /></Field>
          <Field label="University / council roll no." htmlFor="university_roll_no" error={err("university_roll_no")}><Input {...reg("university_roll_no")} /></Field>
          <Field label="Registration no." htmlFor="registration_no" error={err("registration_no")}><Input {...reg("registration_no")} /></Field>
          <Field label="Scholarship / concession note" htmlFor="scholarship_note" error={err("scholarship_note")} className="sm:col-span-2 lg:col-span-4"><Input {...reg("scholarship_note")} /></Field>
        </CardContent>
      </Card>

      {props.mode === "create" && (
        <Card>
          <CardHeader><CardTitle>Enrolment</CardTitle><CardDescription>Compulsory subjects are added automatically; choose any optional subjects below.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Academic session" htmlFor="academic_session_id" error={err("academic_session_id")} required>
                <NativeSelect {...reg("academic_session_id")}>{props.sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect>
              </Field>
              <Field label="Programme" htmlFor="programme_id" error={err("programme_id")} required className="lg:col-span-2">
                <NativeSelect {...reg("programme_id")} onChange={(e) => { setValue("programme_id", e.target.value); setValue("term_id", ""); setValue("offering_ids", []); }}>
                  <option value="">Select programme</option>
                  {props.programmes.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Class / semester" htmlFor="term_id" error={err("term_id")} required>
                <NativeSelect {...reg("term_id")} onChange={(e) => { setValue("term_id", e.target.value); setValue("offering_ids", []); }}>
                  <option value="">Select</option>
                  {props.terms.filter((t) => t.programme_id === programmeId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Roll number" htmlFor="roll_no" error={err("roll_no")}><Input {...reg("roll_no")} /></Field>
            </div>
            {classOfferings.length > 0 && (
              <fieldset className="rounded-lg border p-3">
                <legend className="px-1 text-sm font-medium">Subjects</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {classOfferings.map((o) => {
                    const checked = o.is_compulsory || selected.includes(o.id);
                    return (
                      <label key={o.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          disabled={o.is_compulsory}
                          onCheckedChange={(c) => setValue("offering_ids", c ? [...selected, o.id] : selected.filter((x) => x !== o.id))}
                          aria-label={o.label}
                        />
                        <span>{o.label}{o.is_compulsory && <span className="ml-1 text-xs text-muted-foreground">(compulsory)</span>}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" loading={pending}>{props.mode === "create" ? "Create student" : "Save changes"}</Button>
      </div>
    </form>
  );
}
