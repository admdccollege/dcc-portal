import { z } from "zod";
import { email, isoDate, optionalText, phone, requiredText } from "./common";

export const applicationSchema = z.object({
  admission_period_id: z.guid("Select an admission period"),
  applicant_name: requiredText("Applicant name", 120),
  date_of_birth: isoDate,
  gender: z.enum(["female", "male", "other", "undisclosed"]),
  phone: phone.refine((v) => !!v, "Phone is required"),
  email,
  address: optionalText(400),
  guardian_name: optionalText(120),
  guardian_relationship: optionalText(40),
  guardian_phone: phone,
  previous_institution: optionalText(160),
  previous_board: optionalText(80),
  previous_exam: optionalText(80),
  previous_year: z.union([z.coerce.number().int().min(1980).max(2100), z.literal("")]).optional().transform((v) => (v === "" ? undefined : v)),
  previous_percentage: z.union([z.coerce.number().min(0).max(100), z.literal("")]).optional().transform((v) => (v === "" ? undefined : v)),
  preferred_offering_ids: z.array(z.guid()).max(20).default([]),
});
export type ApplicationInput = z.input<typeof applicationSchema>;
