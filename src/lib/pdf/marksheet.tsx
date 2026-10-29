import "server-only";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { Header, KV, QR, Signatures, fmtDate, s, type Institution } from "./common";

export type MarksheetData = {
  result: { id: string; status: string; total_max: number | null; total_obtained: number | null; percentage: number | null; grade: string | null; grade_point: number | null; credits_earned: number | null; verification_code: string; computed_at: string };
  student: { full_name: string; admission_no: string; university_roll_no: string | null; registration_no: string | null; date_of_birth: string };
  rollNo: string | null;
  exam: { name: string; status: string; is_provisional: boolean; published_at: string | null };
  programme: string;
  term: string;
  session: string;
  subjects: { subject_code: string; subject_name: string; category: string | null; credits: number | null; max_marks: number | null; marks_obtained: number | null; grade: string | null; grade_point: number | null; status: string; components: { component: string; max: number; obtained: number | null; status: string }[] }[];
  qr: string;
};

const RESULT_LABEL: Record<string, string> = { pass: "PASS", fail: "FAIL", compartment: "COMPARTMENTAL", absent: "ABSENT", withheld: "WITHHELD", incomplete: "INCOMPLETE" };

function MarksheetPage({ d, inst, issuedOn }: { d: MarksheetData; inst: Institution; issuedOn: string }) {
  const draft = d.exam.status !== "published";
  const useGp = d.subjects.some((x) => x.grade_point !== null);
  const showCredits = d.subjects.some((x) => x.credits !== null);
  return (
    <Page size="A4" style={s.page}>
      {draft && <Text style={s.watermark}>DRAFT</Text>}
      <Header inst={inst} />
      <Text style={s.title}>STATEMENT OF MARKS</Text>
      {(d.exam.is_provisional || draft) && <Text style={s.badge}>{draft ? "DRAFT — NOT PUBLISHED" : "PROVISIONAL — SUBJECT TO VERIFICATION"}</Text>}
      <View style={s.grid}>
        <KV label="Student name" value={d.student.full_name} />
        <KV label="Admission no." value={d.student.admission_no} />
        <KV label="Programme" value={d.programme} />
        <KV label="Class / semester" value={d.term} />
        <KV label="Examination" value={d.exam.name} />
        <KV label="Academic session" value={d.session} />
        <KV label="Roll no." value={d.rollNo} />
        <KV label="Univ./Council roll no." value={d.student.university_roll_no} />
        <KV label="Registration no." value={d.student.registration_no} />
        <KV label="Date of birth" value={fmtDate(d.student.date_of_birth)} />
      </View>

      <View style={s.table}>
        <View style={[s.tr, { backgroundColor: "#eef2ff" }]}>
          <Text style={[s.th, { width: 62 }]}>Code</Text>
          <Text style={[s.th, { flex: 1 }]}>Subject</Text>
          {showCredits && <Text style={[s.th, { width: 36 }, s.center]}>Credits</Text>}
          <Text style={[s.th, { width: 44 }, s.right]}>Max</Text>
          <Text style={[s.th, { width: 52 }, s.right]}>Obtained</Text>
          <Text style={[s.th, { width: 38 }, s.center]}>Grade</Text>
          {useGp && <Text style={[s.th, { width: 30 }, s.center]}>GP</Text>}
          <Text style={[s.th, { width: 52 }, s.center]}>Result</Text>
        </View>
        {d.subjects.map((x) => (
          <View key={x.subject_code} style={s.tr} wrap={false}>
            <Text style={[s.td, { width: 62, fontSize: 8 }]}>{x.subject_code}</Text>
            <View style={[s.td, { flex: 1 }]}>
              <Text>{x.subject_name}</Text>
              {x.components.length > 1 && (
                <Text style={{ fontSize: 7, color: "#555", marginTop: 1 }}>
                  {x.components.map((c) => `${c.component[0].toUpperCase()}${c.component.slice(1)}: ${c.status === "present" ? c.obtained : c.status}/${c.max}`).join("  ·  ")}
                </Text>
              )}
            </View>
            {showCredits && <Text style={[s.td, { width: 36 }, s.center]}>{x.credits ?? "—"}</Text>}
            <Text style={[s.td, { width: 44 }, s.right]}>{x.max_marks ?? "—"}</Text>
            <Text style={[s.td, { width: 52 }, s.right]}>{x.status === "absent" ? "AB" : x.marks_obtained ?? "—"}</Text>
            <Text style={[s.td, { width: 38 }, s.center]}>{x.grade ?? "—"}</Text>
            {useGp && <Text style={[s.td, { width: 30 }, s.center]}>{x.grade_point ?? "—"}</Text>}
            <Text style={[s.td, { width: 52 }, s.center, { fontFamily: "Helvetica-Bold", color: x.status === "pass" ? "#166534" : x.status === "exempted" ? "#555" : "#b91c1c" }]}>{x.status.toUpperCase()}</Text>
          </View>
        ))}
        <View style={[s.tr, { backgroundColor: "#f8fafc" }]}>
          <Text style={[s.td, { flex: 1, fontFamily: "Helvetica-Bold" }]}>Grand total</Text>
          <Text style={[s.td, { width: 96, fontFamily: "Helvetica-Bold" }, s.right]}>{d.result.total_obtained ?? "—"} / {d.result.total_max ?? "—"}</Text>
          <Text style={[s.td, { width: useGp ? 120 : 90 }]} />
        </View>
      </View>

      <View style={{ flexDirection: "row", marginTop: 10, alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={[s.grid, { width: 330, marginBottom: 0 }]}>
          <KV label="Percentage" value={d.result.percentage !== null ? `${d.result.percentage}%` : "—"} />
          <KV label="Overall grade" value={d.result.grade} />
          {d.result.grade_point !== null && <KV label="Grade point (SGPA)" value={d.result.grade_point} />}
          {d.result.credits_earned !== null && <KV label="Credits earned" value={d.result.credits_earned} />}
          <KV label="Result" value={RESULT_LABEL[d.result.status] ?? d.result.status} />
          <KV label="Date of issue" value={issuedOn} />
        </View>
        <QR src={d.qr} caption={`Verify: ${d.result.verification_code}`} />
      </View>

      <Signatures labels={["Prepared by", "Controller of Examinations", "Principal"]} />

      <View style={s.footer} fixed>
        <Text>{inst.marksheet_footer_note}</Text>
        <Text>Document reference: {d.result.verification_code} · Verify at the college portal /verify · Results published {fmtDate(d.exam.published_at)}</Text>
      </View>
    </Page>
  );
}

export function MarksheetDocument({ items, inst }: { items: MarksheetData[]; inst: Institution }) {
  const issuedOn = fmtDate(new Date().toISOString());
  return (
    <Document title={items.length === 1 ? `Marksheet ${items[0].student.admission_no}` : "Marksheets"} author={inst.name}>
      {items.map((d) => <MarksheetPage key={d.result.id} d={d} inst={inst} issuedOn={issuedOn} />)}
    </Document>
  );
}
