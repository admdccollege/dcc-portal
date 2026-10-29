"use client";

import { useMemo, useRef, useState } from "react";
import { FileUp, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useServerAction } from "@/hooks/use-server-action";
import { saveMarks } from "@/server/exam-actions";
import { validateMark } from "@/lib/domain/grading";
import { parseMarksCsv } from "@/lib/domain/marks-csv";
import { cn } from "@/lib/utils";

type Row = { student_id: string; roll_no: string | null; name: string; admission_no: string };
type Existing = Record<string, { marks: number | null; status: string; revision: number }>;
const STATUS_LABELS: Record<string, string> = { present: "Present", absent: "Absent", exempted: "Exempted", malpractice: "Malpractice", withheld: "Withheld" };

export function MarksGrid({ examId, examSubjectId, rows, existing, maxMarks, passMarks, editable, afterDeadline, readOnlyReason }: {
  examId: string;
  examSubjectId: string;
  rows: Row[];
  existing: Existing;
  maxMarks: number;
  passMarks: number | null;
  editable: boolean;
  afterDeadline: boolean;
  readOnlyReason?: string;
}) {
  const init = useMemo(() => Object.fromEntries(rows.map((r) => [r.student_id, {
    marks: existing[r.student_id]?.marks?.toString() ?? "",
    status: existing[r.student_id]?.status ?? "present",
  }])), [rows, existing]);
  const [values, setValues] = useState(init);
  const [reason, setReason] = useState("");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { pending, run } = useServerAction();

  const dirtyIds = rows.filter((r) => values[r.student_id].marks !== init[r.student_id].marks || values[r.student_id].status !== init[r.student_id].status).map((r) => r.student_id);
  const errors = Object.fromEntries(rows.map((r) => {
    const v = values[r.student_id];
    return [r.student_id, v.status === "present" ? validateMark(v.marks, maxMarks) : null];
  }));
  const errorCount = Object.values(errors).filter(Boolean).length;
  const missing = rows.filter((r) => values[r.student_id].status === "present" && values[r.student_id].marks.trim() === "").length;
  const absent = rows.filter((r) => values[r.student_id].status === "absent").length;
  const changedExisting = dirtyIds.filter((id) => existing[id]).length;
  const reasonNeeded = afterDeadline && dirtyIds.length > 0;

  const set = (id: string, patch: Partial<{ marks: string; status: string }>) => setValues((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  const focus = (i: number) => { const el = inputs.current[Math.max(0, Math.min(rows.length - 1, i))]; el?.focus(); el?.select(); };

  const onPaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!/[\n\t]/.test(text.trim())) return;
    e.preventDefault();
    const vals = text.trim().split(/\r?\n/).map((l) => l.split("\t")[0].trim());
    setValues((s) => {
      const next = { ...s };
      vals.forEach((v, k) => {
        const r = rows[i + k];
        if (!r) return;
        const lower = v.toLowerCase();
        if (lower === "ab" || lower === "absent") next[r.student_id] = { marks: "", status: "absent" };
        else next[r.student_id] = { marks: v, status: "present" };
      });
      return next;
    });
    toast.info(`Pasted ${Math.min(vals.length, rows.length - i)} value(s). Review and save.`);
  };

  const onCsv = async (file: File) => {
    const res = parseMarksCsv(await file.text(), rows, maxMarks);
    if (!res.ok) return toast.error(res.error);
    setValues((s) => {
      const next = { ...s };
      for (const [id, v] of Object.entries(res.entries)) next[id] = v;
      return next;
    });
    if (res.issues.length) toast.warning(`${Object.keys(res.entries).length} row(s) loaded, ${res.issues.length} skipped: ${res.issues.slice(0, 3).join("; ")}${res.issues.length > 3 ? "…" : ""}`, { duration: 10000 });
    else toast.success(`${Object.keys(res.entries).length} row(s) loaded from file. Review and save.`);
  };

  const save = () => {
    const entries = dirtyIds.map((id) => {
      const v = values[id];
      return { student_id: id, status: v.status as "present", marks: v.status === "present" && v.marks.trim() !== "" ? Number(v.marks) : null };
    });
    run(() => saveMarks({ exam_subject_id: examSubjectId, examination_id: examId, reason: reason || undefined, entries }), {
      success: (n) => `${n} mark(s) saved`,
      onSuccess: () => setReason(""),
    });
  };

  const pctFor = (v: { marks: string; status: string }) => (v.status === "present" && v.marks !== "" && !Number.isNaN(Number(v.marks)) ? Number(v.marks) : null);

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        {!editable && <Alert variant="info" title="Read-only">{readOnlyReason}</Alert>}
        {editable && afterDeadline && <Alert variant="warning" title="The marks entry deadline has passed">Corrections are permitted for authorised staff only and require a reason, which is recorded in the audit trail.</Alert>}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary">{rows.length} candidates</Badge>
          <Badge variant={missing ? "warning" : "success"}>{missing} missing</Badge>
          {absent > 0 && <Badge variant="destructive">{absent} absent</Badge>}
          {dirtyIds.length > 0 && <Badge>{dirtyIds.length} unsaved change(s)</Badge>}
          {errorCount > 0 && <Badge variant="destructive">{errorCount} invalid</Badge>}
          <span className="ml-auto text-xs text-muted-foreground">Max {maxMarks}{passMarks !== null ? ` · Pass ${passMarks}` : ""} · Enter/↓ next · ↑ previous · paste a column from Excel · type “AB” for absent</span>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onCsv(f); e.target.value = ""; }} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><FileUp /> Import CSV</Button>
            <Button variant="ghost" size="sm" disabled={!dirtyIds.length} onClick={() => setValues(init)}><RotateCcw /> Discard changes</Button>
            <a className="self-center text-xs text-primary hover:underline" download="marks_template.csv"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent("admission_no,roll_no,marks,status\n" + rows.map((r) => `${r.admission_no},${r.roll_no ?? ""},,`).join("\n"))}`}>
              Download CSV template
            </a>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Roll</th>
                <th className="px-3 py-2 text-left">Student</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Marks / {maxMarks}</th>
                <th className="px-3 py-2 text-left">Check</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const v = values[r.student_id];
                const err = errors[r.student_id];
                const dirty = dirtyIds.includes(r.student_id);
                const m = pctFor(v);
                return (
                  <tr key={r.student_id} className={cn("border-t", dirty && "bg-primary/5", err && "bg-destructive/5")}>
                    <td className="px-3 py-1.5 tabular-nums">{r.roll_no ?? "—"}</td>
                    <td className="px-3 py-1.5"><span className="font-medium">{r.name}</span> <span className="font-mono text-xs text-muted-foreground">{r.admission_no}</span></td>
                    <td className="px-3 py-1.5">
                      <NativeSelect aria-label={`Status for ${r.name}`} className="h-8 w-36" value={v.status} disabled={!editable}
                        onChange={(e) => set(r.student_id, { status: e.target.value, marks: e.target.value === "present" ? v.marks : "" })}>
                        {Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </NativeSelect>
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        ref={(el) => { inputs.current[i] = el; }}
                        aria-label={`Marks for ${r.name}`}
                        aria-invalid={!!err || undefined}
                        inputMode="decimal"
                        className="h-8 w-24 text-right tabular-nums"
                        value={v.marks}
                        disabled={!editable || v.status !== "present"}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (/^ab$/i.test(val.trim())) set(r.student_id, { status: "absent", marks: "" });
                          else set(r.student_id, { marks: val });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); focus(i + 1); }
                          if (e.key === "ArrowUp") { e.preventDefault(); focus(i - 1); }
                        }}
                        onPaste={(e) => onPaste(i, e)}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-xs">
                      {err ? <span className="text-destructive">{err}</span>
                        : v.status !== "present" ? <span className="text-muted-foreground">{STATUS_LABELS[v.status]}</span>
                        : m === null ? <span className="text-warning-foreground dark:text-warning">Missing</span>
                        : passMarks !== null && m < passMarks ? <span className="text-destructive">Below pass ({Math.round((1000 * m) / maxMarks) / 10}%)</span>
                        : <span className="text-success">{Math.round((1000 * m) / maxMarks) / 10}%</span>}
                      {existing[r.student_id]?.revision ? <span className="ml-1 text-muted-foreground">· rev {existing[r.student_id].revision}</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {editable && (
          <div className="sticky bottom-2 space-y-2 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur">
            {(reasonNeeded || changedExisting > 0) && (
              <div className="space-y-1">
                <Label htmlFor="marks-reason">Reason for change{reasonNeeded && <span className="text-destructive"> *</span>}</Label>
                <Textarea id="marks-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={reasonNeeded ? "Required after the deadline" : "Optional — recorded with each revision"} />
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <span className="text-xs text-muted-foreground">Blank marks are saved as missing, never as zero.</span>
              <Button onClick={save} loading={pending} disabled={!dirtyIds.length || errorCount > 0 || (reasonNeeded && reason.trim().length < 5)}><Save /> Save {dirtyIds.length || ""} change(s)</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
