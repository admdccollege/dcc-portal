"use client";

import { useMemo, useState } from "react";
import { UserPlus, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { Alert } from "@/components/ui/misc";
import { useServerAction } from "@/hooks/use-server-action";
import { createUser } from "@/server/user-actions";
import { RolePicker } from "./role-picker";

export type LinkableStaff = { id: string; full_name: string; employee_id: string; email: string | null };
export type LinkableStudent = { id: string; full_name: string; admission_no: string; email: string | null };

const STAFF_ROLES_NEEDING_RECORD = ["teacher"];

export function AddUserDialog({ staff, students, canGrantSuper }: { staff: LinkableStaff[]; students: LinkableStudent[]; canGrantSuper: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roles, setRoles] = useState<string[]>(["teacher"]);
  const [staffId, setStaffId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [pwMode, setPwMode] = useState<"generate" | "set">("generate");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [created, setCreated] = useState<{ email: string; password: string | null } | null>(null);
  const { pending, run } = useServerAction();

  const isStudent = roles.includes("student");
  const needsStaffRecord = roles.some((r) => STAFF_ROLES_NEEDING_RECORD.includes(r));
  const studentMatches = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    return (q ? students.filter((s) => s.full_name.toLowerCase().includes(q) || s.admission_no.toLowerCase().includes(q)) : students).slice(0, 50);
  }, [students, studentQuery]);

  const reset = () => {
    setName(""); setEmail(""); setPhone(""); setRoles(["teacher"]); setStaffId(""); setStudentId(""); setStudentQuery("");
    setPwMode("generate"); setPassword(""); setErrors({}); setCreated(null);
  };

  // Picking a record fills in its name/email when those are still empty.
  const pickStaff = (id: string) => {
    setStaffId(id);
    const s = staff.find((x) => x.id === id);
    if (s) { if (!name) setName(s.full_name); if (!email && s.email) setEmail(s.email); }
  };
  const pickStudent = (id: string) => {
    setStudentId(id);
    const s = students.find((x) => x.id === id);
    if (s) { setName(s.full_name); if (s.email) setEmail(s.email); }
  };

  const submit = () => {
    setErrors({});
    run(() => createUser({
      full_name: name, email, phone, roles,
      password: pwMode === "set" ? password : "",
      staff_id: isStudent ? "" : staffId,
      student_id: isStudent ? studentId : "",
    }), {
      success: "User created",
      onSuccess: (d) => setCreated(d),
      onError: (r) => setErrors(r.fieldErrors ?? {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild><Button><UserPlus /> Add user</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>Create a login and assign its role. Roles decide what the user can see and do.</DialogDescription>
        </DialogHeader>

        {created ? (
          <Alert variant="success" title="Account created">
            <p>Email: <strong className="text-foreground">{created.email}</strong></p>
            {created.password ? (
              <>
                <p className="mt-1">Temporary password (shown once — share it securely):</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-1 text-foreground">{created.password}</code>
                  <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(created.password ?? "")}><Copy /> Copy</Button>
                </div>
                <p className="mt-1 text-xs">Ask the user to change it after signing in (Account › Password).</p>
              </>
            ) : <p>The password you set is active now.</p>}
          </Alert>
        ) : (
          <div className="space-y-4">
            <RolePicker value={roles} onChange={setRoles} canGrantSuper={canGrantSuper} idPrefix="add" />

            {isStudent ? (
              <Field label="Student record" htmlFor="add-student" required hint="Students sign in to see only their own profile, attendance, results and fees.">
                <Input id="add-student-q" placeholder="Search name or admission no." value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} className="mb-2" />
                <NativeSelect id="add-student" value={studentId} onChange={(e) => pickStudent(e.target.value)} size={Math.min(6, Math.max(2, studentMatches.length + 1))}>
                  <option value="">— Choose a student without a login —</option>
                  {studentMatches.map((s) => <option key={s.id} value={s.id}>{s.admission_no} · {s.full_name}</option>)}
                </NativeSelect>
              </Field>
            ) : (
              <Field label="Staff record" htmlFor="add-staff" hint={needsStaffRecord ? "Teachers must be linked to their staff record to see their classes." : "Optional — links the login to the staff directory."}>
                <NativeSelect id="add-staff" value={staffId} onChange={(e) => pickStaff(e.target.value)}>
                  <option value="">— Not linked —</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.employee_id} · {s.full_name}</option>)}
                </NativeSelect>
              </Field>
            )}
            {needsStaffRecord && !staffId && !isStudent && (
              <Alert variant="warning">Without a staff record, a Teacher can sign in but will not see any assigned classes.</Alert>
            )}

            <Field label="Full name" htmlFor="add-name" required error={errors.full_name?.[0]}>
              <Input id="add-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Email (used to sign in)" htmlFor="add-email" required error={errors.email?.[0]}>
              <Input id="add-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Phone" htmlFor="add-phone" error={errors.phone?.[0]}>
              <Input id="add-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Password</legend>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="pw" checked={pwMode === "generate"} onChange={() => setPwMode("generate")} /> Generate a temporary password</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="pw" checked={pwMode === "set"} onChange={() => setPwMode("set")} /> Set a password now</label>
              {pwMode === "set" && (
                <Field label="Password" htmlFor="add-pw" error={errors.password?.[0]} hint="At least 10 characters with a letter and a number.">
                  <Input id="add-pw" type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                </Field>
              )}
            </fieldset>
          </div>
        )}

        <DialogFooter>
          {created ? (
            <>
              <Button variant="outline" onClick={reset}>Add another</Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button loading={pending} disabled={!roles.length || (isStudent && !studentId)} onClick={submit}>Create user</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
