import { z } from "zod";
import { email, isoDate, optionalDate, optionalText, phone, requiredText, uuid } from "./common";

export const GENDERS = ["female", "male", "other", "undisclosed"] as const;

export const studentDetailsSchema = z.object({
  full_name: requiredText("Name", 120).refine((v) => v.length > 1, "Name is too short"),
  date_of_birth: isoDate.refine((v) => v > "1950-01-01" && v < new Date().toISOString().slice(0, 10), "Date of birth is out of range"),
  gender: z.enum(GENDERS),
  phone,
  email,
  address: optionalText(400),
  admission_no: optionalText(40),
  university_roll_no: optionalText(40),
  registration_no: optionalText(40),
  admission_date: optionalDate,
  scholarship_note: optionalText(300),
});

export const guardianSchema = z.object({
  guardian_name: optionalText(120),
  guardian_relationship: optionalText(40),
  guardian_phone: phone,
  guardian_email: email,
});

export const createStudentSchema = studentDetailsSchema.extend(guardianSchema.shape).extend({
  academic_session_id: uuid,
  programme_id: uuid,
  term_id: uuid,
  roll_no: optionalText(20),
  section: optionalText(10),
  offering_ids: z.array(z.guid()).max(30).default([]),
});
export type CreateStudentInput = z.input<typeof createStudentSchema>;

export const updateStudentSchema = studentDetailsSchema.extend(guardianSchema.shape).extend({ id: uuid });
export type UpdateStudentInput = z.input<typeof updateStudentSchema>;
