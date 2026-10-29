# Backup & recovery

The database is the system of record for students, marks, results and money. Plan for two kinds of failure: **platform loss** (restore from backup) and **human error** (most errors are corrected inside the app because history is append-only).

## What to back up

| Data | Where | Backed up by |
|---|---|---|
| All records (students, marks, results, payments, audit log, …) | Supabase PostgreSQL | Supabase daily backups (+ PITR on Pro) and your weekly off-site dump |
| Uploaded files (notice attachments, documents) | Supabase Storage (private buckets) | Weekly file sync (below) |
| Application code & migrations | Git repository | Your Git host |
| Secrets | Vercel/hosting env settings | Store copies in the college password manager |

## Automatic backups (Supabase)

- **Free/Pro:** daily backups retained per plan (Dashboard › Database › Backups).
- **Pro + PITR add-on (recommended during exam and admission seasons):** restore to any second within the retention window.

## Weekly off-site backup (recommended)

Use the **Session pooler / direct connection string** from Dashboard › Connect.

```bash
pg_dump "postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres" --schema=public --schema=auth --format=custom --no-owner --file=dcc-$(date +%F).dump
```

Encrypt the dump before storing it off-site (it contains personal data):

```bash
gpg --symmetric --cipher-algo AES256 dcc-$(date +%F).dump
```

Keep at least 4 weekly and 12 monthly copies in a location controlled by the college (not a personal account). Delete unencrypted copies.

### Storage files

```bash
npx supabase storage cp -r ss:///notice-attachments ./backup/notice-attachments --experimental
```

(Repeat for `student-documents`, `admission-documents`, `institution-assets`.)

## Restore procedures

### A. Restore the whole project (platform incident)

1. Supabase Dashboard › Database › Backups › choose the backup or PITR timestamp › Restore. The project is unavailable during restore.
2. Announce downtime; when complete, sign in as Super Administrator and spot-check recent payments, results and attendance.
3. Payments recorded after the restore point must be **re-entered from paper receipts/bank statements** — check the gap using receipt numbers.

### B. Restore into a new project from an off-site dump

1. Create a new Supabase project, link it, run `npx supabase db push` (schema), then restore data:

```bash
pg_restore --data-only --disable-triggers --no-owner --dbname="postgresql://postgres:PASSWORD@db.NEW_REF.supabase.co:5432/postgres" dcc-YYYY-MM-DD.dump
```

2. Point `NEXT_PUBLIC_SUPABASE_URL` and keys in hosting to the new project; redeploy.
3. Copy storage files back.

### C. Correct human errors (no restore needed)

| Mistake | Correction |
|---|---|
| Wrong payment | *Fees › student ledger › Reverse* (reason required), then record the correct payment |
| Wrong marks before lock | Edit in the marks grid (revision is logged) |
| Wrong marks after lock | Examination Controller reopens marks entry (reason required), corrects, re-locks, re-processes |
| Wrong published result | Super Administrator withdraws publication (reason), the exam controller reopens/corrects, Principal re-approves, publish again |
| Wrong student status | *Change status* (reinstate) — history keeps both events |
| Wrong attendance | Office/attendance manager edits (beyond the teacher cutoff) — logged |

## Rehearse

Test a restore into a scratch project **at least once per semester** and record the time it took. A backup that has never been restored is not a backup.

## Development only

`pnpm db:reset` **drops and recreates** the local database with fictional seed data. Never point it at a real project.
