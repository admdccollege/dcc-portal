import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, ROLE_PERMISSIONS, permissionsForRoles, roleHasPermission } from "@/lib/auth/permissions";
import { visibleNav } from "@/lib/navigation";

describe("role permission matrix", () => {
  it("only references defined permissions", () => {
    for (const perms of Object.values(ROLE_PERMISSIONS)) for (const p of perms) expect(ALL_PERMISSIONS).toContain(p);
  });
  it("teachers cannot manage students, publish results or touch fees", () => {
    for (const p of ["students.manage", "results.publish", "fees.view", "payments.record", "marks.enter_all"] as const) {
      expect(roleHasPermission("teacher", p)).toBe(false);
    }
  });
  it("accountants cannot publish or process results", () => {
    expect(roleHasPermission("accountant", "results.publish")).toBe(false);
    expect(roleHasPermission("accountant", "results.process")).toBe(false);
    expect(roleHasPermission("accountant", "marks.enter_all")).toBe(false);
  });
  it("students have only the self-service permission", () => {
    expect(ROLE_PERMISSIONS.student).toEqual(["portal.student"]);
  });
  it("separates approval from publication of results", () => {
    expect(roleHasPermission("principal", "results.approve")).toBe(true);
    expect(roleHasPermission("principal", "results.publish")).toBe(false);
    expect(roleHasPermission("exam_controller", "results.publish")).toBe(true);
    expect(roleHasPermission("exam_controller", "results.approve")).toBe(false);
  });
  it("only super admins can withdraw published results", () => {
    const holders = Object.entries(ROLE_PERMISSIONS).filter(([, ps]) => ps.includes("results.unpublish")).map(([r]) => r);
    expect(holders).toEqual(["super_admin"]);
  });
  it("navigation follows permissions", () => {
    const teacherNav = visibleNav(permissionsForRoles(["teacher"])).map((i) => i.href);
    expect(teacherNav).toContain("/attendance");
    expect(teacherNav).not.toContain("/fees");
    expect(teacherNav).not.toContain("/users");
    const studentNav = visibleNav(permissionsForRoles(["student"])).map((i) => i.href);
    expect(studentNav).toContain("/my/results");
    expect(studentNav).not.toContain("/dashboard");
  });
});
