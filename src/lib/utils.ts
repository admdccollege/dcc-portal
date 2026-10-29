import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
export function formatINR(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return inr.format(Number(value));
}

export function formatDate(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00` : value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Kolkata",
  });
}

export function formatNumber(value: number | string | null | undefined, digits = 2): string {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString("en-IN", { maximumFractionDigits: digits });
}

/** Today's date (YYYY-MM-DD) in India Standard Time. */
export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Builds a PostgREST `or` filter for a free-text search across columns.
 * The term is reduced to a safe character set (letters, digits, space and
 * / @ . -) so it cannot inject filter syntax or LIKE wildcards.
 */
export function searchFilter(columns: string[], term: string | null | undefined): string | null {
  const clean = (term ?? "").replace(/[^\p{L}\p{N}\s/@.\-]/gu, "").trim().slice(0, 60);
  if (!clean) return null;
  return columns.map((c) => `${c}.ilike.*${clean}*`).join(",");
}

/** ISO timestamp → value for <input type="datetime-local"> in IST. */
export function toISTInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

/** Date N days before today (IST), as YYYY-MM-DD. */
export function daysAgoIST(n: number): string {
  const t = Date.parse(`${todayIST()}T00:00:00Z`) - n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
