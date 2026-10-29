import "server-only";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { Header, KV, Signatures, amountInWords, fmtDate, rs, s, type Institution } from "./common";

export type ReceiptData = {
  payment: { receipt_no: string; amount: number; payment_date: string; method: string; reference_no: string | null; remarks: string | null; status: string; created_at: string };
  student: { full_name: string; admission_no: string };
  className: string;
  feeName: string;
  items: { name: string; amount: number }[];
  balanceAfter: number | null;
  receivedBy: string | null;
  copy: number;
};

export function ReceiptDocument({ d, inst }: { d: ReceiptData; inst: Institution }) {
  return (
    <Document title={`Receipt ${d.payment.receipt_no}`} author={inst.name}>
      <Page size="A5" orientation="landscape" style={[s.page, { padding: 20, paddingBottom: 30, fontSize: 9 }]}>
        {d.payment.status === "reversed" && <Text style={[s.watermark, { top: 140, left: 120, fontSize: 60 }]}>REVERSED</Text>}
        <Header inst={inst} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[s.title, { textAlign: "left" }]}>FEE RECEIPT</Text>
          <Text style={{ fontSize: 8, color: "#555" }}>{d.copy > 1 ? `Duplicate copy (${d.copy})` : "Original"}</Text>
        </View>
        <View style={s.grid}>
          <KV label="Receipt no." value={d.payment.receipt_no} />
          <KV label="Date" value={fmtDate(d.payment.payment_date)} />
          <KV label="Student" value={d.student.full_name} />
          <KV label="Admission no." value={d.student.admission_no} />
          <KV label="Class" value={d.className} />
          <KV label="Fee" value={d.feeName} />
          <KV label="Payment mode" value={d.payment.method} />
          <KV label="Reference no." value={d.payment.reference_no} />
        </View>
        <View style={s.table}>
          <View style={s.tr}><Text style={[s.th, { flex: 1 }]}>Fee head (assessed)</Text><Text style={[s.th, { width: 110 }, s.right]}>Amount</Text></View>
          {d.items.map((i) => (
            <View key={i.name} style={s.tr}><Text style={[s.td, { flex: 1 }]}>{i.name}</Text><Text style={[s.td, { width: 110 }, s.right]}>{rs(i.amount)}</Text></View>
          ))}
          <View style={[s.tr, { backgroundColor: "#f0fdf4" }]}><Text style={[s.td, { flex: 1, fontFamily: "Helvetica-Bold" }]}>Amount received</Text><Text style={[s.td, { width: 110, fontFamily: "Helvetica-Bold" }, s.right]}>{rs(d.payment.amount)}</Text></View>
        </View>
        <Text style={{ marginTop: 6 }}>In words: <Text style={{ fontFamily: "Helvetica-Bold" }}>{amountInWords(Number(d.payment.amount))}</Text></Text>
        {d.balanceAfter !== null && <Text style={{ marginTop: 3 }}>Outstanding balance on this fee (as of printing): {rs(d.balanceAfter)}</Text>}
        {d.payment.remarks && <Text style={{ marginTop: 3, color: "#555" }}>Remarks: {d.payment.remarks}</Text>}
        {d.payment.status === "reversed" && <Text style={{ marginTop: 3, color: "#b91c1c", fontFamily: "Helvetica-Bold" }}>This payment has been reversed and is not valid.</Text>}
        <Signatures compact labels={[`Received by${d.receivedBy ? `: ${d.receivedBy}` : ""}`, "Accountant"]} />
        <Text fixed style={[s.footer, { bottom: 10, left: 20, right: 20 }]}>Computer-generated receipt from the {inst.short_name} portal. Recorded {fmtDate(d.payment.created_at)}.</Text>
      </Page>
    </Document>
  );
}
