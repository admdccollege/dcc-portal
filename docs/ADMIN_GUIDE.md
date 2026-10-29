# Administrator user guide

This guide explains day-to-day use of the portal by role. Menus appear only for the features your role may use (see `PERMISSIONS_MATRIX.md`).

**Signing in:** use the email issued by the college office. *Forgot password?* sends a reset link. Change your password any time from the account menu (top right). After 5 failed attempts in a minute, sign-in pauses for a minute.

---

## 1. Start of an academic year (Office Administrator / Super Administrator)

1. **Academic Programmes › Academic sessions › New** — e.g. `2027-28`, dates. Use **Make current** when the year begins (dashboards and new records default to the current session).
2. **Subjects & Courses › Course offerings › Copy from session** — copies last year's subject offerings into the new session; then adjust per class (*Add offering*, compulsory flag, category, credits).
3. **Allocate teachers** — on each offering, click the person icon to assign a teacher or examiner. Teachers can only see and record data for their allocated offerings.
4. **Promote students** — *Students › Promote*, choose the old session's class, select students, *Promote to next term* in the new session (or *Repeat* / *Graduate* for final-term students). Old enrolments are kept as history.
5. **Fees** — create fee structures for the new session and *Assign to class*.
6. **Timetable** — build class timetables; clashes for classes, teachers and rooms are rejected automatically.

## 2. Students

- **New student:** *Students › New student*. Leave the admission number blank to generate the next one (`DCC/YYYY/NNNN`). Compulsory subjects are attached automatically; tick optional subjects.
- **Import:** *Students › Import* — choose the target session/programme/class, upload CSV or Excel using the template. Every row is validated (dates, phone, email, duplicates within the file and against existing records). **Nothing is saved unless every row is valid.**
- **Edit / subjects:** open a student › *Edit*, or *Edit subjects* (subjects with marks cannot be removed).
- **Withdraw / transfer / suspend / archive / reinstate:** *Change status* with a reason. Records are never deleted.
- **Login for a student:** (*Users & Permissions* holders) *Create login* on the student page; give the student the temporary password shown once.
- **Export / print:** CSV or Excel from the list (respects filters); *Print profile* produces a PDF.

Do not record Aadhaar numbers or other unnecessary sensitive data.

## 3. Admissions

1. **Admission periods** tab › *New admission period* — class, dates, admission fee, seats, minimum qualifying %, eligibility text and required documents (one per line).
2. **New application** — enter applicant details; an application number and document checklist are created.
3. Mark documents **Submitted**; a reviewer (office/principal) **Verifies** each.
4. **Review decision** — *Approve* is blocked until all required documents are verified and the minimum percentage is met. Rejection/waitlisting needs remarks.
5. **Admit as student** — creates the student record, enrolment, subjects and the admission-fee due; staff with payment permission can record the fee at the same time. Print the confirmation slip.

## 4. Attendance (Teachers)

1. *Attendance* — choose **Class**, **Subject**, **Date**, **Period**.
2. *Mark all present*, then change exceptions (A = absent, L = late, AL = approved leave, OD = on duty, ML = medical leave — configurable). Every student must be marked before saving.
3. Teachers may record or edit attendance for **today and the previous N days** (N is set in Settings; default 3). Older corrections are made by the office.
4. *Reports* shows each student's percentage = attended ÷ eligible × 100 (excused statuses excluded), low-attendance flags and how many sessions a student needs to recover. Office/Principal can send **low-attendance alerts** to students' portals.
5. *Register* prints a monthly register.

## 5. Examinations and marks

**Examination Controller**

1. *Examinations › New examination* — class, type, grading scheme, dates, marks-entry deadline, candidates (*all enrolled* or *selected* for improvement/supplementary).
2. Add subjects — *Add all subjects* (one component each) or *Add subject* (theory/practical/internal components with their own max/pass marks, examiner and optional deadline).
3. *Schedule* (students see it) → *Open marks entry*.

**Teachers / examiners — marks entry**

- Open the subject › *Enter marks*. Type marks, press **Enter/↓** to move down, paste a column from Excel, or *Import CSV* (template provided). Type **AB** for absent, or choose a status (absent, exempted, malpractice, withheld).
- Marks above the maximum or with more than 2 decimals are rejected. Blank means **missing** (never zero).
- After the deadline only the Examination Controller can correct marks, and must give a reason. Every change is kept in the revision history.

**Locking and results**

1. *Lock marks* — only possible when every candidate has marks or a status.
2. *Process results* — the database computes subject totals, percentages, grades, grade points/SGPA and pass/fail/compartment status using the exam's grading scheme.
3. **Principal** reviews (*Results* page: summary, subject pass rates, grade distribution, failed subjects) and clicks *Approve results*.
4. **Examination Controller** clicks *Publish results*. Students are notified and can download their statement of marks.
5. Corrections: before approval, *Reopen marks entry* (reason). After publication, only a Super Administrator can *Withdraw publication* (reason), after which the cycle repeats.

Mark statements are labelled **provisional** when the exam is marked provisional, carry a verification code/QR, and state that they are not official university or council marksheets. Anyone can check a code at `/verify`.

**Improvement / supplementary exams:** create an exam with *Selected candidates*, then *Add from failures* of a published exam.

## 6. Fees and payments (Accountant)

- **Setup:** *Fee heads & methods* tab (heads like Tuition, Lab; methods with "reference required" for UPI/bank transfer).
- **Structures:** *Fee structures › New* — heads and amounts for a programme/class; *Assign to class*. Assigned amounts are snapshotted per student.
- **Record a payment:** *Student dues* › *Record payment* (or from the student ledger). Amount cannot exceed the balance; UPI/bank payments need a reference. A sequential receipt number (`RCPT/2026-27/000123`) is issued; print the receipt.
- **Mistakes:** never edit — *Reverse* the payment with a reason (the receipt stays on record marked REVERSED) and record the correct one.
- **Concessions / waivers / scholarships:** *Adjust › Concession* creates a request; the Principal (not the requester) approves it.
- **Charges, fines, refunds:** *Adjust* on the ledger (refunds need reversal permission and cannot exceed the net amount paid).
- **Reports:** *Collection reports* (daily register, by method, Excel/PDF) and *Outstanding dues* Excel.

## 7. Staff, timetable, notices

- **Staff:** add/edit staff; confidential fields (DOB, address, qualification) are visible only to authorised roles. *Create login* assigns roles. Staff attendance is recorded on the *Staff attendance* tab.
- **Timetable:** class-wise view › click *Add* in a slot; teacher-wise view shows a teacher's week. Print from the browser.
- **Notices:** *New notice* (saved as draft) › choose audiences (everyone / all students / all staff / a programme / a class), optional publish-from and expiry › *Publish*. Attach a PDF/image (stored privately). *Archive* removes it from view.

## 8. Users, settings and audit (Super Administrator)

- **Users & Permissions:** change roles, deactivate/reactivate (deactivation signs the user out everywhere), send password reset. You cannot deactivate yourself or remove the last Super Administrator.
- **Settings:** institution details and thresholds, grading schemes and grade bands, attendance statuses, examination types.
- **Audit logs:** every sensitive change (student records, marks corrections, result workflow, payments, concessions, roles, settings) with who/when/what; filter and export CSV.

Role permissions are defined in source control (`src/lib/auth/permissions.ts`) and applied by migration so that every environment stays consistent; request changes through the system maintainer.
