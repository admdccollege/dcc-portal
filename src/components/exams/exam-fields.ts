import type { FieldConfig } from "@/components/shared/record-dialog";
import type { ReferenceData } from "@/lib/queries/reference";

export function examFields(ref: ReferenceData, types: { id: string; name: string }[], schemes: { id: string; name: string }[], editing: boolean): FieldConfig[] {
  const base: FieldConfig[] = [
    { name: "name", label: "Examination name", required: true, full: true, placeholder: "e.g. First Terminal Examination" },
    { name: "examination_type_id", label: "Type", type: "select", required: true, options: types.map((t) => ({ value: t.id, label: t.name })) },
    { name: "grading_scheme_id", label: "Grading scheme", type: "select", required: true, options: schemes.map((s) => ({ value: s.id, label: s.name })), hint: "Defaults to the programme's scheme" },
    { name: "start_date", label: "Start date", type: "date" },
    { name: "end_date", label: "End date", type: "date" },
    { name: "marks_entry_deadline", label: "Marks entry deadline (IST)", type: "datetime-local" },
    { name: "candidate_mode", label: "Candidates", type: "select", required: true, options: [{ value: "all_enrolled", label: "All students enrolled in the subjects" }, { value: "selected", label: "Selected candidates only (improvement / supplementary)" }] },
    { name: "is_provisional", label: "Results are provisional", type: "checkbox", full: true },
  ];
  if (editing) return base;
  return [
    { name: "academic_session_id", label: "Academic session", type: "select", required: true, options: ref.sessions.map((s) => ({ value: s.id, label: s.name })) },
    { name: "programme_id", label: "Programme", type: "select", required: true, options: ref.programmes.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })) },
    ...ref.programmes.map<FieldConfig>((p) => ({
      name: "term_id", label: "Class / semester", type: "select", required: true,
      options: ref.terms.filter((t) => t.programme_id === p.id).map((t) => ({ value: t.id, label: t.name })),
      showIf: { field: "programme_id", values: [p.id] },
    })),
    ...base,
  ];
}
