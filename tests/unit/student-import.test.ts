import { describe, expect, it } from "vitest";
import { normaliseHeader, parseDate, validateImport, type ExistingKeys } from "@/lib/domain/student-import";

const empty: ExistingKeys = { admissionNos: new Set(), universityRollNos: new Set(), registrationNos: new Set(), rollNos: new Set(), nameDob: new Set() };
const today = "2026-10-29";

describe("parseDate", () => {
  it("parses common Indian and ISO formats", () => {
    expect(parseDate("2008-03-14")).toBe("2008-03-14");
    expect(parseDate("14/03/2008")).toBe("2008-03-14");
    expect(parseDate("4-3-2008")).toBe("2008-03-04");
  });
  it("rejects impossible dates", () => {
    expect(parseDate("31/02/2008")).toBeNull();
    expect(parseDate("2008-13-01")).toBeNull();
    expect(parseDate("yesterday")).toBeNull();
  });
});

describe("validateImport", () => {
  it("accepts valid rows and normalises values", () => {
    const r = validateImport([{ full_name: "  Grace   Haokip ", date_of_birth: "14/03/2008", gender: "F", email: "GRACE@EXAMPLE.COM" }], empty, today);
    expect(r.ok).toBe(true);
    expect(r.valid[0]).toMatchObject({ full_name: "Grace Haokip", date_of_birth: "2008-03-14", gender: "female", email: "grace@example.com" });
  });

  it("reports missing required fields with row numbers", () => {
    const r = validateImport([{ full_name: "", date_of_birth: "" }], empty, today);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.field).sort()).toEqual(["date_of_birth", "full_name"]);
    expect(r.issues[0].row).toBe(2);
  });

  it("detects duplicates within the file", () => {
    const r = validateImport(
      [
        { full_name: "A One", date_of_birth: "2008-01-01", roll_no: "001" },
        { full_name: "B Two", date_of_birth: "2008-01-02", roll_no: "001" },
        { full_name: "A One", date_of_birth: "2008-01-01" },
      ],
      empty, today,
    );
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.row === 3 && i.field === "roll_no")).toBe(true);
    expect(r.issues.some((i) => i.row === 4 && i.field === "full_name")).toBe(true);
    expect(r.valid).toHaveLength(1);
  });

  it("detects duplicates against existing records", () => {
    const existing = { ...empty, admissionNos: new Set(["dcc/2026/0001"]), nameDob: new Set(["grace haokip|2008-03-14"]) };
    const r = validateImport([{ full_name: "Grace Haokip", date_of_birth: "2008-03-14", admission_no: "DCC/2026/0001" }], existing, today);
    expect(r.issues.map((i) => i.field).sort()).toEqual(["admission_no", "full_name"]);
  });

  it("validates phone, email, gender and dates", () => {
    const r = validateImport([{ full_name: "X Y", date_of_birth: "2030-01-01", phone: "abc", email: "nope", gender: "unknown" }], empty, today);
    expect(r.issues.map((i) => i.field).sort()).toEqual(["date_of_birth", "email", "gender", "phone"]);
  });

  it("rejects empty files", () => {
    expect(validateImport([], empty, today).ok).toBe(false);
  });

  it("normalises header names", () => {
    expect(normaliseHeader(" Full Name ")).toBe("full_name");
    expect(normaliseHeader("Date-of-Birth")).toBe("date_of_birth");
  });
});
