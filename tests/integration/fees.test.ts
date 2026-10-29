import { beforeAll, describe, expect, it } from "vitest";
import { admin, as, stackAvailable, today } from "./helpers";
import { computeBalance } from "@/lib/domain/fees";

const up = await stackAvailable();

describe.skipIf(!up)("fees and payments integrity", () => {
  let assignmentId: string;
  let studentId: string;
  let balance: number;

  beforeAll(async () => {
    // An assignment with an outstanding balance and no concession
    const { data } = await admin().from("student_fee_balances").select("assignment_id, student_id, balance").gt("balance", 1000).eq("concessions", 0).eq("is_cancelled", false).limit(1).single();
    assignmentId = data!.assignment_id!;
    studentId = data!.student_id!;
    balance = Number(data!.balance);
  });

  it("the balance view agrees with the TypeScript ledger arithmetic for every assignment", async () => {
    const a = admin();
    const [{ data: bals }, { data: pays }, { data: adjs }, { data: cons }] = await Promise.all([
      a.from("student_fee_balances").select("*"), a.from("payments").select("student_fee_assignment_id, amount, status"),
      a.from("payment_adjustments").select("student_fee_assignment_id, kind, amount"), a.from("fee_concessions").select("student_fee_assignment_id, amount, status"),
    ]);
    for (const b of bals!) {
      const r = computeBalance({
        gross: Number(b.gross_amount),
        charges: adjs!.filter((x) => x.student_fee_assignment_id === b.assignment_id && (x.kind === "charge" || x.kind === "fine")).map((x) => Number(x.amount)),
        concessions: cons!.filter((x) => x.student_fee_assignment_id === b.assignment_id).map((x) => ({ amount: Number(x.amount), status: x.status })),
        payments: pays!.filter((x) => x.student_fee_assignment_id === b.assignment_id).map((x) => ({ amount: Number(x.amount), status: x.status })),
        refunds: adjs!.filter((x) => x.student_fee_assignment_id === b.assignment_id && x.kind === "refund").map((x) => Number(x.amount)),
      });
      expect(r.balance, b.assignment_id!).toBe(Number(b.balance));
    }
  });

  it("rejects overpayment, zero/negative amounts and missing references", async () => {
    const acc = await as("accounts");
    expect((await acc.rpc("record_payment", { p_assignment_id: assignmentId, p_amount: balance + 1, p_method_code: "cash" })).error?.message).toMatch(/exceeds/);
    expect((await acc.rpc("record_payment", { p_assignment_id: assignmentId, p_amount: 0, p_method_code: "cash" })).error).not.toBeNull();
    expect((await acc.rpc("record_payment", { p_assignment_id: assignmentId, p_amount: -5, p_method_code: "cash" })).error).not.toBeNull();
    expect((await acc.rpc("record_payment", { p_assignment_id: assignmentId, p_amount: 10, p_method_code: "upi" })).error?.message).toMatch(/reference/);
  });

  it("records a payment with a sequential receipt, then reverses it with an audit trail", async () => {
    const acc = await as("accounts");
    const { data: all } = await admin().from("payments").select("receipt_no");
    const maxSeq = Math.max(...all!.map((x) => Number(x.receipt_no.split("/").pop())));
    const { data: pid, error } = await acc.rpc("record_payment", { p_assignment_id: assignmentId, p_amount: 500, p_method_code: "cash", p_payment_date: today() });
    expect(error).toBeNull();
    const { data: p } = await admin().from("payments").select("receipt_no, status").eq("id", pid as string).single();
    const seq = (s: string) => Number(s.split("/").pop());
    expect(seq(p!.receipt_no)).toBe(maxSeq + 1);
    const { data: b1 } = await admin().from("student_fee_balances").select("balance").eq("assignment_id", assignmentId).single();
    expect(Number(b1!.balance)).toBe(balance - 500);

    // Completed payments are immutable, even for a privileged client
    const tamper = await admin().from("payments").update({ amount: 1 }).eq("id", pid as string);
    expect(tamper.error?.message).toMatch(/cannot be modified/);
    const del = await admin().from("payments").delete().eq("id", pid as string);
    expect(del.error?.message).toMatch(/cannot be deleted/);

    expect((await acc.rpc("reverse_payment", { p_payment_id: pid as string, p_reason: "x" })).error?.message).toMatch(/reason/);
    expect((await acc.rpc("reverse_payment", { p_payment_id: pid as string, p_reason: "Entered against the wrong student" })).error).toBeNull();
    expect((await acc.rpc("reverse_payment", { p_payment_id: pid as string, p_reason: "Entered against the wrong student" })).error?.message).toMatch(/already reversed/);
    const { data: b2 } = await admin().from("student_fee_balances").select("balance").eq("assignment_id", assignmentId).single();
    expect(Number(b2!.balance)).toBe(balance);
    const { data: adj } = await admin().from("payment_adjustments").select("kind, amount").eq("payment_id", pid as string).single();
    expect(adj).toEqual({ kind: "reversal", amount: 500 });
    const { data: audit } = await admin().from("audit_logs").select("action").eq("entity_type", "payments").eq("entity_id", pid as string);
    expect(audit!.map((x) => x.action).sort()).toEqual(["insert", "update"]);
  });

  it("concurrent payments cannot together exceed the balance (row lock)", async () => {
    const acc = await as("accounts");
    const { data: b } = await admin().from("student_fee_balances").select("balance").eq("assignment_id", assignmentId).single();
    const half = Math.floor(Number(b!.balance) / 2) + 1; // two of these exceed the balance
    const results = await Promise.all([1, 2].map(() => acc.rpc("record_payment", { p_assignment_id: assignmentId, p_amount: half, p_method_code: "cash" })));
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    const ok = results.find((r) => !r.error)!;
    await acc.rpc("reverse_payment", { p_payment_id: ok.data as string, p_reason: "Concurrency test cleanup" });
  });

  it("students and teachers cannot record payments or alter fee records", async () => {
    for (const who of ["student", "physics"] as const) {
      const c = await as(who);
      expect((await c.rpc("record_payment", { p_assignment_id: assignmentId, p_amount: 1, p_method_code: "cash" })).error?.code, who).toBe("42501");
      const upd = await c.from("student_fee_assignments").update({ is_cancelled: true }).eq("id", assignmentId).select("id");
      expect(upd.data ?? []).toHaveLength(0);
    }
  });

  it("a concession requires a different approver and cannot exceed the balance", async () => {
    const acc = await as("accounts");
    const principal = await as("principal");
    const { data: cid } = await acc.rpc("request_concession", { p_assignment_id: assignmentId, p_kind: "concession", p_amount: 100, p_reason: "Test concession" });
    expect((await acc.rpc("decide_concession", { p_concession_id: cid as string, p_approve: true })).error?.code).toBe("42501"); // accountant lacks approval permission
    const { data: big } = await acc.rpc("request_concession", { p_assignment_id: assignmentId, p_kind: "waiver", p_amount: 10_000_000, p_reason: "Too large" });
    expect((await principal.rpc("decide_concession", { p_concession_id: big as string, p_approve: true })).error?.message).toMatch(/exceeds/);
    expect((await principal.rpc("decide_concession", { p_concession_id: cid as string, p_approve: true })).error).toBeNull();
    const { data: b } = await admin().from("student_fee_balances").select("balance, concessions").eq("assignment_id", assignmentId).single();
    expect(Number(b!.concessions)).toBe(100);
    void studentId;
  });
});
