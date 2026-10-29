import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";

const MAP: Record<string, BadgeVariant> = {
  active: "success", pass: "success", published: "success", approved: "success", completed: "success", admitted: "success", present: "success",
  graduated: "default", promoted: "default", results_approved: "default", results_processed: "secondary", marks_locked: "secondary",
  marks_entry: "warning", scheduled: "secondary", draft: "muted", submitted: "secondary", under_review: "warning", waitlisted: "warning",
  pending: "warning", compartment: "warning", incomplete: "warning", overdue: "destructive",
  fail: "destructive", rejected: "destructive", reversed: "destructive", withdrawn: "muted", transferred: "muted",
  archived: "muted", suspended: "destructive", absent: "destructive", withheld: "destructive", inactive: "muted", cancelled: "muted",
  on_leave: "warning", resigned: "muted", retired: "muted", exempted: "secondary", paid: "success", partial: "warning", unpaid: "destructive",
};

const LABELS: Record<string, string> = {
  marks_entry: "Marks entry open", marks_locked: "Marks locked", results_processed: "Results processed",
  results_approved: "Results approved",
};

export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  if (!status) return <Badge variant="muted">—</Badge>;
  return <Badge variant={MAP[status] ?? "secondary"}>{label ?? LABELS[status] ?? titleCase(status)}</Badge>;
}
