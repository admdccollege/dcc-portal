import { beforeAll, describe, expect, it } from "vitest";
import { admin, anon, as, id, stackAvailable } from "./helpers";
import { ROLE_PERMISSIONS } from "@/lib/auth/permissions";

const up = await stackAvailable();

describe.skipIf(!up)("authentication & role permissions (RLS)", () => {
  let studentId: string;
  let otherStudentId: string;
  let artsStudentId: string;

  beforeAll(async () => {
    studentId = await id("students", { email: "student.science@dcc.example" });
    artsStudentId = await id("students", { email: "student.arts@dcc.example" });
    const { data } = await admin().from("students").select("id").neq("id", studentId).neq("id", artsStudentId).limit(1).single();
    otherStudentId = data!.id;
  });

  it("database role-permission grants match the source-of-truth matrix", async () => {
    const { data } = await admin().from("role_permissions").select("permission_key, roles(key)");
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      const db = (data ?? []).filter((r) => r.roles?.key === role).map((r) => r.permission_key).sort();
      expect(db, role).toEqual([...perms].sort());
    }
  });

  it("anonymous users can read nothing but the public verification function", async () => {
    const a = anon();
    for (const t of ["students", "results", "payments", "marks", "staff", "admissions", "audit_logs"] as const) {
      const { data } = await a.from(t).select("id").limit(1);
      expect(data ?? [], t).toHaveLength(0);
    }
    const { error } = await a.rpc("save_marks", { p_exam_subject_id: "00000000-0000-0000-0000-000000000000", p_entries: [] });
    expect(error).not.toBeNull();
  });

  it("a student can read only their own student record", async () => {
    const s = await as("student");
    const { data } = await s.from("students").select("id");
    expect(data?.map((r) => r.id)).toEqual([studentId]);
    const { data: other } = await s.from("students").select("id").eq("id", otherStudentId);
    expect(other).toHaveLength(0);
  });

  it("a student cannot see another student's fees, payments or attendance", async () => {
    const s = await as("student");
    const [{ data: pays }, { data: bals }, { data: att }] = await Promise.all([
      s.from("payments").select("student_id"),
      s.from("student_fee_balances").select("student_id"),
      s.from("attendance_records").select("student_id"),
    ]);
    for (const rows of [pays, bals, att]) expect(new Set((rows ?? []).map((r) => r.student_id))).toEqual(new Set(rows?.length ? [studentId] : []));
  });

  it("a teacher sees only students in their assigned classes", async () => {
    const t = await as("physics");
    const { data: visible } = await t.from("students").select("id");
    const ids = new Set((visible ?? []).map((r) => r.id));
    expect(ids.has(studentId)).toBe(true);          // HS-SCI Class XI (taught)
    expect(ids.has(artsStudentId)).toBe(false);     // FYUP-BA (not taught)
    const { count } = await admin().from("students").select("id", { count: "exact", head: true });
    expect(ids.size).toBeLessThan(count!);
  });

  it("a teacher cannot see fee or payment records", async () => {
    const t = await as("physics");
    const { data } = await t.from("payments").select("id").limit(1);
    expect(data).toHaveLength(0);
  });

  it("users cannot change their own role or activation status", async () => {
    const t = await as("physics");
    const me = (await t.auth.getUser()).data.user!.id;
    const { error } = await t.rpc("set_user_roles", { p_user_id: me, p_role_keys: ["super_admin"] });
    expect(error?.code).toBe("42501");
    await t.from("profiles").update({ is_active: false } as never).eq("id", me);
    const { data: p } = await admin().from("profiles").select("is_active").eq("id", me).single();
    expect(p?.is_active).toBe(true);
    const { data: roles } = await admin().from("user_roles").select("roles(key)").eq("user_id", me);
    expect(roles?.map((r) => r.roles?.key)).toEqual(["teacher"]);
  });

  it("only a super admin can grant the super admin role", async () => {
    const office = await as("office"); // has no users.manage
    const target = (await (await as("history")).auth.getUser()).data.user!.id;
    const { error } = await office.rpc("set_user_roles", { p_user_id: target, p_role_keys: ["super_admin"] });
    expect(error?.code).toBe("42501");
  });

  it("deactivated accounts lose all permissions immediately", async () => {
    const sup = await as("super");
    const t = await as("history");
    const target = (await t.auth.getUser()).data.user!.id;
    expect((await t.rpc("has_permission", { p_key: "attendance.take" })).data).toBe(true);
    await sup.rpc("set_profile_active", { p_user_id: target, p_active: false });
    expect((await t.rpc("has_permission", { p_key: "attendance.take" })).data).toBe(false);
    const { data } = await t.from("students").select("id").limit(1);
    expect(data).toHaveLength(0);
    await sup.rpc("set_profile_active", { p_user_id: target, p_active: true });
  });

  it("staff without staff.view_confidential see only the directory, not confidential fields", async () => {
    const t = await as("physics");
    const { data: rows } = await t.from("staff").select("id, date_of_birth, address");
    expect(rows?.length).toBe(1); // only their own row
    const { data: dir } = await t.rpc("staff_directory");
    expect((dir ?? []).length).toBeGreaterThan(5);
    expect(Object.keys(dir![0])).not.toContain("date_of_birth");
  });

  it("audit logs are readable only with audit.view and cannot be modified", async () => {
    const t = await as("physics");
    const { data } = await t.from("audit_logs").select("id").limit(1);
    expect(data).toHaveLength(0);
    const p = await as("principal");
    const { data: rows } = await p.from("audit_logs").select("id").limit(1);
    expect(rows).toHaveLength(1);
    const del = await admin().from("audit_logs").delete().eq("id", rows![0].id);
    expect(del.error?.message).toMatch(/append-only/);
  });

  it("draft notices are hidden from students; targeted notices reach only their audience", async () => {
    const s = await as("student");
    const { data } = await s.from("notices").select("title, status");
    expect(data?.every((n) => n.status === "published")).toBe(true);
    expect(data?.some((n) => n.title.startsWith("DRAFT"))).toBe(false);
    expect(data?.some((n) => n.title.includes("Staff meeting"))).toBe(false);
    expect(data?.some((n) => n.title.includes("Class XI Science"))).toBe(true);
    const arts = await as("studentArts");
    const { data: artsNotices } = await arts.from("notices").select("title");
    expect(artsNotices?.some((n) => n.title.includes("Class XI Science"))).toBe(false);
  });
});
