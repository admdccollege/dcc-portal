# Known limitations & future enhancements

## Known limitations

1. **Grading rules must be configured.** Only clearly labelled *sample* schemes are provided (in the dev seed). Official COHSEM and Manipur University regulations (including grace marks, moderation, rounding conventions and CGPA across semesters) must be verified and configured by the college. Grace/moderation marks are not modelled.
2. **CGPA across semesters is not computed.** Each examination stores its own SGPA/percentage; programme-level CGPA and consolidated transcripts are future work.
3. **Rate limiting is in-memory per server instance.** Effective on a single instance; on serverless/multi-instance hosting each instance limits separately. Supabase Auth's own limits still apply. Use a shared store (e.g. Upstash Redis) for strict global limits.
4. **Role permissions are code-defined.** The matrix is changed in `src/lib/auth/permissions.ts` and applied by migration (deliberately, for review and consistency); the UI shows it read-only. Custom roles via the UI are not supported.
5. **No online payment gateway.** Counter, UPI, bank transfer, cheque and DD payments are recorded manually. Gateway integration requires API keys and webhook verification (see `DEPLOYMENT.md`).
6. **Email delivery depends on SMTP configuration.** Password resets and invites need a configured SMTP provider in production. In-app notifications are used for alerts; SMS/WhatsApp is not integrated.
7. **Photo/document uploads are implemented for notices.** The private-bucket infrastructure and policies also exist for student and admission documents, but upload screens for student photographs and admission documents are not yet built (documents are tracked as a checklist).
8. **HTTP status for denied pages is 200** in some streamed responses; the page renders the "Access denied" view and no data is sent. API routes return proper 401/403.
9. **Sections/divisions** within a class are stored on enrolments and timetables but there is no section-specific attendance filter yet.
10. **Timetable periods** are a single institution-wide period grid (configurable in the database, not yet in the UI).
11. **Bulk marksheets** generate one PDF of up to 500 statements; very large classes should be printed in batches.
12. **Localisation** is English only; dates use the Indian locale and IST.
13. **Hindi/Manipuri fonts in PDFs** are not embedded; PDFs use standard fonts (amounts print as "Rs.").

## Future enhancements

- Consolidated transcripts, CGPA and degree completion checks (credit requirements per FYUP regulations)
- Student/admission document uploads with OCR-free verification workflow and profile photographs
- Online admission form for applicants (public, rate-limited, with captcha and document upload)
- Payment gateway integration with webhook-verified receipts; fee reminders by SMS/email
- Parent/guardian portal accounts
- Library, hostel and transport modules
- Section-wise attendance and biometric/QR attendance integration
- Teacher leave management and substitution in the timetable
- Question paper and seating plan management for examinations
- Configurable role editor with approval workflow
- Data warehouse exports for NAAC/AISHE reporting
- Push notifications (PWA) and offline-capable attendance entry
