import "server-only";
import { Document, Page, StyleSheet, Text, View, Image } from "@react-pdf/renderer";
import QRCode from "qrcode";

export type Institution = { name: string; short_name: string; address: string; phone: string | null; email: string | null; marksheet_footer_note: string };

export const s = StyleSheet.create({
  page: { padding: 32, fontSize: 9.5, fontFamily: "Helvetica", color: "#111" },
  header: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1.5, borderBottomColor: "#1e3a8a", paddingBottom: 8, marginBottom: 10 },
  logo: { width: 46, height: 46, borderRadius: 6, backgroundColor: "#1e3a8a", color: "#fde68a", alignItems: "center", justifyContent: "center", marginRight: 10 },
  logoText: { color: "#fde68a", fontSize: 13, fontFamily: "Helvetica-Bold" },
  college: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#1e3a8a" },
  sub: { fontSize: 8.5, color: "#444", marginTop: 2 },
  title: { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "center", marginVertical: 6, letterSpacing: 1 },
  badge: { alignSelf: "center", fontSize: 8, color: "#92400e", borderWidth: 1, borderColor: "#d97706", paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", borderWidth: 0.75, borderColor: "#999", marginBottom: 10 },
  cell: { width: "50%", flexDirection: "row", paddingVertical: 3, paddingHorizontal: 5, borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  label: { width: 95, color: "#555" },
  value: { flex: 1, fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 0.75, borderColor: "#999" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#bbb" },
  th: { padding: 4, fontFamily: "Helvetica-Bold", backgroundColor: "#eef2ff", fontSize: 8.5 },
  td: { padding: 4 },
  right: { textAlign: "right" },
  center: { textAlign: "center" },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 7.5, color: "#555", borderTopWidth: 0.5, borderTopColor: "#bbb", paddingTop: 4 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 34 },
  sig: { width: 140, borderTopWidth: 0.75, borderTopColor: "#333", paddingTop: 3, textAlign: "center", fontSize: 8.5 },
  watermark: { position: "absolute", top: 330, left: 70, fontSize: 70, color: "#dc2626", opacity: 0.12, transform: "rotate(-30deg)", fontFamily: "Helvetica-Bold" },
});

export function Header({ inst }: { inst: Institution }) {
  return (
    <View style={s.header}>
      <View style={s.logo}><Text style={s.logoText}>{inst.short_name.slice(0, 3)}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.college}>{inst.name}</Text>
        <Text style={s.sub}>{inst.address}</Text>
        <Text style={s.sub}>{[inst.phone, inst.email].filter(Boolean).join("  ·  ")}</Text>
      </View>
    </View>
  );
}

export function KV({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View style={s.cell}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value === null || value === undefined || value === "" ? "—" : String(value)}</Text>
    </View>
  );
}

export function Signatures({ labels, compact }: { labels: string[]; compact?: boolean }) {
  return (
    <View style={[s.sigRow, compact ? { marginTop: 22 } : {}]}>
      {labels.map((l) => <Text key={l} style={s.sig}>{l}</Text>)}
    </View>
  );
}

export async function qrDataUrl(text: string) {
  return QRCode.toDataURL(text, { margin: 0, width: 160, errorCorrectionLevel: "M" });
}

export function QR({ src, caption }: { src: string; caption: string }) {
  return (
    <View style={{ alignItems: "center", width: 80 }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
      <Image src={src} style={{ width: 64, height: 64 }} />
      <Text style={{ fontSize: 6.5, color: "#555", marginTop: 2, textAlign: "center" }}>{caption}</Text>
    </View>
  );
}

export function rs(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "—";
  return `Rs. ${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const x = new Date(d.length === 10 ? `${d}T00:00:00` : d);
  return x.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function twoDigits(n: number) { return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`; }
function threeDigits(n: number) { const h = Math.floor(n / 100), r = n % 100; return [h ? `${ONES[h]} Hundred` : "", r ? twoDigits(r) : ""].filter(Boolean).join(" "); }

/** Indian numbering system words, e.g. 125050.5 → "One Lakh Twenty Five Thousand Fifty Rupees and Fifty Paise Only" */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const parts: string[] = [];
  let n = rupees;
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  const words = parts.length ? parts.join(" ") : "Zero";
  return `${words} Rupees${paise ? ` and ${twoDigits(paise)} Paise` : ""} Only`;
}

export { Document, Page, Text, View };
