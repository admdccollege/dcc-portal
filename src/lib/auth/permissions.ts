/**
 * Role & permission matrix — single source of truth.
 *
 * The SQL migration `supabase/migrations/*_roles_permissions.sql` is generated
 * from this file by `pnpm db:gen-permissions`. An integration test verifies the
 * database matches this matrix.
 *
 * Permissions gate features in the UI and server actions; the database enforces
 * the same keys in RLS policies and SECURITY DEFINER functions. Ownership rules
 * (a teacher's assigned classes, a student's own records) are enforced in RLS
 * and do not need a permission.
 */

export const PERMISSIONS = {
  // Dashboard
  "dashboard.view": { module: "Dashboard", description: "View the staff dashboard" },
  // Students
  "students.view": { module: "Students", description: "View all student records" },
  "students.manage": { module: "Students", description: "Create, edit, archive student records" },
  "students.import": { module: "Students", description: "Bulk import students from CSV/Excel" },
  "students.export": { module: "Students", description: "Export student lists" },
  "students.promote": { module: "Students", description: "Promote, repeat or graduate students" },
  // Admissions
  "admissions.view": { module: "Admissions", description: "View applications" },
  "admissions.manage": { module: "Admissions", description: "Create/edit applications and admission periods" },
  "admissions.review": { module: "Admissions", description: "Verify documents and approve/reject applications" },
  "admissions.convert": { module: "Admissions", description: "Convert approved applicants into students" },
  // Academics
  "academics.view": { module: "Academics", description: "View programmes, subjects and offerings" },
  "academics.manage": { module: "Academics", description: "Manage sessions, programmes, subjects and offerings" },
  // Attendance
  "attendance.take": { module: "Attendance", description: "Record attendance for assigned classes" },
  "attendance.view_all": { module: "Attendance", description: "View attendance for all classes" },
  "attendance.manage": { module: "Attendance", description: "Edit any attendance, past cutoff, lock registers" },
  "attendance.configure": { module: "Attendance", description: "Configure attendance statuses" },
  // Examinations
  "exams.view": { module: "Examinations", description: "View all examinations and marks" },
  "exams.manage": { module: "Examinations", description: "Create examinations, subjects, schedules, examiners" },
  "marks.enter": { module: "Examinations", description: "Enter marks for assigned subjects" },
  "marks.enter_all": { module: "Examinations", description: "Enter marks for any subject" },
  "marks.correct": { module: "Examinations", description: "Correct marks after the entry deadline (with reason)" },
  "marks.lock": { module: "Examinations", description: "Lock and reopen marks entry" },
  "grading.manage": { module: "Examinations", description: "Configure grading schemes and rules" },
  // Results
  "results.view": { module: "Results", description: "View all results" },
  "results.process": { module: "Results", description: "Compute results from locked marks" },
  "results.approve": { module: "Results", description: "Approve processed results" },
  "results.publish": { module: "Results", description: "Publish approved results" },
  "results.unpublish": { module: "Results", description: "Withdraw published results (exceptional)" },
  // Fees
  "fees.view": { module: "Fees", description: "View fee structures, dues and payments" },
  "fees.manage": { module: "Fees", description: "Manage fee structures, assignments and charges" },
  "fees.export": { module: "Fees", description: "Export financial records" },
  "payments.record": { module: "Fees", description: "Record fee payments and issue receipts" },
  "payments.reverse": { module: "Fees", description: "Reverse payments and record refunds" },
  "concessions.approve": { module: "Fees", description: "Approve or reject concessions and waivers" },
  // Staff
  "staff.view": { module: "Staff", description: "View staff records" },
  "staff.view_confidential": { module: "Staff", description: "View confidential staff information" },
  "staff.manage": { module: "Staff", description: "Manage staff records and allocations" },
  // Timetable
  "timetable.view": { module: "Timetable", description: "View all timetables" },
  "timetable.manage": { module: "Timetable", description: "Create and edit timetables" },
  // Notices
  "notices.manage": { module: "Notices", description: "Create and edit notices (incl. drafts)" },
  "notices.publish": { module: "Notices", description: "Publish and archive notices" },
  // Reports
  "reports.view": { module: "Reports", description: "View academic reports and analytics" },
  "reports.export": { module: "Reports", description: "Export reports" },
  // Administration
  "users.view": { module: "Administration", description: "View user accounts" },
  "users.manage": { module: "Administration", description: "Create accounts, assign roles, activate/deactivate" },
  "roles.manage": { module: "Administration", description: "Edit role permissions" },
  "settings.manage": { module: "Administration", description: "Manage institution settings" },
  "audit.view": { module: "Administration", description: "View audit logs" },
  // Student self-service
  "portal.student": { module: "Student Portal", description: "Use the student self-service portal" },
} as const satisfies Record<string, { module: string; description: string }>;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const ROLES = {
  super_admin: { name: "Super Administrator", description: "Full control of settings, roles and all records" },
  principal: { name: "Principal", description: "Institution oversight, approvals and reports" },
  office_admin: { name: "Office Administrator", description: "Admissions, student records, sessions and notices" },
  exam_controller: { name: "Examination Controller", description: "Examinations, marks, results and publication" },
  accountant: { name: "Accountant", description: "Fee structures, payments, receipts and dues" },
  teacher: { name: "Teacher", description: "Assigned classes: attendance and marks entry" },
  student: { name: "Student", description: "Own profile, attendance, results, fees and notices" },
} as const;

export type RoleKey = keyof typeof ROLES;
export const ROLE_KEYS = Object.keys(ROLES) as RoleKey[];

export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  super_admin: ALL_PERMISSIONS.filter((p) => p !== "portal.student"),
  principal: [
    "dashboard.view",
    "students.view",
    "students.export",
    "admissions.view",
    "admissions.review",
    "academics.view",
    "attendance.view_all",
    "exams.view",
    "results.view",
    "results.approve",
    "fees.view",
    "fees.export",
    "concessions.approve",
    "payments.reverse",
    "staff.view",
    "staff.view_confidential",
    "timetable.view",
    "notices.manage",
    "notices.publish",
    "reports.view",
    "reports.export",
    "users.view",
    "audit.view",
  ],
  office_admin: [
    "dashboard.view",
    "students.view",
    "students.manage",
    "students.import",
    "students.export",
    "students.promote",
    "admissions.view",
    "admissions.manage",
    "admissions.review",
    "admissions.convert",
    "academics.view",
    "academics.manage",
    "attendance.view_all",
    "attendance.manage",
    "staff.view",
    "staff.manage",
    "timetable.view",
    "timetable.manage",
    "notices.manage",
    "notices.publish",
    "reports.view",
  ],
  exam_controller: [
    "dashboard.view",
    "students.view",
    "academics.view",
    "attendance.view_all",
    "exams.view",
    "exams.manage",
    "marks.enter_all",
    "marks.correct",
    "marks.lock",
    "grading.manage",
    "results.view",
    "results.process",
    "results.publish",
    "timetable.view",
    "notices.manage",
    "reports.view",
    "reports.export",
  ],
  accountant: [
    "dashboard.view",
    "students.view",
    "academics.view",
    "fees.view",
    "fees.manage",
    "fees.export",
    "payments.record",
    "payments.reverse",
    "timetable.view",
  ],
  teacher: ["dashboard.view", "academics.view", "attendance.take", "marks.enter", "timetable.view"],
  student: ["portal.student"],
};

/** Pure helper used by both server code and tests. */
export function roleHasPermission(role: RoleKey, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsForRoles(roles: readonly string[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const r of roles) {
    if (r in ROLE_PERMISSIONS) for (const p of ROLE_PERMISSIONS[r as RoleKey]) set.add(p);
  }
  return set;
}
