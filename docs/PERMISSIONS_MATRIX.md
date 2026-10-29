# User role and permissions matrix

> Generated from `src/lib/auth/permissions.ts` by `pnpm db:gen-permissions`. Do not edit by hand.

## Roles

| Role | Description |
|---|---|
| **Super Administrator** (`super_admin`) | Full control of settings, roles and all records |
| **Principal** (`principal`) | Institution oversight, approvals and reports |
| **Office Administrator** (`office_admin`) | Admissions, student records, sessions and notices |
| **Examination Controller** (`exam_controller`) | Examinations, marks, results and publication |
| **Accountant** (`accountant`) | Fee structures, payments, receipts and dues |
| **Teacher** (`teacher`) | Assigned classes: attendance and marks entry |
| **Student** (`student`) | Own profile, attendance, results, fees and notices |

## Permissions

✅ = granted. Ownership rules apply on top of these permissions (enforced by Row Level Security):

- **Teachers** see only students, attendance and marks for course offerings they are assigned to (as teacher or examiner).
- **Students** see only their own profile, attendance, fees and receipts, and their own results *after publication*.
- **Notices** are visible only when published, within their publish/expiry window, and targeted at the reader.

| Permission | Description | Super Administrator | Principal | Office Administrator | Examination Controller | Accountant | Teacher | Student |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Dashboard** | |  |  |  |  |  |  |  |
| `dashboard.view` | View the staff dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  |
| **Students** | |  |  |  |  |  |  |  |
| `students.view` | View all student records | ✅ | ✅ | ✅ | ✅ | ✅ |  |  |
| `students.manage` | Create, edit, archive student records | ✅ |  | ✅ |  |  |  |  |
| `students.import` | Bulk import students from CSV/Excel | ✅ |  | ✅ |  |  |  |  |
| `students.export` | Export student lists | ✅ | ✅ | ✅ |  |  |  |  |
| `students.promote` | Promote, repeat or graduate students | ✅ |  | ✅ |  |  |  |  |
| **Admissions** | |  |  |  |  |  |  |  |
| `admissions.view` | View applications | ✅ | ✅ | ✅ |  |  |  |  |
| `admissions.manage` | Create/edit applications and admission periods | ✅ |  | ✅ |  |  |  |  |
| `admissions.review` | Verify documents and approve/reject applications | ✅ | ✅ | ✅ |  |  |  |  |
| `admissions.convert` | Convert approved applicants into students | ✅ |  | ✅ |  |  |  |  |
| **Academics** | |  |  |  |  |  |  |  |
| `academics.view` | View programmes, subjects and offerings | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  |
| `academics.manage` | Manage sessions, programmes, subjects and offerings | ✅ |  | ✅ |  |  |  |  |
| **Attendance** | |  |  |  |  |  |  |  |
| `attendance.take` | Record attendance for assigned classes | ✅ |  |  |  |  | ✅ |  |
| `attendance.view_all` | View attendance for all classes | ✅ | ✅ | ✅ | ✅ |  |  |  |
| `attendance.manage` | Edit any attendance, past cutoff, lock registers | ✅ |  | ✅ |  |  |  |  |
| `attendance.configure` | Configure attendance statuses | ✅ |  |  |  |  |  |  |
| **Examinations** | |  |  |  |  |  |  |  |
| `exams.view` | View all examinations and marks | ✅ | ✅ |  | ✅ |  |  |  |
| `exams.manage` | Create examinations, subjects, schedules, examiners | ✅ |  |  | ✅ |  |  |  |
| `marks.enter` | Enter marks for assigned subjects | ✅ |  |  |  |  | ✅ |  |
| `marks.enter_all` | Enter marks for any subject | ✅ |  |  | ✅ |  |  |  |
| `marks.correct` | Correct marks after the entry deadline (with reason) | ✅ |  |  | ✅ |  |  |  |
| `marks.lock` | Lock and reopen marks entry | ✅ |  |  | ✅ |  |  |  |
| `grading.manage` | Configure grading schemes and rules | ✅ |  |  | ✅ |  |  |  |
| **Results** | |  |  |  |  |  |  |  |
| `results.view` | View all results | ✅ | ✅ |  | ✅ |  |  |  |
| `results.process` | Compute results from locked marks | ✅ |  |  | ✅ |  |  |  |
| `results.approve` | Approve processed results | ✅ | ✅ |  |  |  |  |  |
| `results.publish` | Publish approved results | ✅ |  |  | ✅ |  |  |  |
| `results.unpublish` | Withdraw published results (exceptional) | ✅ |  |  |  |  |  |  |
| **Fees** | |  |  |  |  |  |  |  |
| `fees.view` | View fee structures, dues and payments | ✅ | ✅ |  |  | ✅ |  |  |
| `fees.manage` | Manage fee structures, assignments and charges | ✅ |  |  |  | ✅ |  |  |
| `fees.export` | Export financial records | ✅ | ✅ |  |  | ✅ |  |  |
| `payments.record` | Record fee payments and issue receipts | ✅ |  |  |  | ✅ |  |  |
| `payments.reverse` | Reverse payments and record refunds | ✅ | ✅ |  |  | ✅ |  |  |
| `concessions.approve` | Approve or reject concessions and waivers | ✅ | ✅ |  |  |  |  |  |
| **Staff** | |  |  |  |  |  |  |  |
| `staff.view` | View staff records | ✅ | ✅ | ✅ |  |  |  |  |
| `staff.view_confidential` | View confidential staff information | ✅ | ✅ |  |  |  |  |  |
| `staff.manage` | Manage staff records and allocations | ✅ |  | ✅ |  |  |  |  |
| **Timetable** | |  |  |  |  |  |  |  |
| `timetable.view` | View all timetables | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  |
| `timetable.manage` | Create and edit timetables | ✅ |  | ✅ |  |  |  |  |
| **Notices** | |  |  |  |  |  |  |  |
| `notices.manage` | Create and edit notices (incl. drafts) | ✅ | ✅ | ✅ | ✅ |  |  |  |
| `notices.publish` | Publish and archive notices | ✅ | ✅ | ✅ |  |  |  |  |
| **Reports** | |  |  |  |  |  |  |  |
| `reports.view` | View academic reports and analytics | ✅ | ✅ | ✅ | ✅ |  |  |  |
| `reports.export` | Export reports | ✅ | ✅ |  | ✅ |  |  |  |
| **Administration** | |  |  |  |  |  |  |  |
| `users.view` | View user accounts | ✅ | ✅ |  |  |  |  |  |
| `users.manage` | Create accounts, assign roles, activate/deactivate | ✅ |  |  |  |  |  |  |
| `roles.manage` | Edit role permissions | ✅ |  |  |  |  |  |  |
| `settings.manage` | Manage institution settings | ✅ |  |  |  |  |  |  |
| `audit.view` | View audit logs | ✅ | ✅ |  |  |  |  |  |
| **Student Portal** | |  |  |  |  |  |  |  |
| `portal.student` | Use the student self-service portal |  |  |  |  |  |  | ✅ |

## Separation of duties

- Results: the Examination Controller **processes** and **publishes**; the Principal **approves**. Neither can do the other's step. Only a Super Administrator can **withdraw** published results (reason required, audited).
- Concessions/waivers: requested by the Accountant, approved by someone else (Principal); the database rejects self-approval.
- Payments are immutable; corrections are reversals with a mandatory reason.
- Role grants go through an audited database function; nobody can elevate their own role, and only a Super Administrator can grant Super Administrator.
