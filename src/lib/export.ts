import "server-only";
import ExcelJS from "exceljs";

export type ExportColumn<T> = { header: string; value: (row: T) => string | number | null | undefined; width?: number };

/** Neutralise spreadsheet formula injection (=, +, -, @, tab, CR at cell start). */
export function safeCell(v: string | number | null | undefined): string | number {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return v;
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

export function toCSV<T>(rows: T[], columns: ExportColumn<T>[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.header)).join(",")];
  for (const r of rows) lines.push(columns.map((c) => esc(safeCell(c.value(r)))).join(","));
  return "﻿" + lines.join("\r\n"); // BOM so Excel opens UTF-8 correctly
}

export async function toXLSX<T>(rows: T[], columns: ExportColumn<T>[], sheetName: string, title?: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DCC Portal";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  let start = 1;
  if (title) {
    ws.addRow([title]).font = { bold: true, size: 13 };
    ws.addRow([`Generated ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`]).font = { italic: true, size: 9 };
    ws.addRow([]);
    start = 4;
  }
  const header = ws.addRow(columns.map((c) => c.header));
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8ECF5" } };
  for (const r of rows) ws.addRow(columns.map((c) => safeCell(c.value(r))));
  columns.forEach((c, i) => (ws.getColumn(i + 1).width = c.width ?? Math.min(40, Math.max(10, c.header.length + 4))));
  ws.views = [{ state: "frozen", ySplit: start }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function exportResponse<T>(format: string | null, rows: T[], columns: ExportColumn<T>[], baseName: string, title?: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = baseName.replace(/[^a-z0-9_-]+/gi, "_");
  if (format === "xlsx") {
    const buf = await toXLSX(rows, columns, safeName, title);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeName}_${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(toCSV(rows, columns), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}_${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
