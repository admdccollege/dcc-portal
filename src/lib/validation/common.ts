import { z } from "zod";

export const uuid = z.guid("Select a value");
export const optionalText = (max = 200) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));
export const requiredText = (label: string, max = 200) => z.string().trim().min(1, `${label} is required`).max(max);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");
export const optionalDate = z.union([isoDate, z.literal("")]).optional().transform((v) => (v ? v : undefined));
export const phone = z
  .string()
  .trim()
  .regex(/^(\+?[0-9][0-9\s-]{6,18})?$/, "Enter a valid phone number")
  .optional()
  .transform((v) => (v ? v : undefined));
export const email = z
  .union([z.email("Enter a valid email address"), z.literal("")])
  .optional()
  .transform((v) => (v ? v.toLowerCase() : undefined));
export const money = z.coerce
  .number({ message: "Enter an amount" })
  .positive("Amount must be greater than zero")
  .max(10_000_000, "Amount is too large")
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "At most two decimal places");
export const reason = z.string().trim().min(5, "Please give a reason (at least 5 characters)").max(500);
