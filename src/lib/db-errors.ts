/**
 * Maps PostgreSQL / PostgREST errors to safe, user-facing messages.
 * Business-rule errors raised by our SQL functions (P0001, 22023, 23514 with
 * custom text, 42501) carry intentional messages and are shown as-is.
 * Everything else is generalised so internals are not leaked.
 */
type PgLike = { code?: string; message?: string; details?: string | null };

const UNIQUE_HINTS: Record<string, string> = {
  students_admission_no_key: "This admission number is already in use.",
  students_university_roll_key: "This university roll number is already in use.",
  students_registration_key: "This registration number is already in use.",
  student_enrolments_roll_key: "This roll number is already used in the class.",
  student_enrolments_one_active: "The student already has an active enrolment.",
  attendance_sessions_unique: "Attendance for this class, subject and period already exists.",
  timetable_class_slot: "The class already has a subject in this slot.",
  timetable_teacher_slot: "The teacher is already assigned in this slot.",
  timetable_room_slot: "The room is already in use in this slot.",
  staff_employee_id_key: "This employee ID is already in use.",
  staff_email_key: "A staff member with this email already exists.",
  subjects_code_key: "A subject with this code already exists.",
  programmes_code_key: "A programme with this code already exists.",
  academic_sessions_name_key: "An academic session with this name already exists.",
  academic_sessions_one_current: "Only one academic session can be current.",
};

export function friendlyDbError(err: unknown): string {
  const e = (err ?? {}) as PgLike;
  const msg = e.message ?? "";
  switch (e.code) {
    case "42501":
      return msg && !msg.includes("row-level security") && !msg.startsWith("permission denied")
        ? msg
        : "You are not authorised to perform this action.";
    case "P0001":
    case "P0002":
    case "22023":
      return msg || "The operation could not be completed.";
    case "23514":
      return msg.startsWith("new row") || msg.includes("violates check constraint")
        ? "Some values are outside the allowed range."
        : msg;
    case "23505": {
      const hit = Object.entries(UNIQUE_HINTS).find(([k]) => msg.includes(k));
      return hit ? hit[1] : "A record with these details already exists.";
    }
    case "23503":
      return "This record is linked to other records and cannot be changed or removed.";
    case "22P02":
    case "22007":
    case "22008":
      return "One of the values has an invalid format.";
    case "PGRST116":
      return "Record not found.";
    default:
      return "Something went wrong. Please try again or contact the administrator.";
  }
}
