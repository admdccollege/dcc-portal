import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { requirePermission, can } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, programmeCode, termName, UUID_RE } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConvertDialog, DocumentRow, ReviewDialog } from "@/components/admissions/admission-actions-ui";
import { formatDate, formatINR, titleCase } from "@/lib/utils";

export const metadata = { title: "Application" };

function D({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{value || "—"}</dd></div>;
}

export default async function ApplicationPage({ params }: PageProps<"/admissions/[id]">) {
  const session = await requirePermission("admissions.view");
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createClient();
  const ref = await getReferenceData();
  const { data: a } = await supabase.from("admissions").select("*, admission_periods(*), admission_documents(*)").eq("id", id).maybeSingle();
  if (!a || !a.admission_periods) notFound();
  const p = a.admission_periods;
  const [{ data: offerings }, { data: methods }] = await Promise.all([
    a.preferred_offering_ids.length ? supabase.from("course_offerings").select("id, subjects(code, name)").in("id", a.preferred_offering_ids) : { data: [] },
    supabase.from("payment_methods").select("code, name, requires_reference").eq("is_active", true),
  ]);
  const docs = [...a.admission_documents].sort((x, y) => x.document_name.localeCompare(y.document_name));
  const unverified = docs.filter((d) => d.is_required && !d.verified).length;
  const final = ["admitted", "rejected", "withdrawn"].includes(a.status);
  const meetsMin = p.min_qualifying_percent === null || (a.previous_percentage !== null && Number(a.previous_percentage) >= Number(p.min_qualifying_percent));

  return (
    <div className="space-y-5">
      <PageHeader
        title={a.applicant_name}
        description={<span className="flex flex-wrap items-center gap-2"><span className="font-mono">{a.application_no}</span><StatusBadge status={a.status} /> {p.title}</span>}
        breadcrumbs={[{ label: "Admissions", href: "/admissions" }, { label: a.application_no }]}
        actions={
          <>
            <Button size="sm" variant="outline" asChild><a href={`/api/pdf/admission-slip/${id}`} target="_blank" rel="noopener"><Printer /> {a.status === "admitted" ? "Confirmation slip" : "Acknowledgement"}</a></Button>
            {!final && can(session, "admissions.review") && <ReviewDialog id={id} current={a.status} />}
            {a.status === "approved" && can(session, "admissions.convert") && <ConvertDialog id={id} fee={Number(p.admission_fee)} canRecordPayment={can(session, "payments.record")} methods={methods ?? []} />}
            {a.student_id && <Button size="sm" variant="outline" asChild><Link href={`/students/${a.student_id}`}>Open student record</Link></Button>}
          </>
        }
      />
      {!final && unverified > 0 && <Alert variant="warning" title={`${unverified} required document(s) not yet verified`}>The application cannot be approved until every required document is verified by an authorised reviewer.</Alert>}
      {!final && !meetsMin && <Alert variant="error" title="Eligibility">Previous percentage {a.previous_percentage ?? "—"} is below the minimum of {p.min_qualifying_percent}% for this admission period.</Alert>}
      {a.review_remarks && <Alert variant="info" title={`Review remarks (${formatDate(a.reviewed_at, true)})`}>{a.review_remarks}</Alert>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Applicant details</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <D label="Programme" value={`${programmeCode(ref, p.programme_id)} · ${termName(ref, p.term_id)}`} />
              <D label="Date of birth" value={formatDate(a.date_of_birth)} />
              <D label="Gender" value={titleCase(a.gender)} />
              <D label="Phone" value={a.phone} />
              <D label="Email" value={a.email} />
              <D label="Guardian" value={a.guardian_name ? `${a.guardian_name}${a.guardian_relationship ? ` (${a.guardian_relationship})` : ""}` : null} />
              <D label="Guardian phone" value={a.guardian_phone} />
              <D label="Previous institution" value={a.previous_institution} />
              <D label="Board / exam / year" value={[a.previous_board, a.previous_exam, a.previous_year].filter(Boolean).join(" · ")} />
              <D label="Previous %" value={a.previous_percentage} />
              <D label="Admission fee" value={`${formatINR(p.admission_fee)}${a.admission_fee_paid ? " · paid" : ""}`} />
              <D label="Received" value={formatDate(a.created_at, true)} />
              <div className="sm:col-span-3"><D label="Address" value={a.address} /></div>
              <div className="sm:col-span-3"><D label="Subject preferences" value={(offerings ?? []).map((o) => `${o.subjects?.code} ${o.subjects?.name}`).join(", ")} /></div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Document checklist</CardTitle><CardDescription>Mark documents as submitted; reviewers verify them.</CardDescription></CardHeader>
          <CardContent>
            {docs.length === 0 ? <p className="text-sm text-muted-foreground">No documents required.</p> : (
              <ul className="divide-y">{docs.map((d) => <DocumentRow key={d.id} doc={d} admissionId={id} canManage={can(session, "admissions.manage")} canReview={can(session, "admissions.review")} locked={final} />)}</ul>
            )}
            {p.eligibility_rules && <p className="mt-3 text-xs text-muted-foreground">Eligibility: {p.eligibility_rules}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
