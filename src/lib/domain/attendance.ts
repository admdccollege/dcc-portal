/**
 * Attendance percentage = attended sessions / eligible sessions × 100.
 * Mirrors public.attendance_summary(). Statuses are configurable:
 *   counts_as_present → contributes to "attended"
 *   counts_in_total   → contributes to "eligible" (e.g. approved leave can be excluded)
 */
export type AttendanceStatusConfig = { code: string; counts_as_present: boolean; counts_in_total: boolean };

export type AttendanceSummary = {
  attended: number;
  eligible: number;
  excluded: number;
  total: number;
  /** null when there are no eligible sessions (never reported as 0% or 100%) */
  percentage: number | null;
};

export function summarise(statusCodes: string[], config: AttendanceStatusConfig[]): AttendanceSummary {
  const byCode = new Map(config.map((c) => [c.code, c]));
  let attended = 0, eligible = 0, excluded = 0;
  for (const code of statusCodes) {
    const c = byCode.get(code);
    if (!c) throw new Error(`Unknown attendance status "${code}"`);
    if (c.counts_as_present) attended += 1;
    if (c.counts_in_total) eligible += 1;
    else excluded += 1;
  }
  const percentage = eligible === 0 ? null : Math.round((10000 * attended) / eligible) / 100;
  return { attended, eligible, excluded, total: statusCodes.length, percentage };
}

export function isBelowThreshold(percentage: number | null, threshold: number): boolean {
  return percentage !== null && percentage < threshold;
}

/** Sessions a student must attend consecutively to reach the threshold (null if unreachable / not needed). */
export function sessionsNeededToReach(attended: number, eligible: number, threshold: number): number | null {
  if (threshold >= 100) return attended === eligible ? 0 : null;
  if (eligible > 0 && (100 * attended) / eligible >= threshold) return 0;
  // (attended + x) / (eligible + x) >= t/100  →  x >= (t*eligible - 100*attended) / (100 - t)
  return Math.ceil((threshold * eligible - 100 * attended) / (100 - threshold));
}

/** Whether a teacher may still edit attendance for `date` given an edit window (days). */
export function withinEditWindow(date: string, today: string, windowDays: number): boolean {
  const d = Date.parse(`${date}T00:00:00Z`);
  const t = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(d) || Number.isNaN(t)) return false;
  const diff = (t - d) / 86_400_000;
  return diff >= 0 && diff <= windowDays;
}
