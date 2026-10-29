"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useServerAction } from "@/hooks/use-server-action";
import { promoteStudents } from "@/server/student-actions";
import { EmptyState } from "@/components/ui/misc";

export function PromotionTool({ rows, isFinalTerm, sessions, currentSessionId, threshold }: {
  rows: { id: string; roll_no: string | null; name: string; admission_no: string; percentage: number | null }[];
  isFinalTerm: boolean;
  sessions: { id: string; name: string }[];
  currentSessionId: string;
  threshold: number;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<"promote" | "repeat" | "graduate">(isFinalTerm ? "graduate" : "promote");
  const [target, setTarget] = useState(sessions.find((s) => s.id !== currentSessionId)?.id ?? currentSessionId);
  const [reason, setReason] = useState("");
  const { pending, run } = useServerAction();
  if (rows.length === 0) return <EmptyState title="No active students in this class" />;
  const all = selected.length === rows.length;

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Action" htmlFor="pr-action">
            <NativeSelect id="pr-action" value={action} onChange={(e) => setAction(e.target.value as typeof action)}>
              {!isFinalTerm && <option value="promote">Promote to next term</option>}
              <option value="repeat">Repeat this term</option>
              {isFinalTerm && <option value="graduate">Graduate (programme completed)</option>}
            </NativeSelect>
          </Field>
          {action !== "graduate" && (
            <Field label="Target session" htmlFor="pr-session">
              <NativeSelect id="pr-session" value={target} onChange={(e) => setTarget(e.target.value)}>
                {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </Field>
          )}
          <Field label="Remarks" htmlFor="pr-reason" className="sm:col-span-2"><Input id="pr-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Annual promotion 2027" /></Field>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox aria-label="Select all" checked={all} onCheckedChange={(c) => setSelected(c ? rows.map((r) => r.id) : [])} /></TableHead>
              <TableHead>Roll</TableHead><TableHead>Name</TableHead><TableHead>Admission no.</TableHead><TableHead className="text-right">Attendance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Checkbox aria-label={`Select ${r.name}`} checked={selected.includes(r.id)} onCheckedChange={(c) => setSelected(c ? [...selected, r.id] : selected.filter((x) => x !== r.id))} /></TableCell>
                <TableCell>{r.roll_no ?? "—"}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell className="font-mono text-xs">{r.admission_no}</TableCell>
                <TableCell className={`text-right tabular-nums ${r.percentage !== null && r.percentage < threshold ? "font-medium text-destructive" : ""}`}>{r.percentage === null ? "—" : `${r.percentage}%`}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-end">
          <Button
            disabled={selected.length === 0}
            loading={pending}
            onClick={() => run(() => promoteStudents({ enrolment_ids: selected, target_session_id: target, action, reason: reason || undefined }), { success: (n) => `${n} student(s) updated`, onSuccess: () => setSelected([]) })}
          >
            Apply to {selected.length} student(s)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
