"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { useServerAction } from "@/hooks/use-server-action";
import { assignTeacher, removeAssignment } from "@/server/academics-actions";

export function AssignTeacher({ offeringId, label, staff }: { offeringId: string; label: string; staff: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [role, setRole] = useState<"teacher" | "examiner">("teacher");
  const { pending, run } = useServerAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" className="size-7" aria-label={`Assign teacher to ${label}`}><UserPlus className="size-3.5" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign to {label}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Staff member" htmlFor="as-staff" required>
            <NativeSelect id="as-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Select…</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Role" htmlFor="as-role">
            <NativeSelect id="as-role" value={role} onChange={(e) => setRole(e.target.value as "teacher")}>
              <option value="teacher">Teacher</option>
              <option value="examiner">Examiner</option>
            </NativeSelect>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!staffId} loading={pending} onClick={() => run(() => assignTeacher({ course_offering_id: offeringId, staff_id: staffId, role }), { success: "Assigned", onSuccess: () => setOpen(false) })}>Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AssignmentChip({ id, name, role, canRemove }: { id: string; name: string; role: string; canRemove: boolean }) {
  const { pending, run } = useServerAction();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
      {name}{role === "examiner" && <span className="text-muted-foreground">(examiner)</span>}
      {canRemove && (
        <button
          type="button"
          disabled={pending}
          className="rounded-full p-0.5 hover:bg-destructive/15 hover:text-destructive cursor-pointer"
          aria-label={`Remove ${name}`}
          onClick={() => { if (confirm(`Remove ${name} from this subject?`)) run(() => removeAssignment({ id }), { success: "Removed" }); }}
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}
