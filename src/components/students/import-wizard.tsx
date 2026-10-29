"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { Alert } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importStudents, type ImportPreview } from "@/server/student-actions";
import { IMPORT_COLUMNS } from "@/lib/domain/student-import";

const TEMPLATE = `${IMPORT_COLUMNS.join(",")}\nGrace Example,14/03/2010,Female,+91 90000 00001,grace@example.com,Demo Village,John Example,Father,+91 90000 00002,,,,001,2026-07-15\n`;

export function ImportWizard({ sessions, programmes, terms, defaultSession }: {
  sessions: { id: string; name: string }[];
  programmes: { id: string; name: string }[];
  terms: { id: string; programme_id: string; name: string }[];
  defaultSession?: string;
}) {
  const [sessionId, setSessionId] = useState(defaultSession ?? "");
  const [programmeId, setProgrammeId] = useState("");
  const [termId, setTermId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (commit: boolean) => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("academic_session_id", sessionId);
    fd.set("programme_id", programmeId);
    fd.set("term_id", termId);
    fd.set("commit", String(commit));
    setError(null);
    startTransition(async () => {
      const res = await importStudents(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPreview(res.data);
      if (commit && res.data.imported) toast.success(`${res.data.imported} students imported`);
    });
  };

  const ready = sessionId && programmeId && termId && file;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>1. Target class and file</CardTitle>
          <CardDescription>
            Required columns: <code>full_name</code>, <code>date_of_birth</code>. Optional: {IMPORT_COLUMNS.slice(2).join(", ")}.{" "}
            <a className="text-primary hover:underline" href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="student_import_template.csv">Download template</a>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Academic session" htmlFor="imp-session" required>
            <NativeSelect id="imp-session" value={sessionId} onChange={(e) => { setSessionId(e.target.value); setPreview(null); }}>
              <option value="">Select</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Programme" htmlFor="imp-prog" required>
            <NativeSelect id="imp-prog" value={programmeId} onChange={(e) => { setProgrammeId(e.target.value); setTermId(""); setPreview(null); }}>
              <option value="">Select</option>
              {programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Class / semester" htmlFor="imp-term" required>
            <NativeSelect id="imp-term" value={termId} onChange={(e) => { setTermId(e.target.value); setPreview(null); }}>
              <option value="">Select</option>
              {terms.filter((t) => t.programme_id === programmeId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="File (.csv or .xlsx, max 2 MB)" htmlFor="imp-file" required>
            <Input id="imp-file" type="file" accept=".csv,.xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} />
          </Field>
        </CardContent>
        <CardContent>
          <Button onClick={() => submit(false)} disabled={!ready} loading={pending && !preview}><FileSpreadsheet /> Validate file</Button>
        </CardContent>
      </Card>

      {error && <Alert variant="error" title="Import failed">{error}</Alert>}

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>2. Review</CardTitle>
            <CardDescription>{preview.total} row(s) read · {preview.validCount} valid · {preview.issues.length} problem(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.imported ? (
              <Alert variant="success" title={`${preview.imported} students imported`}>
                Admission numbers were generated where blank. <Link href="/students" className="text-primary underline">View students</Link>
              </Alert>
            ) : preview.issues.length > 0 ? (
              <>
                <Alert variant="error" title="Fix these problems and upload again. Nothing has been saved." />
                <div className="max-h-96 overflow-auto rounded border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Field</TableHead><TableHead>Problem</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {preview.issues.map((i, k) => (
                        <TableRow key={k}><TableCell>{i.row || "—"}</TableCell><TableCell className="font-mono text-xs">{i.field}</TableCell><TableCell>{i.message}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <>
                <Alert variant="success" title="All rows are valid">Preview of the first rows:</Alert>
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Date of birth</TableHead><TableHead>Gender</TableHead><TableHead>Roll</TableHead><TableHead>Admission no.</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {preview.sample.map((r, k) => (
                      <TableRow key={k}><TableCell>{r.full_name}</TableCell><TableCell>{r.date_of_birth}</TableCell><TableCell>{r.gender}</TableCell><TableCell>{r.roll_no ?? "—"}</TableCell><TableCell>{r.admission_no ?? "(auto)"}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button onClick={() => submit(true)} loading={pending}><Upload /> Import {preview.validCount} students</Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
