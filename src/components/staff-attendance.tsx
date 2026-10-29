"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { useServerAction } from "@/hooks/use-server-action";
import { saveStaffAttendance } from "@/server/staff-actions";

export function StaffAttendanceForm({ date, staff, existing }: { date: string; staff: { id: string; name: string; designation: string }[]; existing: Record<string, string> }) {
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(staff.map((s) => [s.id, existing[s.id] ?? "present"])));
  const { pending, run } = useServerAction();
  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-lg border">
        {staff.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span><span className="font-medium">{s.name}</span> <span className="text-muted-foreground">· {s.designation}</span></span>
            <NativeSelect aria-label={`Attendance for ${s.name}`} className="h-8 w-36" value={vals[s.id]} onChange={(e) => setVals((v) => ({ ...v, [s.id]: e.target.value }))}>
              <option value="present">Present</option><option value="absent">Absent</option><option value="leave">On leave</option><option value="duty">On duty</option>
            </NativeSelect>
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <Button loading={pending} onClick={() => run(() => saveStaffAttendance({ date, records: staff.map((s) => ({ staff_id: s.id, status: vals[s.id] as "present" })) }), { success: "Staff attendance saved" })}>Save staff attendance</Button>
      </div>
    </div>
  );
}
