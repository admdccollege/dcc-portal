import { describe, expect, it } from "vitest";
import { isBelowThreshold, sessionsNeededToReach, summarise, withinEditWindow, type AttendanceStatusConfig } from "@/lib/domain/attendance";

const config: AttendanceStatusConfig[] = [
  { code: "P", counts_as_present: true, counts_in_total: true },
  { code: "A", counts_as_present: false, counts_in_total: true },
  { code: "L", counts_as_present: true, counts_in_total: true },
  { code: "AL", counts_as_present: false, counts_in_total: false },
];

describe("attendance summary", () => {
  it("computes attended / eligible × 100", () => {
    expect(summarise(["P", "P", "A", "P"], config)).toEqual({ attended: 3, eligible: 4, excluded: 0, total: 4, percentage: 75 });
  });
  it("excludes approved leave from the total when configured", () => {
    const s = summarise(["P", "AL", "AL", "A"], config);
    expect(s).toMatchObject({ attended: 1, eligible: 2, excluded: 2, percentage: 50 });
  });
  it("counts late as present when configured", () => {
    expect(summarise(["L", "P"], config).percentage).toBe(100);
  });
  it("returns null (not 0%) when there are no eligible sessions", () => {
    expect(summarise([], config).percentage).toBeNull();
    expect(summarise(["AL"], config).percentage).toBeNull();
  });
  it("rounds to two decimals", () => {
    expect(summarise(["P", "P", "A"], config).percentage).toBe(66.67);
  });
  it("rejects unknown status codes instead of silently ignoring them", () => {
    expect(() => summarise(["X"], config)).toThrow();
  });
});

describe("thresholds", () => {
  it("flags below-threshold only when a percentage exists", () => {
    expect(isBelowThreshold(74.99, 75)).toBe(true);
    expect(isBelowThreshold(75, 75)).toBe(false);
    expect(isBelowThreshold(null, 75)).toBe(false);
  });
  it("calculates sessions needed to recover", () => {
    expect(sessionsNeededToReach(6, 10, 75)).toBe(6); // (6+6)/(10+6)=75%
    expect(sessionsNeededToReach(8, 10, 75)).toBe(0);
  });
});

describe("edit window", () => {
  it("allows today and up to N days back, never future", () => {
    expect(withinEditWindow("2026-10-29", "2026-10-29", 3)).toBe(true);
    expect(withinEditWindow("2026-10-26", "2026-10-29", 3)).toBe(true);
    expect(withinEditWindow("2026-10-25", "2026-10-29", 3)).toBe(false);
    expect(withinEditWindow("2026-10-30", "2026-10-29", 3)).toBe(false);
  });
});
