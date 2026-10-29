"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, LockOpen, Send, Undo2, CalendarCheck, PenLine, Calculator } from "lucide-react";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { transitionExam, processResults } from "@/server/exam-actions";

type Perms = { manage: boolean; lock: boolean; process: boolean; approve: boolean; publish: boolean; unpublish: boolean };

export function ExamWorkflow({ examId, status, missing, perms }: { examId: string; status: string; missing: number; perms: Perms }) {
  const router = useRouter();
  const t = (to: Parameters<typeof transitionExam>[0]["to"]) => (reason: string) => transitionExam({ id: examId, to, reason });
  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" && perms.manage && (
        <ConfirmAction size="sm" variant="outline" icon={<CalendarCheck />} label="Schedule" title="Mark examination as scheduled?" description="Students in the class will see the schedule." action={t("scheduled")} success="Examination scheduled" />
      )}
      {(status === "draft" || status === "scheduled") && perms.manage && (
        <ConfirmAction size="sm" icon={<PenLine />} label="Open marks entry" title="Open marks entry?" description="Assigned teachers and examiners can enter marks until the deadline." action={t("marks_entry")} success="Marks entry opened" />
      )}
      {status === "marks_entry" && perms.lock && (
        <ConfirmAction size="sm" icon={<Lock />} label="Lock marks" disabled={missing > 0}
          title="Lock all marks?" description={<p>No further changes will be possible unless marks entry is reopened with a recorded reason. Every candidate must have marks or a status (absent/exempted).</p>}
          action={t("marks_locked")} success="Marks locked" />
      )}
      {(status === "marks_locked" || status === "results_processed") && perms.process && (
        <ConfirmAction size="sm" icon={<Calculator />} label={status === "results_processed" ? "Re-process results" : "Process results"}
          title="Process results?" description="Results are computed from locked marks using the examination's grading scheme. Any previous unapproved results are replaced."
          action={async () => { const r = await processResults({ id: examId }); if (r.ok) router.push(`/results/${examId}`); return r; }} success="Results processed" />
      )}
      {(status === "marks_locked" || status === "results_processed") && perms.lock && (
        <ConfirmAction size="sm" variant="outline" icon={<LockOpen />} label="Reopen marks entry" requireReason
          title="Reopen marks entry?" description="Processed (unapproved) results will be discarded. The reason is recorded in the audit log." action={t("marks_entry")} success="Marks entry reopened" />
      )}
      {status === "results_processed" && perms.approve && (
        <ConfirmAction size="sm" variant="success" icon={<CheckCircle2 />} label="Approve results" title="Approve these results?" description="Approved results become immutable and can be published by the Examination Controller." action={t("results_approved")} success="Results approved" />
      )}
      {status === "results_approved" && perms.publish && (
        <ConfirmAction size="sm" variant="success" icon={<Send />} label="Publish results" title="Publish results to students?" description="Students will be able to view their results and download mark statements. Completeness is re-checked before publication." action={t("published")} success="Results published" />
      )}
      {status === "results_approved" && perms.approve && (
        <ConfirmAction size="sm" variant="outline" icon={<Undo2 />} label="Withdraw approval" requireReason title="Withdraw approval?" action={t("results_processed")} success="Approval withdrawn" />
      )}
      {status === "published" && perms.unpublish && (
        <ConfirmAction size="sm" variant="destructive" icon={<Undo2 />} label="Withdraw publication" requireReason title="Withdraw published results?" description="Exceptional action. Students will no longer see these results. The reason is permanently recorded." action={t("results_processed")} success="Publication withdrawn" />
      )}
    </div>
  );
}
