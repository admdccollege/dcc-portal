import type { Permission } from "@/lib/auth/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: string; // lucide icon name, resolved in the client sidebar
  anyOf: Permission[];
};

/** Staff navigation. Each entry is shown only to holders of ANY listed permission. */
export const STAFF_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", anyOf: ["dashboard.view"] },
  { href: "/students", label: "Student Management", icon: "Users", anyOf: ["students.view", "attendance.take"] },
  { href: "/admissions", label: "Admissions", icon: "ClipboardList", anyOf: ["admissions.view"] },
  { href: "/academics", label: "Academic Programmes", icon: "GraduationCap", anyOf: ["academics.view"] },
  { href: "/subjects", label: "Subjects & Courses", icon: "BookOpen", anyOf: ["academics.view"] },
  { href: "/attendance", label: "Attendance", icon: "CalendarCheck", anyOf: ["attendance.take", "attendance.view_all"] },
  { href: "/examinations", label: "Examinations & Marks", icon: "FilePen", anyOf: ["exams.view", "marks.enter", "marks.enter_all"] },
  { href: "/results", label: "Results & Mark Sheets", icon: "Award", anyOf: ["results.view"] },
  { href: "/fees", label: "Fees & Payments", icon: "IndianRupee", anyOf: ["fees.view"] },
  { href: "/staff", label: "Staff Management", icon: "UserCog", anyOf: ["staff.view"] },
  { href: "/timetable", label: "Timetable", icon: "CalendarClock", anyOf: ["timetable.view"] },
  { href: "/notices", label: "Notices", icon: "Megaphone", anyOf: ["dashboard.view"] },
  { href: "/reports", label: "Reports & Analytics", icon: "BarChart3", anyOf: ["reports.view", "fees.view"] },
  { href: "/users", label: "Users & Permissions", icon: "ShieldCheck", anyOf: ["users.view"] },
  { href: "/settings", label: "Settings & Audit Logs", icon: "Settings", anyOf: ["settings.manage", "audit.view", "academics.manage", "grading.manage"] },
];

export const STUDENT_NAV: NavItem[] = [
  { href: "/my", label: "My Dashboard", icon: "LayoutDashboard", anyOf: ["portal.student"] },
  { href: "/my/profile", label: "My Profile", icon: "User", anyOf: ["portal.student"] },
  { href: "/my/attendance", label: "My Attendance", icon: "CalendarCheck", anyOf: ["portal.student"] },
  { href: "/my/results", label: "My Results", icon: "Award", anyOf: ["portal.student"] },
  { href: "/my/fees", label: "My Fees", icon: "IndianRupee", anyOf: ["portal.student"] },
  { href: "/my/timetable", label: "My Timetable", icon: "CalendarClock", anyOf: ["portal.student"] },
  { href: "/notices", label: "Notices", icon: "Megaphone", anyOf: ["portal.student"] },
];

export function visibleNav(permissions: Set<Permission>): NavItem[] {
  const items = permissions.has("dashboard.view") ? STAFF_NAV : STUDENT_NAV;
  return items.filter((i) => i.anyOf.some((p) => permissions.has(p)));
}
