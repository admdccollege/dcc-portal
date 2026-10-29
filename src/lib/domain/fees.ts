/**
 * Fee balance arithmetic — mirrors the public.student_fee_balances view:
 *   balance = gross + charges − approved concessions − completed payments + refunds
 * Amounts are handled in paise (integers) to avoid floating-point drift.
 */
export type FeeLedgerInput = {
  gross: number;
  charges: number[];          // charges & fines
  concessions: { amount: number; status: "pending" | "approved" | "rejected" | "revoked" }[];
  payments: { amount: number; status: "completed" | "reversed" }[];
  refunds: number[];
};

export const toPaise = (rupees: number) => Math.round(rupees * 100);
export const fromPaise = (paise: number) => paise / 100;

export function computeBalance(input: FeeLedgerInput) {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + toPaise(b), 0);
  const charges = sum(input.charges);
  const concessions = sum(input.concessions.filter((c) => c.status === "approved").map((c) => c.amount));
  const paid = sum(input.payments.filter((p) => p.status === "completed").map((p) => p.amount));
  const refunded = sum(input.refunds);
  const balance = toPaise(input.gross) + charges - concessions - paid + refunded;
  return {
    charges: fromPaise(charges),
    concessions: fromPaise(concessions),
    paid: fromPaise(paid),
    refunded: fromPaise(refunded),
    balance: fromPaise(balance),
  };
}

/** Client/server pre-check for a payment (the database re-validates under a row lock). */
export function validatePaymentAmount(amount: number, balance: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Amount must be greater than zero";
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
    return "Amount can have at most two decimal places";
  }
  if (toPaise(amount) > toPaise(balance)) return `Amount exceeds the outstanding balance (${balance.toFixed(2)})`;
  return null;
}

/** Late fine (whole days after due date × per-day fine), capped optionally. */
export function lateFine(dueDate: string | null, onDate: string, perDay: number, cap?: number): number {
  if (!dueDate || perDay <= 0) return 0;
  const days = Math.floor((Date.parse(`${onDate}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86_400_000);
  if (days <= 0) return 0;
  const fine = fromPaise(toPaise(perDay) * days);
  return cap !== undefined ? Math.min(fine, cap) : fine;
}
