import { FileText } from "lucide-react";
import { requireStudent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "My results" };

export default async function MyResults() {
  const session = await requireStudent();
  const supabase = await createClient();
  // RLS returns only this student's results, and only for published examinations.
  const { data: results } = await supabase.from("results")
    .select("id, status, percentage, grade, grade_point, total_obtained, total_max, examinations(name, is_provisional, published_at), result_subjects(subject_code, subject_name, max_marks, marks_obtained, grade, status)")
    .eq("student_id", session.studentId).order("computed_at", { ascending: false });
  return (
    <div className="space-y-5">
      <PageHeader title="My results" description="Only published results are shown. Provisional results are subject to verification." />
      {!results?.length ? <EmptyState title="No published results" description="Your results will appear here once the college publishes them." /> : results.map((r) => (
        <Card key={r.id}>
          <CardHeader className="flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">{r.examinations?.name} <StatusBadge status={r.status} /></CardTitle>
              <CardDescription>Published {formatDate(r.examinations?.published_at)}{r.examinations?.is_provisional ? " · Provisional" : ""} · Total {r.total_obtained ?? "—"}/{r.total_max ?? "—"} · {r.percentage ?? "—"}% · Grade {r.grade ?? "—"}{r.grade_point !== null ? ` · SGPA ${r.grade_point}` : ""}</CardDescription>
            </div>
            <Button size="sm" variant="outline" asChild><a href={`/api/pdf/marksheet/${r.id}`} target="_blank" rel="noopener"><FileText /> Mark statement</a></Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Subject</TableHead><TableHead className="text-right">Marks</TableHead><TableHead>Grade</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
              <TableBody>
                {r.result_subjects.map((s) => (
                  <TableRow key={s.subject_code}>
                    <TableCell className="font-mono text-xs">{s.subject_code}</TableCell><TableCell>{s.subject_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.status === "absent" ? "AB" : s.marks_obtained ?? "—"}/{s.max_marks ?? "—"}</TableCell>
                    <TableCell>{s.grade ?? "—"}</TableCell><TableCell><StatusBadge status={s.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
