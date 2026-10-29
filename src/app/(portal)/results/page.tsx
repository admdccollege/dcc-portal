import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getReferenceData, programmeCode, termName, uuidParam } from "@/lib/queries/reference";
import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Results" };

export default async function ResultsPage({ searchParams }: PageProps<"/results">) {
  await requirePermission("results.view");
  const sp = await searchParams;
  const ref = await getReferenceData();
  const supabase = await createClient();
  const sessionId = uuidParam(sp.session) ?? ref.currentSession?.id;
  let q = supabase.from("examinations").select("id, name, status, programme_id, term_id, processed_at, approved_at, published_at, is_provisional, results(count)")
    .in("status", ["marks_locked", "results_processed", "results_approved", "published"]).order("processed_at", { ascending: false, nullsFirst: true });
  if (sessionId) q = q.eq("academic_session_id", sessionId);
  const programme = uuidParam(sp.programme);
  if (programme) q = q.eq("programme_id", programme);
  const { data: exams } = await q;

  return (
    <div className="space-y-5">
      <PageHeader title="Results & Mark Sheets" description="Process results from locked marks, approve, publish and generate mark statements." />
      <FilterBar showSearch={false} filters={[
        { name: "session", label: "Session", options: ref.sessions.map((s) => ({ value: s.id, label: s.name })), allLabel: "Current session" },
        { name: "programme", label: "Programmes", options: ref.programmes.map((p) => ({ value: p.id, label: p.code })) },
      ]} />
      <Card>
        {!exams?.length ? <div className="p-6"><EmptyState title="No results yet" description="Results appear here once marks for an examination are locked." /></div> : (
          <Table>
            <TableHeader><TableRow><TableHead>Examination</TableHead><TableHead>Class</TableHead><TableHead>Results</TableHead><TableHead>Processed</TableHead><TableHead>Approved</TableHead><TableHead>Published</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {exams.map((e) => (
                <TableRow key={e.id}>
                  <TableCell><Link className="font-medium text-primary hover:underline" href={`/results/${e.id}`}>{e.name}</Link>{e.is_provisional && <span className="ml-1 text-xs text-muted-foreground">(provisional)</span>}</TableCell>
                  <TableCell>{programmeCode(ref, e.programme_id)} · {termName(ref, e.term_id)}</TableCell>
                  <TableCell className="tabular-nums">{(e.results as unknown as { count: number }[])[0]?.count ?? 0}</TableCell>
                  <TableCell>{formatDate(e.processed_at)}</TableCell>
                  <TableCell>{formatDate(e.approved_at)}</TableCell>
                  <TableCell>{formatDate(e.published_at)}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
