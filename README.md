# Damdei Christian College — Education Portal

A secure, full-stack college management system for **Damdei Christian College (DCC), Manipur**, covering Higher Secondary (Class XI/XII Arts & Science), the Four-Year Undergraduate Programme (FYUP) and Postgraduate (MA/MSc) programmes.

Used by the Principal, office staff, examination controller, accountant, teachers and students. Every screen reads and writes a real PostgreSQL database through Supabase, with **Row Level Security** enforcing who can see and change what.

---

## Features

| Module | Highlights |
|---|---|
| **Dashboard** | Role-aware cards and charts (enrolment, attendance, fee collection, latest results), teacher's classes today and pending marks |
| **Students** | Register, edit, archive, search/filter, auto admission numbers, CSV/Excel import with row-level validation (all-or-nothing), exports, printable profile, promotion/repeat/graduation with preserved history, status changes (withdraw/transfer/suspend) with reasons |
| **Admissions** | Admission periods (fees, seats, eligibility, documents), applications with numbering, document checklist & verification, review workflow, conversion to student (with optional admission-fee payment) in one transaction, acknowledgement/confirmation slip PDF |
| **Academic programmes** | Sessions (one current), programmes, classes/semesters, departments |
| **Subjects & courses** | Subject catalogue (paper codes, credits), configurable course categories (Major, Minor, SEC, AEC, MDC, VAC, …), offerings per class & session, teacher/examiner allocation, copy offerings to a new session |
| **Attendance** | By class/subject/date/period, configurable statuses (incl. approved leave excluded from the total), bulk marking, edit cutoff for teachers, register locking, reports with low-attendance flags and alerts, printable monthly register, CSV/Excel |
| **Examinations & marks** | Configurable exam types, components (theory/practical/internal), max/pass marks, examiners, deadlines; spreadsheet-like marks grid (keyboard navigation, paste from Excel, CSV import), absent/exempt/withheld statuses, revision history with reasons, corrections after deadline only with permission |
| **Results & mark sheets** | Results computed **in the database** from locked marks using configurable grading schemes (COHSEM-style and university-style schemes are separate), compartment, SGPA; draft → approved → published workflow with separation of duties; A4 PDF statements of marks (single & bulk) with QR verification code; public verification page |
| **Fees & payments** | Fee heads, programme/term fee structures, assignment snapshots, payments with sequential FY receipt numbers, PDF receipts, concessions/waivers needing a second approver, charges/fines/refunds, reversals instead of edits, dues/overdue tracking, collection & outstanding reports |
| **Staff** | Directory, confidential fields gated by permission, subject allocation, timetable, staff attendance, login creation with roles |
| **Timetable** | Class-wise and teacher-wise weekly grids; class, teacher and room clashes blocked |
| **Notices** | Categories, audiences (everyone / students / staff / programme / class), scheduled publish & expiry, pinned notices, private PDF/image attachments |
| **Reports & analytics** | Enrolment, admissions, attendance, exam performance, fee collection, outstanding dues, course allocation — CSV, Excel and PDF |
| **Users & permissions** | Role assignment (audited), activation/deactivation (signs the user out), password reset email, permission matrix |
| **Settings & audit** | Institution settings, grading schemes & grade bands, attendance statuses, exam types, append-only audit log viewer & export |
| **Student portal** | Own profile, attendance by subject, published results with mark statements, fees & receipts, timetable, notices |

## Technology

Next.js 16 (App Router, TypeScript, Turbopack) · React 19 · Tailwind CSS 4 · shadcn/ui-style components on Radix UI · Lucide icons · React Hook Form + Zod · Supabase (PostgreSQL 17, Auth, Storage, RLS) · Recharts · @react-pdf/renderer · ExcelJS · PapaParse · Vitest · Playwright.

---

## Quick start (local development)

**Prerequisites:** Node.js 20+ (22 recommended), pnpm 10, Docker (for the local Supabase stack).

```bash
pnpm install
```

```bash
pnpm db:start
```

`db:start` prints your local API URL and keys. Copy `.env.example` to `.env.local` and fill in the values (the default local demo keys work as-is):

```bash
cp .env.example .env.local
```

```bash
pnpm db:reset
```

`db:reset` applies all migrations in `supabase/migrations/` and loads the **fictional** development seed (`supabase/seed.sql`).

```bash
pnpm dev
```

Open http://localhost:3000.

> If Docker cannot pull images from AWS ECR in your network, run the Supabase CLI with `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`.

### Demo accounts (development seed only)

All demo accounts use the password **`DccDemo@2026`**. All people and data in the seed are fictional.

| Role | Email |
|---|---|
| Super Administrator | `superadmin@dcc.example` |
| Principal | `principal@dcc.example` |
| Office Administrator | `office@dcc.example` |
| Examination Controller | `exams@dcc.example` |
| Accountant | `accounts@dcc.example` |
| Teacher (Physics) | `teacher.physics@dcc.example` (also `teacher.english@`, `teacher.history@`, …) |
| Student (Class XI Science) | `student.science@dcc.example` |
| Student (FYUP B.A.) | `student.arts@dcc.example` |

The seed includes 176 students across all programmes, 20 days of attendance, a **published** Unit Test (Class XI Science), an internal assessment with marks entry in progress, a scheduled terminal exam, fee structures with payments (one reversed), a concession, admissions in several states, a timetable and targeted notices.

> ⚠️ The seed contains **sample** grading schemes clearly labelled “verify”. They are not official COHSEM or Manipur University rules. Configure and verify the real regulations under **Settings › Grading schemes** before processing official results.

---

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Develop / build / run production server |
| `pnpm lint` · `pnpm typecheck` · `pnpm format` | ESLint · TypeScript · Prettier |
| `pnpm test` | Unit tests (pure domain logic) |
| `pnpm test:integration` | Integration tests against the local Supabase stack with real user sign-ins (run `pnpm db:reset` first) |
| `pnpm test:e2e` | Playwright end-to-end tests (needs the dev server and a freshly reset DB) |
| `pnpm db:start` · `pnpm db:stop` · `pnpm db:reset` | Local Supabase stack · **reset is destructive — development only** |
| `pnpm db:types` | Regenerate `src/lib/supabase/database.types.ts` from the local schema |
| `pnpm db:gen-permissions` | Regenerate the roles/permissions migration and `docs/PERMISSIONS_MATRIX.md` from `src/lib/auth/permissions.ts` |
| `pnpm create-admin` | Create the first Super Administrator in a new (production) project |

## Testing

```bash
pnpm test
```

```bash
pnpm db:reset && pnpm test:integration
```

```bash
pnpm db:reset && pnpm test:e2e
```

- **Unit (52 tests):** grading/result rules (absent, exempt, withheld, missing marks never zero, component pass, compartment, SGPA), attendance %, fee arithmetic in paise, CSV import validation, permission matrix.
- **Integration (36 tests):** real JWTs per role against Postgres/PostgREST — RLS isolation (students, teachers), anonymous access, self-escalation, deactivation, confidential staff fields, notices targeting, marks validation and authorisation, missing-marks lock, publication workflow & separation of duties, immutability of published results and payments, overpayment and concurrent-payment protection, reversals, concession approval, attendance cutoff/duplicates, atomic CSV import, admission approval/conversion, and a check that **database results equal the TypeScript grading rules** for every seeded result.
- **E2E (15 tests):** login/redirects/open-redirect protection, role landing pages, access denial, unauthorised exports, student creation, validation, attendance, payment + receipt, overpayment prevention, and a full examination lifecycle (create → marks → lock → process → approve → publish → PDF → verification → student view).

## Project structure

```
src/
  app/(auth)/          login, forgot password
  app/(portal)/        authenticated pages (one folder per module; /my = student portal)
  app/api/             exports (CSV/XLSX), PDFs, reports, private document downloads
  app/verify/          public result verification
  components/          UI primitives (ui/), shared widgets (shared/), module components
  lib/auth/            permission matrix, session/DAL, API guard
  lib/domain/          pure business rules (grading, attendance, fees, CSV import)
  lib/pdf/             marksheet, receipt and report PDF documents
  lib/supabase/        server/admin clients, generated DB types
  server/              server actions (validated with Zod, permission-checked)
  proxy.ts             session refresh + optimistic auth redirect
supabase/
  migrations/          schema, RLS, functions, reference data
  seed.sql             fictional development data
tests/unit · tests/integration · tests/e2e
docs/                  architecture, deployment, backups, admin guide, permissions, security, limitations
```

## Documentation

- [Architecture & database design](docs/ARCHITECTURE.md)
- [Deployment guide & production checklist](docs/DEPLOYMENT.md)
- [Backup & recovery](docs/BACKUP_AND_RECOVERY.md)
- [Administrator user guide](docs/ADMIN_GUIDE.md)
- [User role & permissions matrix](docs/PERMISSIONS_MATRIX.md)
- [Security, privacy & data retention](docs/SECURITY_AND_PRIVACY.md)
- [Known limitations & future enhancements](docs/KNOWN_LIMITATIONS.md)

## Mobile apps

Native apps that open the portal securely, with in-app downloads, printing and offline handling:

- **Android:** [`android/`](android/README.md). Build with `android/build.sh debug` or `android/build.sh release`; no Android Studio or Gradle is needed.
- **iOS / iPadOS:** [`ios/`](ios/README.md). Generate the Xcode project with `xcodegen generate` and build in Xcode on a Mac.

`.github/workflows/mobile.yml` builds and tests both apps.
