import "server-only";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { Header, KV, Signatures, fmtDate, rs, s, type Institution } from "./common";

export function AdmissionSlipDocument({ inst, a }: {
  inst: Institution;
  a: { application_no: string; applicant_name: string; date_of_birth: string; phone: string; email: string | null; guardian_name: string | null; period: string; programme: string; term: string; session: string; status: string; reviewed_at: string | null; admission_no: string | null; fee: number; fee_paid: boolean; documents: { document_name: string; verified: boolean; submitted: boolean }[] };
}) {
  const confirmed = a.status === "admitted";
  return (
    <Document title={`Admission ${a.application_no}`} author={inst.name}>
      <Page size="A4" style={s.page}>
        <Header inst={inst} />
        <Text style={s.title}>{confirmed ? "ADMISSION CONFIRMATION SLIP" : "APPLICATION ACKNOWLEDGEMENT"}</Text>
        <View style={s.grid}>
          <KV label="Application no." value={a.application_no} />
          <KV label="Status" value={a.status.replace(/_/g, " ").toUpperCase()} />
          <KV label="Applicant" value={a.applicant_name} />
          <KV label="Date of birth" value={fmtDate(a.date_of_birth)} />
          <KV label="Programme" value={a.programme} />
          <KV label="Class / semester" value={a.term} />
          <KV label="Academic session" value={a.session} />
          <KV label="Admission period" value={a.period} />
          <KV label="Phone" value={a.phone} />
          <KV label="Guardian" value={a.guardian_name} />
          {confirmed && <KV label="Admission no." value={a.admission_no} />}
          <KV label="Admission fee" value={`${rs(a.fee)} ${a.fee_paid ? "(paid)" : a.fee > 0 ? "(due)" : ""}`} />
        </View>
        <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Document checklist</Text>
        <View style={s.table}>
          {a.documents.map((d) => (
            <View key={d.document_name} style={s.tr}>
              <Text style={[s.td, { flex: 1 }]}>{d.document_name}</Text>
              <Text style={[s.td, { width: 120 }]}>{d.verified ? "Verified" : d.submitted ? "Submitted (pending verification)" : "Not submitted"}</Text>
            </View>
          ))}
        </View>
        {!confirmed && <Text style={{ marginTop: 8, color: "#555" }}>This acknowledgement does not confirm admission. Admission is confirmed only after document verification and approval by the college.</Text>}
        <Signatures labels={["Applicant", "Office", "Principal"]} />
        <Text style={s.footer}>Generated {fmtDate(new Date().toISOString())} from the {inst.short_name} Education Portal.</Text>
      </Page>
    </Document>
  );
}

export function StudentProfileDocument({ inst, st }: {
  inst: Institution;
  st: { full_name: string; admission_no: string; date_of_birth: string; gender: string; phone: string | null; email: string | null; address: string | null; admission_date: string; status: string; university_roll_no: string | null; registration_no: string | null; className: string; roll_no: string | null; guardian: string | null; guardianPhone: string | null; subjects: string[] };
}) {
  return (
    <Document title={`Student ${st.admission_no}`} author={inst.name}>
      <Page size="A4" style={s.page}>
        <Header inst={inst} />
        <Text style={s.title}>STUDENT PROFILE</Text>
        <View style={s.grid}>
          <KV label="Name" value={st.full_name} />
          <KV label="Admission no." value={st.admission_no} />
          <KV label="Class" value={st.className} />
          <KV label="Roll no." value={st.roll_no} />
          <KV label="Date of birth" value={fmtDate(st.date_of_birth)} />
          <KV label="Gender" value={st.gender} />
          <KV label="Phone" value={st.phone} />
          <KV label="Email" value={st.email} />
          <KV label="Admission date" value={fmtDate(st.admission_date)} />
          <KV label="Status" value={st.status} />
          <KV label="Univ./Council roll no." value={st.university_roll_no} />
          <KV label="Registration no." value={st.registration_no} />
          <KV label="Guardian" value={st.guardian} />
          <KV label="Guardian phone" value={st.guardianPhone} />
        </View>
        <Text>Address: {st.address ?? "—"}</Text>
        <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 4 }}>Subjects</Text>
        {st.subjects.map((x) => <Text key={x}>• {x}</Text>)}
        <Signatures labels={["Office", "Principal"]} />
        <Text style={s.footer}>Confidential — contains personal information. Generated {fmtDate(new Date().toISOString())}.</Text>
      </Page>
    </Document>
  );
}

export function TabularReportDocument({ inst, title, subtitle, columns, rows }: { inst: Institution; title: string; subtitle?: string; columns: { header: string; width?: number; align?: "right" }[]; rows: (string | number | null)[][] }) {
  return (
    <Document title={title} author={inst.name}>
      <Page size="A4" orientation={columns.length > 6 ? "landscape" : "portrait"} style={s.page}>
        <Header inst={inst} />
        <Text style={s.title}>{title.toUpperCase()}</Text>
        {subtitle && <Text style={[s.sub, { textAlign: "center", marginBottom: 6 }]}>{subtitle}</Text>}
        <View style={s.table}>
          <View style={s.tr} fixed>
            {columns.map((c) => <Text key={c.header} style={[s.th, c.width ? { width: c.width } : { flex: 1 }, c.align === "right" ? s.right : {}]}>{c.header}</Text>)}
          </View>
          {rows.map((r, i) => (
            <View key={i} style={s.tr} wrap={false}>
              {r.map((v, j) => <Text key={j} style={[s.td, columns[j].width ? { width: columns[j].width } : { flex: 1 }, columns[j].align === "right" ? s.right : {}]}>{v === null || v === undefined ? "—" : String(v)}</Text>)}
            </View>
          ))}
        </View>
        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `Generated ${fmtDate(new Date().toISOString())} · ${inst.short_name} Education Portal · Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
}
