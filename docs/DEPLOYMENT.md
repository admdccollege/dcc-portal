# Deployment guide

The recommended production setup is **Supabase (hosted PostgreSQL, Auth, Storage)** plus **Vercel** for the Next.js app. Any Node.js 20+ host that can run `next start` also works.

> Nothing in this repository has been deployed to production. Follow this guide, then verify each item on the checklist below.

## 1. Create the Supabase project

1. Create a project at https://supabase.com (choose the **Mumbai (ap-south-1)** region for latency and data locality).
2. Note the **Project URL**, the **publishable (anon) key**, and the **secret (service-role) key** under *Project Settings › API Keys*.
3. Choose a plan with **daily backups**; the Pro plan adds point-in-time recovery (see `BACKUP_AND_RECOVERY.md`).

## 2. Apply the database migrations

From your machine, with the Supabase CLI (installed as a dev dependency):

```bash
npx supabase login
```

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

```bash
npx supabase db push
```

This applies every file in `supabase/migrations/` (schema, RLS policies, functions, storage buckets, roles/permissions and default reference data). **Do not run `supabase/seed.sql` in production** — it contains demo accounts with a known password.

## 3. Configure Supabase Auth (dashboard › Authentication)

| Setting | Value |
|---|---|
| **Allow new users to sign up** | **Off** (accounts are created by administrators only) |
| Email provider | **On** (email + password) |
| Confirm email | Off is acceptable (admins create confirmed accounts); On if you prefer |
| Minimum password length | 10, require letters and digits |
| Site URL | `https://portal.your-college.example` |
| Redirect URLs | `https://portal.your-college.example/auth/confirm` |
| SMTP | Configure a real SMTP provider (the built-in mailer is heavily rate-limited) so password-reset emails are delivered |
| JWT expiry | 3600 s (default) |
| MFA | Optional: enable TOTP for staff accounts |

Password-reset email template: keep the default `{{ .ConfirmationURL }}`; the app's `/auth/confirm` handler supports both PKCE codes and `token_hash` links.

## 4. Bootstrap the first Super Administrator

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SECRET_KEY=sb_secret_xxx ADMIN_EMAIL=you@college.example ADMIN_NAME="Your Name" pnpm create-admin
```

A temporary password is printed once. Sign in and change it immediately (*Account menu › Change password*).

## 5. Initial configuration (in the app)

1. **Settings › Institution** — name, address, contact, attendance threshold and edit window, number prefixes, marksheet disclaimer.
2. **Settings › Grading schemes** — create and **verify** schemes for COHSEM Higher Secondary and for Manipur University FYUP/PG (no official rules are shipped).
3. **Academic Programmes** — sessions (mark one current), programmes with their classes/semesters and default grading scheme, departments.
4. **Subjects & Courses** — subjects (paper codes), course categories, offerings per class; allocate teachers.
5. **Staff** — add staff, then *Create login* with the appropriate roles.
6. **Students** — import via CSV/Excel or admit through Admissions; create student logins as needed.
7. **Fees** — fee heads, payment methods, fee structures; assign to classes.

## 6. Deploy the Next.js app to Vercel

1. Import the Git repository into Vercel (framework preset: Next.js; build command `pnpm build`; Node 22).
2. Set environment variables (Production and Preview):

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key — safe to expose |
| `SUPABASE_SECRET_KEY` | **Secret** — server only; never prefix with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | `https://portal.your-college.example` (used in reset emails and marksheet QR codes) |
| `AUTH_RATE_LIMIT_PER_MINUTE` | Optional, default 20 per IP (raise if the whole campus shares one public IP) |
| `AUTH_RATE_LIMIT_PER_ACCOUNT` | Optional, default 5 per account |

3. Add your custom domain; HTTPS is automatic. Security headers (HSTS, frame denial, nosniff, referrer and permissions policies) are set in `next.config.ts`.

### Other hosts

```bash
pnpm install --frozen-lockfile && pnpm build && pnpm start
```

Run behind a TLS-terminating reverse proxy (nginx/Caddy). The in-memory rate limiter is per instance; for multiple instances use a shared store (see *Known limitations*).

## 7. Online payments (optional, not enabled)

The portal records payments received at the counter, by bank transfer, UPI, cheque or demand draft. It **does not** collect card or bank credentials. To accept online payments, integrate a payment gateway (e.g. Razorpay/PayU): create orders server-side, verify the gateway's webhook signature with its secret key, and only then call `record_payment` with the gateway reference. Never mark a payment as received on the basis of a client-side redirect.

## Production checklist

- [ ] Migrations applied with `supabase db push`; **seed not loaded**; no `@dcc.example` demo users exist
- [ ] Public sign-up disabled; SMTP configured; Site URL and redirect URL set
- [ ] Super Administrator created and temporary password changed
- [ ] Environment variables set; `SUPABASE_SECRET_KEY` present only server-side
- [ ] Storage buckets are **private** (Dashboard › Storage — all four `*-documents/attachments/assets` buckets show "Private")
- [ ] Grading schemes configured and verified against current COHSEM and university regulations
- [ ] Institution settings, sessions, programmes, subjects and fee heads configured
- [ ] Backups enabled (and PITR if on Pro); first weekly off-site dump taken and a restore rehearsed
- [ ] Test sign-in for each role; test a password reset email end-to-end
- [ ] Custom domain on HTTPS; `NEXT_PUBLIC_SITE_URL` matches it (QR codes on marksheets point to `/verify`)
- [ ] Staff trained using `ADMIN_GUIDE.md`; data-protection responsibilities assigned
