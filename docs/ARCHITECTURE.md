# Architecture & database design

## Overview

```
Browser ──► Next.js 16 (Node runtime)
              ├─ proxy.ts ............ refreshes the Supabase session cookie; optimistic redirect to /login
              ├─ Server Components ... read data with the USER's JWT (RLS applies)
              ├─ Server Actions ...... auth + permission check + Zod validation → DB write / SQL function
              └─ Route handlers ...... CSV/XLSX exports, PDFs, private document downloads
                       │
                       ▼
            Supabase: PostgreSQL 17 (RLS on every table) · Auth (email/password) · Storage (private buckets)
```

### Three layers of authorisation

1. **UI** hides navigation and controls the user may not use (`visibleNav`, `can()`), purely for usability.
2. **Server** — every page calls `requirePermission()` / `requireStudent()` (renders 403 otherwise); every server action is wrapped in `createAction()` which re-authenticates, checks permissions, validates input with Zod and rate-limits. Route handlers use `apiGuard()`.
3. **Database** — Row Level Security on every table, and SECURITY DEFINER functions for all sensitive multi-step operations, which re-check permissions themselves. Even a request crafted by hand against the Supabase REST API with a valid user token cannot bypass these rules.

Roles live in `public.user_roles` (never in user-editable auth metadata). `public.has_permission(key)` resolves the caller's permissions and is used in policies. Ownership rules (a teacher's classes, a student's own records) are expressed directly in policies through helper functions (`my_taught_student_ids()`, `current_student_id()`, …).

The service-role key is used only in `src/lib/supabase/admin.ts` (marked `server-only`) for Auth administration (create account, sign out a deactivated user) after the caller's permission has been verified.

### Why Cache Components is disabled

Every page is per-user and RLS-scoped, so pages render dynamically on each request and are never served from a shared cache. Supabase queries are not cached between users.

## Key design decisions

| Decision | Reason |
|---|---|
| **Results are computed in SQL** (`compute_exam_results`) | Stored results always match stored marks; no client can submit fabricated totals. A TypeScript mirror (`src/lib/domain/grading.ts`) powers live previews, and an integration test asserts both agree for every result. |
| **Results are stored (snapshotted)** | A published result must not change if grading rules are edited later. Triggers make approved/published results immutable. |
| **Marks are written only via `save_marks()`** | One place enforces assignment, deadline, lock state, maximum marks, candidate membership, duplicate detection and revision logging. |
| **Missing ≠ zero** | No mark row means "missing". Locking requires every candidate to have marks *or* an explicit status (absent/exempted/withheld). Incomplete results cannot be approved or published. |
| **Payments are immutable** | No update/delete; corrections are reversals (`reverse_payment`) recorded as adjustments with a reason. `record_payment` locks the fee assignment row, checks the balance and issues a sequential receipt number in one transaction. |
| **Fee assignments snapshot amounts** | Editing a fee structure never rewrites a student's historical dues. Balances are derived in a view (`student_fee_balances`, `security_invoker`). |
| **Grading schemes are data** | Pass percentages, component rules, compartment limits, grade bands, grade points and credit weighting are configurable per scheme; programmes have a default and each exam selects one. HS and university schemes are separate rows. |
| **Configurable attendance statuses** | `counts_as_present` / `counts_in_total` make approved leave excluded (or counted) per college policy. |
| **Workflow state changes only through functions** | `examinations.status` can be changed only inside `transition_examination` / `compute_exam_results` (trigger-enforced). |
| **Append-only logs** | `audit_logs`, `mark_revisions`, `payment_adjustments` reject UPDATE/DELETE via triggers. |

## Examination workflow

```
draft → scheduled → marks_entry → marks_locked → results_processed → results_approved → published
          (exams.manage)  (marks.lock)  (results.process)   (results.approve)   (results.publish)
reopen marks (marks.lock + reason) from marks_locked/results_processed; withdraw approval (results.approve + reason);
withdraw publication (results.unpublish = Super Admin only + reason)
```

## Database schema (main tables)

**Identity & access:** `profiles` (1:1 auth.users), `roles`, `permissions`, `role_permissions`, `user_roles`, `institution_settings` (singleton), `audit_logs`, `number_sequences` (atomic counters), `notifications`.

**Academic structure:** `academic_sessions`, `departments`, `programmes` (level, stream, class/semester structure, default grading scheme), `programme_terms` (Class XI/XII or Semester 1..n — the spec's *classes* and *semesters*), `course_categories`, `subjects` (paper codes), `course_offerings` (subject × programme term × session, compulsory flag, credits), `teacher_assignments`.

**People:** `staff`, `staff_attendance`, `students`, `student_guardians`, `student_enrolments` (one active per student; history preserved), `student_subject_enrolments`, `student_status_history`.

**Admissions:** `admission_periods`, `admissions`, `admission_documents`.

**Attendance:** `attendance_statuses`, `attendance_sessions` (unique per class/subject/date/period), `attendance_records` (unique per session/student).

**Examinations:** `examination_types`, `grading_schemes`, `grading_rules`, `examinations`, `examination_subjects` (components, max/pass marks, examiner, deadline), `examination_candidates` (improvement/supplementary), `marks`, `mark_revisions`, `results`, `result_subjects`.

**Fees:** `fee_heads`, `payment_methods`, `fee_structures`, `fee_structure_items`, `student_fee_assignments`, `fee_concessions`, `payments`, `payment_adjustments`, `receipts`; view `student_fee_balances`.

**Other:** `timetable_periods`, `timetable_entries` (unique class/teacher/room slots), `notices`, `notice_audiences`, `document_metadata` (files in private Storage buckets).

Migrations are in `supabase/migrations/` (numbered, plain SQL); `20261029000008_roles_permissions.sql` is generated from `src/lib/auth/permissions.ts`.

## Performance notes

RLS helper calls that do not depend on the row are wrapped as `(select fn())` so Postgres evaluates them once per query; row-dependent checks use set membership (`col in (select my_ids())`). Counting 16k attendance rows as a teacher takes ~15 ms locally.
