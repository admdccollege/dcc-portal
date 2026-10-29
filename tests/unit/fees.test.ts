import { describe, expect, it } from "vitest";
import { computeBalance, lateFine, validatePaymentAmount } from "@/lib/domain/fees";

describe("fee balance", () => {
  it("subtracts completed payments and approved concessions only", () => {
    const r = computeBalance({
      gross: 10500,
      charges: [200],
      concessions: [{ amount: 2000, status: "approved" }, { amount: 999, status: "pending" }, { amount: 50, status: "rejected" }],
      payments: [{ amount: 3000, status: "completed" }, { amount: 3000, status: "reversed" }],
      refunds: [],
    });
    expect(r).toEqual({ charges: 200, concessions: 2000, paid: 3000, refunded: 0, balance: 5700 });
  });

  it("adds refunds back to the balance", () => {
    const r = computeBalance({ gross: 1000, charges: [], concessions: [], payments: [{ amount: 1000, status: "completed" }], refunds: [250] });
    expect(r.balance).toBe(250);
  });

  it("avoids floating point drift", () => {
    const r = computeBalance({ gross: 0.3, charges: [], concessions: [], payments: [{ amount: 0.1, status: "completed" }, { amount: 0.2, status: "completed" }], refunds: [] });
    expect(r.balance).toBe(0);
  });
});

describe("payment validation", () => {
  it("rejects zero, negative and overpayment", () => {
    expect(validatePaymentAmount(0, 100)).not.toBeNull();
    expect(validatePaymentAmount(-5, 100)).not.toBeNull();
    expect(validatePaymentAmount(100.01, 100)).toMatch(/exceeds/);
  });
  it("rejects more than two decimals", () => {
    expect(validatePaymentAmount(10.005, 100)).toMatch(/two decimal/);
  });
  it("accepts a valid part or full payment", () => {
    expect(validatePaymentAmount(50.5, 100)).toBeNull();
    expect(validatePaymentAmount(100, 100)).toBeNull();
  });
});

describe("late fine", () => {
  it("charges per whole day after the due date", () => {
    expect(lateFine("2026-10-01", "2026-10-11", 10)).toBe(100);
    expect(lateFine("2026-10-01", "2026-10-01", 10)).toBe(0);
    expect(lateFine("2026-10-01", "2026-10-31", 10, 200)).toBe(200);
    expect(lateFine(null, "2026-10-31", 10)).toBe(0);
  });
});
