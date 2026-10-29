import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Reference data used by filters and forms (cached per request). */
export const getReferenceData = cache(async () => {
  const supabase = await createClient();
  const [sessions, programmes, terms, settings] = await Promise.all([
    supabase.from("academic_sessions").select("id, name, is_current, start_date, end_date, status").order("start_date", { ascending: false }),
    supabase.from("programmes").select("id, code, name, level, stream, term_kind, total_terms, grading_scheme_id, is_active, awarding_body, department_id").order("level").order("code"),
    supabase.from("programme_terms").select("id, programme_id, sequence, name").order("sequence"),
    supabase.from("institution_settings").select("*").single(),
  ]);
  const sessionList = sessions.data ?? [];
  return {
    sessions: sessionList,
    currentSession: sessionList.find((s) => s.is_current) ?? sessionList[0] ?? null,
    programmes: programmes.data ?? [],
    terms: terms.data ?? [],
    settings: settings.data,
  };
});

export type ReferenceData = Awaited<ReturnType<typeof getReferenceData>>;

export function sessionOptions(ref: ReferenceData) {
  return ref.sessions.map((s) => ({ value: s.id, label: s.name + (s.is_current ? " (current)" : "") }));
}
export function programmeOptions(ref: ReferenceData) {
  return ref.programmes.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }));
}
/** "Class" = programme + term, the unit used for attendance/exams. */
export function classOptions(ref: ReferenceData) {
  return ref.terms
    .map((t) => {
      const p = ref.programmes.find((x) => x.id === t.programme_id);
      return p ? { value: `${p.id}:${t.id}`, label: `${p.code} · ${t.name}`, programmeId: p.id, termId: t.id } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}
export function termName(ref: ReferenceData, termId: string | null | undefined) {
  return ref.terms.find((t) => t.id === termId)?.name ?? "—";
}
export function programmeCode(ref: ReferenceData, programmeId: string | null | undefined) {
  return ref.programmes.find((p) => p.id === programmeId)?.code ?? "—";
}

export function param(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length < 200 ? s : undefined;
}
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuidParam(v: string | string[] | undefined): string | undefined {
  const s = param(v);
  return s && UUID_RE.test(s) ? s : undefined;
}
