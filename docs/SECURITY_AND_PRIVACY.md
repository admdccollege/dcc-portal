# Security, privacy & data retention

## Controls implemented

| Area | Control |
|---|---|
| Authentication | Supabase Auth (bcrypt-hashed passwords, never stored in plain text); public sign-up disabled; min. 10 chars with letters and digits; sign-in rate limits per IP and per account; generic error messages; password reset without account enumeration; refresh-token rotation; deactivation revokes sessions |
| Authorisation | Least-privilege role matrix; permissions checked in the UI, on the server (every page/action/route) and in the database (RLS on every table + SECURITY DEFINER functions with explicit checks). Roles live in DB tables, not user-editable metadata. No self-escalation; only a Super Admin grants Super Admin; last Super Admin protected |
| Data isolation | Students see only their own records; teachers only students/attendance/marks of offerings they are assigned to; unpublished results invisible to students; drafts/expired/untargeted notices hidden |
| Integrity | Workflow transitions only via functions; marks locked after approval; published results immutable; payments immutable (reversals only); append-only audit log, mark revisions and payment adjustments; DB constraints for uniqueness, ranges and referential integrity; row locks for payments |
| Separation of duties | Process/publish (Exam Controller) vs approve (Principal); concession request vs approval (different person, DB-enforced) |
| Input handling | Zod validation on every server action; parameterised queries via PostgREST; search terms reduced to a safe character set; React output encoding; CSV/Excel formula-injection neutralised in exports; uploads checked for size, MIME type and magic bytes |
| Files | All Storage buckets private with size/MIME limits; access mirrored by RLS on `document_metadata`; downloads via 60-second signed URLs |
| Secrets | Service-role key only in server-only module; `.env*` git-ignored; `.env.example` has placeholders only |
| Transport & headers | HTTPS (HSTS), `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, restrictive permissions policy, no `X-Powered-By` |
| Exports | Only for roles with export permissions; rate-limited; RLS still applies to exported rows |
| Audit | Sensitive changes logged with actor, time, before/after values |
| Public surface | `/login`, `/forgot-password`, `/auth/confirm`, `/verify` only. Verification returns minimal fields for *published* results, masks the name, and is rate-limited |

## Personal data

Collected: name, date of birth, gender (optional), contact details, address, guardian contact, academic and fee records. **Not collected:** Aadhaar numbers, caste/religion, biometrics, card or bank credentials. Only add fields that are required and lawfully authorised.

Access to personal data is limited by role (see the permissions matrix). Exports and printed profiles contain personal data — store and dispose of them securely.

## Retention & deletion policy (recommended)

| Record | Retention |
|---|---|
| Student academic records, results, mark statements | Permanent (students are archived, never deleted) |
| Financial records (fees, payments, receipts, adjustments) | Permanent in the system; at least as required by applicable accounting/audit rules |
| Audit logs, mark revisions | Permanent (append-only) |
| Attendance | Permanent with the academic record |
| Admission applications not admitted | 2 academic years, then the office may request deletion by a database administrator |
| Uploaded documents | As long as the related record requires; remove superseded files |
| Notifications | May be purged after 1 year |
| Off-site backups | 4 weekly + 12 monthly encrypted copies |

Deletion requests for personal data must be approved by the Principal and executed by the system maintainer with a record in the audit log; academic and financial records required for certificates and audits are retained.

## Operational responsibilities

- Review *Users & Permissions* each semester; deactivate leavers on their last day.
- Review *Audit logs* for result withdrawals, reversals and role changes monthly.
- Keep the secret key only in the hosting environment; rotate it if exposed (Supabase › API Keys) and redeploy.
- Apply dependency updates monthly (`pnpm outdated`, run the full test suite before deploying).

## Reporting a security issue

Report suspected vulnerabilities or data exposure to the college IT coordinator immediately. Do not test against production with real data.
