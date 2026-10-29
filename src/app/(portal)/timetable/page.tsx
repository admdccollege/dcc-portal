import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, param, programmeCode, termName, uuidParam } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { UrlControls } from "@/components/shared/url-controls";
import { EmptyState } from "@/components/ui/misc";
import { PrintButton } from "@/components/shared/print-button";
import { RecordDialog, type FieldConfig } from "@/components/shared/record-dialog";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { TimetableGrid, DAY_NAMES } from "@/components/timetable-grid";
import { asRecordAction } from "@/lib/record-action";
import { deleteTimetableEntry, saveTimetableEntry } from "@/server/timetable-actions";

export const metadata: Metadata = { title: "Timetable" };

export default async function TimetablePage({ searchParams }: PageProps<"/timetable">) {
  const session = await requirePermission("timetable.view");
  const sp = await searchParams;
  const ref = await getReferenceData();
  const supabase = await createClient();
  const sessionId = ref.currentSession?.id ?? "";
  const view = param(sp.view) === "teacher" ? "teacher" : "class";
  const termId = uuidParam(sp.term);
  const staffId = uuidParam(sp.teacher) ?? (view === "teacher" ? session.staffId ?? undefined : undefined);
  const term = ref.terms.find((t) => t.id === termId);
  const manage = can(session, "timetable.manage");

  const [{ data: periods }, { data: staff }] = await Promise.all([
    supabase.from("timetable_periods").select("*").order("period_no"),
    supabase.rpc("staff_directory"),
  ]);
  let entriesQ = supabase.from("timetable_entries").select("id, day_of_week, period_no, room, staff_id, course_offering_id, programme_id, term_id, section, course_offerings(subjects(code, name))").eq("academic_session_id", sessionId);
  if (view === "class" && term) entriesQ = entriesQ.eq("term_id", term.id);
  else if (view === "teacher" && staffId) entriesQ = entriesQ.eq("staff_id", staffId);
  else entriesQ = entriesQ.eq("id", "00000000-0000-0000-0000-000000000000");
  const [{ data: entries }, { data: offerings }] = await Promise.all([
    entriesQ,
    term ? supabase.from("course_offerings").select("id, subjects(code, name), teacher_assignments(staff_id)").eq("academic_session_id", sessionId).eq("term_id", term.id) : { data: [] },
  ]);
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.full_name]));

  const fields: FieldConfig[] = [
    { name: "course_offering_id", label: "Subject", type: "select", required: true, options: (offerings ?? []).map((o) => ({ value: o.id, label: `${o.subjects?.code} — ${o.subjects?.name}` })) },
    { name: "staff_id", label: "Teacher", type: "select", options: (staff ?? []).filter((s) => s.is_teaching).map((s) => ({ value: s.id, label: s.full_name })) },
    { name: "day_of_week", label: "Day", type: "select", required: true, options: [1, 2, 3, 4, 5, 6].map((d) => ({ value: String(d), label: DAY_NAMES[d] })) },
    { name: "period_no", label: "Period", type: "select", required: true, options: (periods ?? []).map((p) => ({ value: String(p.period_no), label: `P${p.period_no} (${p.start_time.slice(0, 5)})` })) },
    { name: "room", label: "Room" },
  ];
  const base: Record<string, string> = term ? { academic_session_id: sessionId, programme_id: term.programme_id, term_id: term.id, section: "" } : {};

  const gridEntries = (entries ?? []).map((e) => ({
    id: e.id, day_of_week: e.day_of_week, period_no: e.period_no, room: e.room,
    subject: e.course_offerings?.subjects?.code ?? "",
    detail: view === "class" ? (e.staff_id ? staffName.get(e.staff_id) ?? "" : "No teacher") : `${programmeCode(ref, e.programme_id)} ${termName(ref, e.term_id)}`,
    raw: e,
  }));

  return (
    <div className="space-y-5">
      <PageHeader title="Timetable" description={`Weekly schedule · ${ref.currentSession?.name ?? ""}. Class, teacher and room clashes are blocked automatically.`} actions={<PrintButton />} />
      <UrlControls controls={[
        { name: "view", label: "View", type: "select", options: [{ value: "class", label: "Class-wise" }, { value: "teacher", label: "Teacher-wise" }], placeholder: "Class-wise", resets: ["term", "teacher"] },
        ...(view === "class"
          ? [{ name: "term", label: "Class", type: "select" as const, options: ref.terms.map((t) => ({ value: t.id, label: `${programmeCode(ref, t.programme_id)} · ${t.name}` })) }]
          : [{ name: "teacher", label: "Teacher", type: "select" as const, options: (staff ?? []).filter((s) => s.is_teaching).map((s) => ({ value: s.id, label: s.full_name })) }]),
      ]} />
      {(view === "class" && !term) || (view === "teacher" && !staffId) ? <EmptyState title={view === "class" ? "Select a class" : "Select a teacher"} /> : (
        <TimetableGrid
          periods={periods ?? []}
          entries={gridEntries}
          renderEntry={manage && view === "class" ? (e) => {
            const raw = gridEntries.find((x) => x.id === e.id)!.raw;
            return (
              <div className="flex items-start justify-between gap-1">
                <div><p className="font-semibold text-primary">{e.subject}</p><p className="text-muted-foreground">{e.detail}{e.room ? ` · ${e.room}` : ""}</p></div>
                <div className="no-print flex">
                  <RecordDialog mode="edit" title="Edit timetable entry" fields={fields} action={asRecordAction(saveTimetableEntry)}
                    initial={{ ...base, id: raw.id, course_offering_id: raw.course_offering_id, staff_id: raw.staff_id ?? "", day_of_week: String(raw.day_of_week), period_no: String(raw.period_no), room: raw.room ?? "" }} />
                  <ConfirmAction size="icon" variant="ghost" icon={<Trash2 />} label="" title="Remove this timetable entry?" action={deleteTimetableEntry.bind(null, { id: raw.id })} success="Removed" />
                </div>
              </div>
            );
          } : undefined}
          renderEmpty={manage && view === "class" ? (d, p) => (
            <div className="no-print">
              <RecordDialog title={`${DAY_NAMES[d]} · Period ${p}`} triggerLabel="Add" triggerVariant="ghost" fields={fields} action={asRecordAction(saveTimetableEntry)}
                initial={{ ...base, day_of_week: String(d), period_no: String(p), room: "" }} success="Entry added" />
            </div>
          ) : undefined}
        />
      )}
    </div>
  );
}
