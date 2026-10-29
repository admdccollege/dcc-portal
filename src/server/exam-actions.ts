"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAction, check, one, ActionError } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { optionalDate, requiredText } from "@/lib/validation/common";

const optGuid = z.union([z.guid(), z.literal("")]).optional().transform((v) => (v ? v : null));
const optTs = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/), z.literal("")]).optional()
  // datetime-local values are entered in India Standard Time
  .transform((v) => (v ? new Date(`${v.slice(0, 16)}:00+05:30`).toISOString() : null));
const bool = z.union([z.boolean(), z.literal("")]).optional().transform((v) => v === true);

function refresh(examId?: string | null) {
  revalidatePath("/examinations");
  if (examId) revalidatePath(`/examinations/${examId}`);
  revalidatePath("/results");
}

const examSchema = z.object({
  id: optGuid,
  academic_session_id: z.guid("Select a session"),
  programme_id: z.guid("Select a programme"),
  term_id: z.guid("Select a class"),
  examination_type_id: z.guid("Select the type"),
  grading_scheme_id: z.guid("Select a grading scheme"),
  name: requiredText("Name", 120),
  start_date: optionalDate,
  end_date: optionalDate,
  marks_entry_deadline: optTs,
  candidate_mode: z.enum(["all_enrolled", "selected"]).default("all_enrolled"),
  is_provisional: bool,
});

export const saveExam = createAction(examSchema, { permission: "exams.manage" }, async ({ id, ...v }) => {
  const supabase = await createClient();
  const row = { ...v, start_date: v.start_date ?? null, end_date: v.end_date ?? null };
  if (id) {
    const { academic_session_id: _s, programme_id: _p, term_id: _t, ...editable } = row;
    void _s; void _p; void _t;
    const res = check(await supabase.from("examinations").update(editable).eq("id", id).select("id"));
    if (!res?.length) throw new ActionError("This examination can no longer be edited (marks are locked or results processed).");
    refresh(id);
    return id;
  }
  const created = one(await supabase.from("examinations").insert(row).select("id").single());
  refresh();
  return created.id;
});

export const deleteExam = createAction(z.object({ id: z.guid() }), { permission: "exams.manage" }, async ({ id }) => {
  const supabase = await createClient();
  const res = check(await supabase.from("examinations").delete().eq("id", id).select("id"));
  if (!res?.length) throw new ActionError("Only draft examinations can be deleted.");
  refresh();
  redirect("/examinations");
});

const subjectSchema = z.object({
  id: optGuid,
  examination_id: z.guid(),
  course_offering_id: z.guid("Select a subject"),
  component: z.enum(["theory", "practical", "internal", "combined"]),
  max_marks: z.coerce.number().positive("Must be greater than 0").max(1000),
  pass_marks: z.union([z.coerce.number().min(0), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : Number(v))),
  exam_date: optionalDate,
  start_time: z.union([z.string().regex(/^\d{2}:\d{2}$/), z.literal("")]).optional().transform((v) => v || null),
  duration_minutes: z.union([z.coerce.number().int().positive().max(600), z.literal("")]).optional().transform((v) => (v === "" || v === undefined ? null : Number(v))),
  examiner_staff_id: optGuid,
  marks_deadline: optTs,
}).refine((v) => v.pass_marks === null || v.pass_marks <= v.max_marks, { message: "Pass marks cannot exceed maximum marks", path: ["pass_marks"] });

export const saveExamSubject = createAction(subjectSchema, { permission: "exams.manage" }, async ({ id, ...v }) => {
  const supabase = await createClient();
  const row = { ...v, exam_date: v.exam_date ?? null };
  if (id) check(await supabase.from("examination_subjects").update(row).eq("id", id));
  else check(await supabase.from("examination_subjects").insert(row));
  refresh(v.examination_id);
  return null;
});

export const addAllOfferingsToExam = createAction(
  z.object({ examination_id: z.guid(), component: z.enum(["theory", "practical", "internal", "combined"]), max_marks: z.coerce.number().positive().max(1000), pass_marks: z.union([z.coerce.number().min(0), z.literal("")]).optional() }),
  { permission: "exams.manage" },
  async (v) => {
    const supabase = await createClient();
    const exam = one(await supabase.from("examinations").select("academic_session_id, programme_id, term_id").eq("id", v.examination_id).single());
    const offs = check(await supabase.from("course_offerings").select("id").eq("academic_session_id", exam.academic_session_id).eq("term_id", exam.term_id)) ?? [];
    if (!offs.length) throw new ActionError("This class has no subject offerings.");
    const pass = v.pass_marks === "" || v.pass_marks === undefined ? null : Number(v.pass_marks);
    if (pass !== null && pass > v.max_marks) throw new ActionError("Pass marks cannot exceed maximum marks.");
    check(await supabase.from("examination_subjects").upsert(
      offs.map((o) => ({ examination_id: v.examination_id, course_offering_id: o.id, component: v.component, max_marks: v.max_marks, pass_marks: pass })),
      { onConflict: "examination_id,course_offering_id,component", ignoreDuplicates: true },
    ));
    refresh(v.examination_id);
    return offs.length;
  },
);

export const deleteExamSubject = createAction(z.object({ id: z.guid(), examination_id: z.guid() }), { permission: "exams.manage" }, async (v) => {
  const supabase = await createClient();
  check(await supabase.from("examination_subjects").delete().eq("id", v.id));
  refresh(v.examination_id);
  return null;
});

const transitionSchema = z.object({
  id: z.guid(),
  to: z.enum(["scheduled", "marks_entry", "marks_locked", "results_approved", "published", "results_processed"]),
  reason: z.string().trim().max(500).optional(),
});

/** Every transition is validated and permission-checked inside public.transition_examination(). */
export const transitionExam = createAction(transitionSchema, { permission: ["exams.manage", "marks.lock", "results.approve", "results.publish", "results.unpublish"] }, async (v) => {
  const supabase = await createClient();
  check(await supabase.rpc("transition_examination", { p_exam_id: v.id, p_to: v.to, p_reason: v.reason || undefined }));
  refresh(v.id);
  return null;
});

export const processResults = createAction(z.object({ id: z.guid() }), { permission: "results.process", rateLimitPerMinute: 10 }, async ({ id }) => {
  const supabase = await createClient();
  const n = check(await supabase.rpc("compute_exam_results", { p_exam_id: id }));
  refresh(id);
  revalidatePath(`/results/${id}`);
  return n as number;
});

export const addCandidatesFromFailures = createAction(
  z.object({ target_exam_id: z.guid(), source_exam_id: z.guid("Select the source examination") }),
  { permission: "exams.manage" },
  async (v) => {
    const supabase = await createClient();
    const n = check(await supabase.rpc("add_candidates_from_failures", { p_target_exam_id: v.target_exam_id, p_source_exam_id: v.source_exam_id }));
    refresh(v.target_exam_id);
    return n as number;
  },
);

// ---------------------------------------------------------------------------
// Marks entry
// ---------------------------------------------------------------------------
const STATUSES = ["present", "absent", "exempted", "malpractice", "withheld"] as const;
const saveMarksSchema = z.object({
  exam_subject_id: z.guid(),
  examination_id: z.guid(),
  reason: z.string().trim().max(500).optional(),
  entries: z.array(z.object({
    student_id: z.guid(),
    status: z.enum(STATUSES),
    marks: z.number().min(0).max(1000).nullable(),
  })).max(500),
});

/** Assignment, deadline, lock and max-marks validation happen in public.save_marks(). */
export const saveMarks = createAction(saveMarksSchema, { permission: ["marks.enter", "marks.enter_all"], rateLimitPerMinute: 60 }, async (v) => {
  const supabase = await createClient();
  const n = check(await supabase.rpc("save_marks", { p_exam_subject_id: v.exam_subject_id, p_entries: v.entries, p_reason: v.reason || undefined }));
  revalidatePath(`/examinations/${v.examination_id}`);
  return n as number;
});
