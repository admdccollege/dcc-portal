-- =============================================================================
-- DCC Portal — Academic structure, staff and student records
-- =============================================================================

create type public.programme_level as enum ('higher_secondary', 'undergraduate', 'postgraduate');
create type public.term_kind as enum ('class', 'semester');
create type public.record_status as enum ('active', 'inactive');
create type public.student_status as enum ('active', 'withdrawn', 'transferred', 'graduated', 'suspended', 'archived');
create type public.enrolment_status as enum ('active', 'promoted', 'repeated', 'withdrawn', 'transferred', 'completed');
create type public.staff_status as enum ('active', 'on_leave', 'resigned', 'retired');
create type public.gender as enum ('female', 'male', 'other', 'undisclosed');

-- -----------------------------------------------------------------------------
-- Atomic counters for human-readable numbers (admission, receipt, application).
-- -----------------------------------------------------------------------------
create table public.number_sequences (
  scope text primary key,
  last_value bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.number_sequences enable row level security;
-- No policies: only SECURITY DEFINER functions touch this table.

create or replace function public.next_sequence_value(p_scope text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into public.number_sequences as s (scope, last_value)
  values (p_scope, 1)
  on conflict (scope) do update set last_value = s.last_value + 1, updated_at = now()
  returning last_value;
$$;
revoke execute on function public.next_sequence_value(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Academic sessions, programmes and terms (classes / semesters)
-- -----------------------------------------------------------------------------
create table public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,                     -- e.g. '2026-27'
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date > start_date)
);
create unique index academic_sessions_one_current on public.academic_sessions (is_current) where is_current;
create trigger academic_sessions_updated_at before update on public.academic_sessions
  for each row execute function public.set_updated_at();

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Grading schemes are referenced by programmes; full definition in exams migration.
create table public.grading_schemes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  level public.programme_level,
  description text,
  -- Pass criteria (all configurable; verify against applicable regulations).
  subject_pass_percent numeric(5,2) check (subject_pass_percent between 0 and 100),
  aggregate_pass_percent numeric(5,2) check (aggregate_pass_percent between 0 and 100),
  require_component_pass boolean not null default true,
  require_all_subjects_pass boolean not null default true,
  max_failed_subjects_for_compartment integer not null default 0 check (max_failed_subjects_for_compartment >= 0),
  use_grade_points boolean not null default false,
  use_credits boolean not null default false,
  decimals smallint not null default 2 check (decimals between 0 and 4),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger grading_schemes_updated_at before update on public.grading_schemes
  for each row execute function public.set_updated_at();

create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                     -- e.g. 'HS-SCI', 'FYUP-BA'
  name text not null,                            -- e.g. 'Higher Secondary (Science)'
  level public.programme_level not null,
  stream text,                                   -- e.g. 'Arts', 'Science'
  term_kind public.term_kind not null,
  total_terms smallint not null check (total_terms between 1 and 12),
  awarding_body text,                            -- e.g. 'COHSEM', 'Manipur University'
  department_id uuid references public.departments (id) on delete set null,
  grading_scheme_id uuid references public.grading_schemes (id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger programmes_updated_at before update on public.programmes
  for each row execute function public.set_updated_at();

-- A term is a "class" (HS: Class XI, Class XII) or a "semester" (UG/PG).
create table public.programme_terms (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes (id) on delete cascade,
  sequence smallint not null check (sequence >= 1),
  name text not null,                            -- 'Class XI', 'Semester 3'
  created_at timestamptz not null default now(),
  unique (programme_id, sequence),
  unique (programme_id, name)
);

-- Configurable course categories (Major, Minor, SEC, AEC, MDC, VAC, Core...).
create table public.course_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  level public.programme_level not null,
  sort_order smallint not null default 0,
  unique (level, code)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                     -- paper code
  name text not null,
  level public.programme_level not null,
  department_id uuid references public.departments (id) on delete set null,
  credits numeric(4,1) check (credits >= 0),
  has_practical boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subjects_level_idx on public.subjects (level);
create trigger subjects_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();

-- A subject offered to a programme term in an academic session.
create table public.course_offerings (
  id uuid primary key default gen_random_uuid(),
  academic_session_id uuid not null references public.academic_sessions (id) on delete restrict,
  programme_id uuid not null references public.programmes (id) on delete restrict,
  term_id uuid not null references public.programme_terms (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  category_id uuid references public.course_categories (id) on delete set null,
  is_compulsory boolean not null default false,
  credits numeric(4,1) check (credits >= 0),     -- overrides subject credits if set
  created_at timestamptz not null default now(),
  unique (academic_session_id, programme_id, term_id, subject_id)
);
create index course_offerings_class_idx on public.course_offerings (academic_session_id, programme_id, term_id);

create or replace function public.check_offering_term()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.programme_terms t where t.id = new.term_id and t.programme_id = new.programme_id) then
    raise exception 'Term does not belong to the selected programme' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger course_offerings_check_term before insert or update on public.course_offerings
  for each row execute function public.check_offering_term();

-- -----------------------------------------------------------------------------
-- Staff
-- -----------------------------------------------------------------------------
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  employee_id text not null unique,
  full_name text not null,
  designation text not null,
  department_id uuid references public.departments (id) on delete set null,
  email extensions.citext,
  phone text,
  is_teaching boolean not null default true,
  date_of_joining date,
  status public.staff_status not null default 'active',
  -- confidential fields (visible only with staff.view_confidential)
  date_of_birth date,
  address text,
  qualification text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index staff_email_key on public.staff (email) where email is not null;
create trigger staff_updated_at before update on public.staff
  for each row execute function public.set_updated_at();

create type public.assignment_role as enum ('teacher', 'examiner');

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  course_offering_id uuid not null references public.course_offerings (id) on delete cascade,
  role public.assignment_role not null default 'teacher',
  created_at timestamptz not null default now(),
  unique (staff_id, course_offering_id, role)
);
create index teacher_assignments_offering_idx on public.teacher_assignments (course_offering_id);

create table public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'absent', 'leave', 'duty')),
  remarks text,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (staff_id, date)
);

-- -----------------------------------------------------------------------------
-- Students
-- -----------------------------------------------------------------------------
create table public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  admission_no text not null unique,
  university_roll_no text,
  registration_no text,
  full_name text not null check (length(trim(full_name)) > 1),
  date_of_birth date not null check (date_of_birth > '1950-01-01'),
  gender public.gender not null default 'undisclosed',
  phone text,
  email extensions.citext,
  address text,
  admission_date date not null default current_date,
  status public.student_status not null default 'active',
  scholarship_note text,
  photo_path text,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index students_university_roll_key on public.students (university_roll_no) where university_roll_no is not null;
create unique index students_registration_key on public.students (registration_no) where registration_no is not null;
create index students_name_idx on public.students (lower(full_name));
create index students_dob_name_idx on public.students (date_of_birth, lower(full_name));
create trigger students_updated_at before update on public.students
  for each row execute function public.set_updated_at();

create table public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  name text not null,
  relationship text not null,
  phone text,
  email extensions.citext,
  address text,
  is_primary boolean not null default true,
  created_at timestamptz not null default now()
);
create index student_guardians_student_idx on public.student_guardians (student_id);

create table public.student_enrolments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete restrict,
  academic_session_id uuid not null references public.academic_sessions (id) on delete restrict,
  programme_id uuid not null references public.programmes (id) on delete restrict,
  term_id uuid not null references public.programme_terms (id) on delete restrict,
  roll_no text,
  section text,
  status public.enrolment_status not null default 'active',
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, academic_session_id, term_id)
);
create unique index student_enrolments_one_active on public.student_enrolments (student_id) where status = 'active';
create unique index student_enrolments_roll_key on public.student_enrolments (academic_session_id, programme_id, term_id, roll_no)
  where roll_no is not null and status = 'active';
create index student_enrolments_class_idx on public.student_enrolments (academic_session_id, programme_id, term_id, status);
create trigger student_enrolments_updated_at before update on public.student_enrolments
  for each row execute function public.set_updated_at();

create or replace function public.check_enrolment_term()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.programme_terms t where t.id = new.term_id and t.programme_id = new.programme_id) then
    raise exception 'Term does not belong to the selected programme' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger student_enrolments_check_term before insert or update on public.student_enrolments
  for each row execute function public.check_enrolment_term();

create table public.student_subject_enrolments (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null references public.student_enrolments (id) on delete cascade,
  course_offering_id uuid not null references public.course_offerings (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (enrolment_id, course_offering_id)
);
create index student_subject_enrolments_offering_idx on public.student_subject_enrolments (course_offering_id);

create or replace function public.check_subject_enrolment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.student_enrolments e
    join public.course_offerings o
      on o.academic_session_id = e.academic_session_id
     and o.programme_id = e.programme_id
     and o.term_id = e.term_id
    where e.id = new.enrolment_id and o.id = new.course_offering_id
  ) then
    raise exception 'Course offering does not match the student''s enrolment (session/programme/term)' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger student_subject_enrolments_check before insert or update on public.student_subject_enrolments
  for each row execute function public.check_subject_enrolment();

-- Promotion / transfer / withdrawal / graduation history.
create table public.student_status_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  event text not null check (event in ('admitted', 'promoted', 'repeated', 'transferred', 'withdrawn', 'graduated', 'suspended', 'reinstated', 'archived', 'programme_change')),
  from_enrolment_id uuid references public.student_enrolments (id) on delete set null,
  to_enrolment_id uuid references public.student_enrolments (id) on delete set null,
  effective_date date not null default current_date,
  reason text,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index student_status_history_student_idx on public.student_status_history (student_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Identity helpers for RLS
-- -----------------------------------------------------------------------------
create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.staff s
  join public.profiles p on p.id = s.profile_id
  where s.profile_id = (select auth.uid()) and p.is_active and s.status = 'active';
$$;

create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.students s
  join public.profiles p on p.id = s.profile_id
  where s.profile_id = (select auth.uid()) and p.is_active;
$$;

-- True when the caller teaches (or examines) the given offering.
create or replace function public.is_assigned_to_offering(p_offering_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teacher_assignments ta
    where ta.course_offering_id = p_offering_id
      and ta.staff_id = (select public.current_staff_id())
  );
$$;

-- True when the caller teaches a class the given student is enrolled in (any session).
create or replace function public.is_teacher_of_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teacher_assignments ta
    join public.student_subject_enrolments sse on sse.course_offering_id = ta.course_offering_id
    join public.student_enrolments e on e.id = sse.enrolment_id
    where ta.staff_id = (select public.current_staff_id())
      and e.student_id = p_student_id
  );
$$;

-- True when the caller teaches any offering in the given class.
create or replace function public.is_teacher_of_class(p_session_id uuid, p_programme_id uuid, p_term_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teacher_assignments ta
    join public.course_offerings o on o.id = ta.course_offering_id
    where ta.staff_id = (select public.current_staff_id())
      and o.academic_session_id = p_session_id
      and o.programme_id = p_programme_id
      and o.term_id = p_term_id
  );
$$;

grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.current_student_id() to authenticated;
grant execute on function public.is_assigned_to_offering(uuid) to authenticated;
grant execute on function public.is_teacher_of_student(uuid) to authenticated;
grant execute on function public.is_teacher_of_class(uuid, uuid, uuid) to authenticated;

-- Set-returning variants (evaluated once per query inside RLS: `col in (select ...)`).
create or replace function public.my_offering_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ta.course_offering_id from public.teacher_assignments ta
  where ta.staff_id = (select public.current_staff_id());
$$;

create or replace function public.my_taught_student_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct e.student_id
  from public.teacher_assignments ta
  join public.student_subject_enrolments sse on sse.course_offering_id = ta.course_offering_id
  join public.student_enrolments e on e.id = sse.enrolment_id
  where ta.staff_id = (select public.current_staff_id());
$$;
grant execute on function public.my_offering_ids() to authenticated;
grant execute on function public.my_taught_student_ids() to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.academic_sessions enable row level security;
alter table public.departments enable row level security;
alter table public.grading_schemes enable row level security;
alter table public.programmes enable row level security;
alter table public.programme_terms enable row level security;
alter table public.course_categories enable row level security;
alter table public.subjects enable row level security;
alter table public.course_offerings enable row level security;
alter table public.staff enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.staff_attendance enable row level security;
alter table public.students enable row level security;
alter table public.student_guardians enable row level security;
alter table public.student_enrolments enable row level security;
alter table public.student_subject_enrolments enable row level security;
alter table public.student_status_history enable row level security;

-- Reference data: readable by every signed-in user, managed by academics.manage.
do $$
declare t text;
begin
  foreach t in array array['academic_sessions', 'departments', 'programmes', 'programme_terms',
                           'course_categories', 'subjects', 'course_offerings'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (true)', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check ((select public.has_permission(''academics.manage'')))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using ((select public.has_permission(''academics.manage''))) with check ((select public.has_permission(''academics.manage'')))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using ((select public.has_permission(''academics.manage'')))', t);
  end loop;
end $$;

create policy grading_schemes_select on public.grading_schemes for select to authenticated using (true);
create policy grading_schemes_write on public.grading_schemes for all to authenticated
  using ((select public.has_permission('grading.manage'))) with check ((select public.has_permission('grading.manage')));

-- Staff: full rows for staff.view; own row for the staff member.
-- Teachers and students use public.staff_directory() for non-confidential fields.
create policy staff_select on public.staff for select to authenticated
  using ((select public.has_permission('staff.view')) or profile_id = (select auth.uid()));
create policy staff_insert on public.staff for insert to authenticated
  with check ((select public.has_permission('staff.manage')));
create policy staff_update on public.staff for update to authenticated
  using ((select public.has_permission('staff.manage'))) with check ((select public.has_permission('staff.manage')));

create policy teacher_assignments_select on public.teacher_assignments for select to authenticated
  using (true);
create policy teacher_assignments_write on public.teacher_assignments for all to authenticated
  using ((select public.has_permission('academics.manage')) or (select public.has_permission('staff.manage')))
  with check ((select public.has_permission('academics.manage')) or (select public.has_permission('staff.manage')));

create policy staff_attendance_select on public.staff_attendance for select to authenticated
  using ((select public.has_permission('staff.view')) or staff_id = (select public.current_staff_id()));
create policy staff_attendance_write on public.staff_attendance for all to authenticated
  using ((select public.has_permission('staff.manage'))) with check ((select public.has_permission('staff.manage')));

-- Students
create policy students_select on public.students for select to authenticated
  using (
    (select public.has_permission('students.view'))
    or profile_id = (select auth.uid())
    or id in (select public.my_taught_student_ids())
  );
create policy students_insert on public.students for insert to authenticated
  with check ((select public.has_permission('students.manage')));
create policy students_update on public.students for update to authenticated
  using ((select public.has_permission('students.manage'))) with check ((select public.has_permission('students.manage')));
-- No delete policy: students are archived, never deleted, to preserve history.

create policy student_guardians_select on public.student_guardians for select to authenticated
  using (
    (select public.has_permission('students.view'))
    or student_id = (select public.current_student_id())
    or student_id in (select public.my_taught_student_ids())
  );
create policy student_guardians_write on public.student_guardians for all to authenticated
  using ((select public.has_permission('students.manage'))) with check ((select public.has_permission('students.manage')));

create policy student_enrolments_select on public.student_enrolments for select to authenticated
  using (
    (select public.has_permission('students.view'))
    or student_id = (select public.current_student_id())
    or student_id in (select public.my_taught_student_ids())
  );
create policy student_enrolments_write on public.student_enrolments for all to authenticated
  using ((select public.has_permission('students.manage'))) with check ((select public.has_permission('students.manage')));

create policy student_subject_enrolments_select on public.student_subject_enrolments for select to authenticated
  using (
    (select public.has_permission('students.view'))
    or course_offering_id in (select public.my_offering_ids())
    or exists (select 1 from public.student_enrolments e
               where e.id = enrolment_id and e.student_id = (select public.current_student_id()))
  );
create policy student_subject_enrolments_write on public.student_subject_enrolments for all to authenticated
  using ((select public.has_permission('students.manage'))) with check ((select public.has_permission('students.manage')));

create policy student_status_history_select on public.student_status_history for select to authenticated
  using ((select public.has_permission('students.view')) or student_id = (select public.current_student_id()));
-- Written only by SECURITY DEFINER workflow functions.

-- Audit sensitive record changes.
create trigger audit_students after insert or update on public.students
  for each row execute function public.audit_row_change();
create trigger audit_staff after insert or update or delete on public.staff
  for each row execute function public.audit_row_change();
create trigger audit_teacher_assignments after insert or delete on public.teacher_assignments
  for each row execute function public.audit_row_change();
create trigger audit_student_enrolments after insert or update on public.student_enrolments
  for each row execute function public.audit_row_change();

-- -----------------------------------------------------------------------------
-- Staff directory (non-confidential fields) for all signed-in users.
-- -----------------------------------------------------------------------------
create or replace function public.staff_directory()
returns table (id uuid, full_name text, designation text, department text, email text, is_teaching boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.full_name, s.designation, d.name, s.email::text, s.is_teaching
  from public.staff s
  left join public.departments d on d.id = s.department_id
  where s.status = 'active' and (select auth.uid()) is not null
  order by s.full_name;
$$;
grant execute on function public.staff_directory() to authenticated;

-- -----------------------------------------------------------------------------
-- Workflow functions
-- -----------------------------------------------------------------------------

-- Generates the next admission number, e.g. DCC/2026/0007.
create or replace function public.generate_admission_no(p_year integer default extract(year from current_date)::integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_n bigint;
begin
  if not (select public.has_any_permission(array['students.manage', 'admissions.convert'])) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  select admission_no_prefix into v_prefix from public.institution_settings where id = 1;
  v_n := public.next_sequence_value('admission:' || p_year);
  return format('%s/%s/%s', v_prefix, p_year, lpad(v_n::text, 4, '0'));
end;
$$;
grant execute on function public.generate_admission_no(integer) to authenticated;

-- Creates a student with guardian and initial enrolment in one transaction.
-- Compulsory offerings are attached automatically; optional ones via p_offering_ids.
create or replace function public.create_student(p_student jsonb, p_guardian jsonb, p_enrolment jsonb, p_offering_ids uuid[] default '{}')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_enrolment_id uuid;
  v_admission_no text;
begin
  if not (select public.has_any_permission(array['students.manage', 'admissions.convert'])) then
    raise exception 'Not authorised to create students' using errcode = '42501';
  end if;

  v_admission_no := nullif(trim(p_student ->> 'admission_no'), '');
  if v_admission_no is null then
    v_admission_no := public.generate_admission_no(extract(year from coalesce((p_student ->> 'admission_date')::date, current_date))::integer);
  end if;

  insert into public.students (admission_no, university_roll_no, registration_no, full_name, date_of_birth,
    gender, phone, email, address, admission_date, scholarship_note, created_by)
  values (
    v_admission_no,
    nullif(trim(p_student ->> 'university_roll_no'), ''),
    nullif(trim(p_student ->> 'registration_no'), ''),
    trim(p_student ->> 'full_name'),
    (p_student ->> 'date_of_birth')::date,
    coalesce(nullif(p_student ->> 'gender', ''), 'undisclosed')::public.gender,
    nullif(trim(p_student ->> 'phone'), ''),
    nullif(trim(p_student ->> 'email'), ''),
    nullif(trim(p_student ->> 'address'), ''),
    coalesce((p_student ->> 'admission_date')::date, current_date),
    nullif(trim(p_student ->> 'scholarship_note'), ''),
    (select auth.uid())
  )
  returning id into v_student_id;

  if p_guardian is not null and nullif(trim(p_guardian ->> 'name'), '') is not null then
    insert into public.student_guardians (student_id, name, relationship, phone, email, address, is_primary)
    values (v_student_id, trim(p_guardian ->> 'name'), coalesce(nullif(trim(p_guardian ->> 'relationship'), ''), 'Guardian'),
      nullif(trim(p_guardian ->> 'phone'), ''), nullif(trim(p_guardian ->> 'email'), ''),
      nullif(trim(p_guardian ->> 'address'), ''), true);
  end if;

  insert into public.student_enrolments (student_id, academic_session_id, programme_id, term_id, roll_no, section, start_date)
  values (
    v_student_id,
    (p_enrolment ->> 'academic_session_id')::uuid,
    (p_enrolment ->> 'programme_id')::uuid,
    (p_enrolment ->> 'term_id')::uuid,
    nullif(trim(p_enrolment ->> 'roll_no'), ''),
    nullif(trim(p_enrolment ->> 'section'), ''),
    coalesce((p_student ->> 'admission_date')::date, current_date)
  )
  returning id into v_enrolment_id;

  insert into public.student_subject_enrolments (enrolment_id, course_offering_id)
  select v_enrolment_id, o.id
  from public.course_offerings o
  where o.academic_session_id = (p_enrolment ->> 'academic_session_id')::uuid
    and o.programme_id = (p_enrolment ->> 'programme_id')::uuid
    and o.term_id = (p_enrolment ->> 'term_id')::uuid
    and (o.is_compulsory or o.id = any (coalesce(p_offering_ids, '{}')))
  on conflict do nothing;

  insert into public.student_status_history (student_id, event, to_enrolment_id, reason, recorded_by)
  values (v_student_id, 'admitted', v_enrolment_id, 'Student record created', (select auth.uid()));

  return v_student_id;
end;
$$;
grant execute on function public.create_student(jsonb, jsonb, jsonb, uuid[]) to authenticated;

-- Promote (or repeat) students into the next term of a target session.
-- Historical enrolments are preserved; their status becomes promoted/repeated.
create or replace function public.promote_students(
  p_enrolment_ids uuid[],
  p_target_session_id uuid,
  p_action text default 'promote',   -- 'promote' | 'repeat' | 'graduate'
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_next_term uuid;
  v_new_id uuid;
  v_count integer := 0;
begin
  if not (select public.has_permission('students.promote')) then
    raise exception 'Not authorised to promote students' using errcode = '42501';
  end if;
  if p_action not in ('promote', 'repeat', 'graduate') then
    raise exception 'Invalid action %', p_action using errcode = '22023';
  end if;

  for r in
    select e.*, t.sequence, p.total_terms
    from public.student_enrolments e
    join public.programme_terms t on t.id = e.term_id
    join public.programmes p on p.id = e.programme_id
    where e.id = any (p_enrolment_ids) and e.status = 'active'
    for update of e
  loop
    if p_action = 'graduate' then
      update public.student_enrolments set status = 'completed', end_date = current_date where id = r.id;
      update public.students set status = 'graduated' where id = r.student_id;
      insert into public.student_status_history (student_id, event, from_enrolment_id, reason, recorded_by)
      values (r.student_id, 'graduated', r.id, p_reason, (select auth.uid()));
      v_count := v_count + 1;
      continue;
    end if;

    if p_action = 'promote' then
      if r.sequence >= r.total_terms then
        raise exception 'Student enrolment % is already in the final term; use graduate', r.id using errcode = 'P0001';
      end if;
      select id into v_next_term from public.programme_terms where programme_id = r.programme_id and sequence = r.sequence + 1;
    else
      v_next_term := r.term_id;
    end if;

    if v_next_term = r.term_id and p_target_session_id = r.academic_session_id then
      raise exception 'Repeating requires a different academic session' using errcode = 'P0001';
    end if;

    update public.student_enrolments
      set status = case when p_action = 'promote' then 'promoted'::public.enrolment_status else 'repeated'::public.enrolment_status end,
          end_date = current_date
      where id = r.id;

    insert into public.student_enrolments (student_id, academic_session_id, programme_id, term_id, roll_no, section)
    values (r.student_id, p_target_session_id, r.programme_id, v_next_term, null, r.section)
    returning id into v_new_id;

    insert into public.student_subject_enrolments (enrolment_id, course_offering_id)
    select v_new_id, o.id from public.course_offerings o
    where o.academic_session_id = p_target_session_id and o.programme_id = r.programme_id
      and o.term_id = v_next_term and o.is_compulsory
    on conflict do nothing;

    insert into public.student_status_history (student_id, event, from_enrolment_id, to_enrolment_id, reason, recorded_by)
    values (r.student_id, case when p_action = 'promote' then 'promoted' else 'repeated' end, r.id, v_new_id, p_reason, (select auth.uid()));
    v_count := v_count + 1;
  end loop;

  perform public.log_audit('students.' || p_action, 'student_enrolments', null,
    jsonb_build_object('count', v_count, 'target_session', p_target_session_id, 'enrolments', p_enrolment_ids));
  return v_count;
end;
$$;
grant execute on function public.promote_students(uuid[], uuid, text, text) to authenticated;

-- Change a student's status (withdraw / transfer / suspend / reinstate / archive).
create or replace function public.change_student_status(p_student_id uuid, p_event text, p_reason text, p_effective_date date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrolment uuid;
begin
  if not (select public.has_permission('students.manage')) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  select id into v_enrolment from public.student_enrolments where student_id = p_student_id and status = 'active';

  case p_event
    when 'withdrawn' then
      update public.students set status = 'withdrawn' where id = p_student_id;
      update public.student_enrolments set status = 'withdrawn', end_date = p_effective_date where id = v_enrolment;
    when 'transferred' then
      update public.students set status = 'transferred' where id = p_student_id;
      update public.student_enrolments set status = 'transferred', end_date = p_effective_date where id = v_enrolment;
    when 'suspended' then
      update public.students set status = 'suspended' where id = p_student_id;
    when 'reinstated' then
      update public.students set status = 'active', archived_at = null where id = p_student_id;
    when 'archived' then
      update public.students set status = 'archived', archived_at = now() where id = p_student_id;
      update public.student_enrolments set status = 'withdrawn', end_date = p_effective_date where id = v_enrolment;
    else
      raise exception 'Invalid status event %', p_event using errcode = '22023';
  end case;

  insert into public.student_status_history (student_id, event, from_enrolment_id, effective_date, reason, recorded_by)
  values (p_student_id, p_event, v_enrolment, p_effective_date, p_reason, (select auth.uid()));
end;
$$;
grant execute on function public.change_student_status(uuid, text, text, date) to authenticated;
