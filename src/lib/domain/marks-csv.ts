import Papa from "papaparse";

const STATUSES = ["present", "absent", "exempted", "malpractice", "withheld"] as const;

/** Parses a marks CSV (columns: roll_no or admission_no, marks, optional status) into entries for review. */
export function parseMarksCsv(text: string, roster: { student_id: string; roll_no: string | null; admission_no: string }[], maxMarks: number) {
  if (text.length > 500_000) return { ok: false as const, error: "File too large" };
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_") });
  const byRoll = new Map(roster.filter((r) => r.roll_no).map((r) => [r.roll_no!.toLowerCase(), r.student_id]));
  const byAdm = new Map(roster.map((r) => [r.admission_no.toLowerCase(), r.student_id]));
  const entries: Record<string, { marks: string; status: string }> = {};
  const issues: string[] = [];
  parsed.data.forEach((row, i) => {
    const line = i + 2;
    const id = (row.admission_no && byAdm.get(row.admission_no.trim().toLowerCase())) || (row.roll_no && byRoll.get(row.roll_no.trim().toLowerCase()));
    if (!id) return issues.push(`Row ${line}: student not found in this subject`);
    if (entries[id]) return issues.push(`Row ${line}: duplicate entry for the same student`);
    const status = (row.status ?? "").trim().toLowerCase() || "present";
    if (!(STATUSES as readonly string[]).includes(status)) return issues.push(`Row ${line}: unknown status "${row.status}"`);
    const marks = (row.marks ?? "").trim();
    if (status === "present" && marks !== "") {
      if (!/^\d+(\.\d{1,2})?$/.test(marks) || Number(marks) > maxMarks) return issues.push(`Row ${line}: invalid marks "${marks}" (0–${maxMarks})`);
    }
    entries[id] = { marks: status === "present" ? marks : "", status };
  });
  return { ok: true as const, entries, issues };
}
