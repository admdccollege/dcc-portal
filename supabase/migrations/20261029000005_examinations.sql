-- =============================================================================
-- DCC Portal — Examinations, marks, grading and results
-- =============================================================================
-- Workflow (examinations.status):
--   draft → scheduled → marks_entry → marks_locked → results_processed
--         → results_approved → published
-- * Marks are written only through save_marks() (validation, deadlines, audit).
-- * Locking requires every candidate to have a mark or an explicit status
--   (absent/exempted/...). Missing marks are never treated as zero.
-- * Results are computed only in the database (compute_exam_results) from the
--   configured grading scheme, so stored results always match stored marks.
-- * Publication requires approval and re-validates completeness.
-- * Results are stored (snapshotted) deliberately: a published result must
--   remain stable even if grading rules are edited later.
-- =============================================================================

create type public.exam_status as enum
  ('draft', 'scheduled', 'marks_entry', 'marks_locked', 'results_processed', 'results_approved', 'published');
create type public.exam_component as enum ('theory', 'practical', 'internal', 'combined');
create type public.mark_status as enum ('present', 'absent', 'exempted', 'malpractice', 'withheld');
create type public.result_status as enum ('pass', 'fail', 'compartment', 'absent', 'withheld', 'incomplete');

create table public.examination_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_supplementary boolean not null default false,
  sort_order smallint not null default 0,
  is_active boolean not null default true
);

create table public.grading_rules (
  id uuid primary key default gen_random_uuid(),
  grading_scheme_id uuid not null references public.grading_schemes (id) on delete cascade,
  grade text not null,
  min_percent numeric(5,2) not null check (min_percent between 0 and 100),
  grade_point numeric(4,2),
  is_pass boolean not null default true,
  description text,
  unique (grading_scheme_id, grade),
  unique (grading_scheme_id, min_percent)
);

create table public.examinations (
  id uuid primary key default gen_random_uuid(),
  academic_session_id uuid not null references public.academic_sessions (id) on delete restrict,
  programme_id uuid not null references public.programmes (id) on delete restrict,
  term_id uuid not null references public.programme_terms (id) on delete restrict,
  examination_type_id uuid not null references public.examination_types (id) on delete restrict,
  grading_scheme_id uuid not null references public.grading_schemes (id) on delete restrict,
  name text not null,
  start_date date,
  end_date date,
  marks_entry_deadline timestamptz,
  candidate_mode text not null default 'all_enrolled' check (candidate_mode in ('all_enrolled', 'selected')),
  is_provisional boolean not null default true,
  status public.exam_status not null default 'draft',
  locked_by uuid references public.profiles (id) on delete set null,
  locked_at timestamptz,
  processed_by uuid references public.profiles (id) on delete set null,
  processed_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index examinations_class_idx on public.examinations (academic_session_id, programme_id, term_id);
create trigger examinations_updated_at before update on public.examinations
  for each row execute function public.set_updated_at();

create table public.examination_subjects (
  id uuid primary key default gen_random_uuid(),
  examination_id uuid not null references public.examinations (id) on delete cascade,
  course_offering_id uuid not null references public.course_offerings (id) on delete restrict,
  component public.exam_component not null default 'theory',
  max_marks numeric(6,2) not null check (max_marks > 0),
  pass_marks numeric(6,2) check (pass_marks >= 0),
  exam_date date,
  start_time time,
  duration_minutes integer check (duration_minutes > 0),
  examiner_staff_id uuid references public.staff (id) on delete set null,
  marks_deadline timestamptz,
  created_at timestamptz not null default now(),
  unique (examination_id, course_offering_id, component),
  check (pass_marks is null or pass_marks <= max_marks)
);
create index examination_subjects_offering_idx on public.examination_subjects (course_offering_id);

-- Explicit candidates for supplementary / improvement examinations.
create table public.examination_candidates (
  examination_id uuid not null references public.examinations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  course_offering_id uuid not null references public.course_offerings (id) on delete restrict,
  source_result_id uuid,
  created_at timestamptz not null default now(),
  primary key (examination_id, student_id, course_offering_id)
);

create table public.marks (
  id uuid primary key default gen_random_uuid(),
  examination_subject_id uuid not null references public.examination_subjects (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  marks_obtained numeric(6,2),
  status public.mark_status not null default 'present',
  entered_by uuid references public.profiles (id) on delete set null,
  entered_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  revision integer not null default 0,
  unique (examination_subject_id, student_id),
  check ((status = 'present') = (marks_obtained is not null)),
  check (marks_obtained is null or marks_obtained >= 0)
);
create index marks_student_idx on public.marks (student_id);

create table public.mark_revisions (
  id bigint generated always as identity primary key,
  mark_id uuid,
  examination_subject_id uuid not null references public.examination_subjects (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  old_marks numeric(6,2),
  new_marks numeric(6,2),
  old_status public.mark_status,
  new_status public.mark_status,
  reason text,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index mark_revisions_subject_idx on public.mark_revisions (examination_subject_id, student_id);

create table public.results (
  id uuid primary key default gen_random_uuid(),
  examination_id uuid not null references public.examinations (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  enrolment_id uuid not null references public.student_enrolments (id) on delete restrict,
  total_max numeric(8,2),
  total_obtained numeric(8,2),
  percentage numeric(6,2),
  grade text,
  grade_point numeric(4,2),
  credits_earned numeric(6,1),
  failed_subjects integer not null default 0,
  status public.result_status not null,
  remarks text,
  verification_code text not null unique,
  computed_at timestamptz not null default now(),
  computed_by uuid references public.profiles (id) on delete set null,
  unique (examination_id, student_id)
);
create index results_student_idx on public.results (student_id);

alter table public.examination_candidates
  add constraint examination_candidates_source_fk foreign key (source_result_id) references public.results (id) on delete set null;

create table public.result_subjects (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.results (id) on delete cascade,
  course_offering_id uuid not null references public.course_offerings (id) on delete restrict,
  subject_code text not null,
  subject_name text not null,
  category text,
  credits numeric(4,1),
  max_marks numeric(7,2),
  marks_obtained numeric(7,2),
  percentage numeric(6,2),
  grade text,
  grade_point numeric(4,2),
  is_pass boolean,
  status text not null,              -- 'pass' | 'fail' | 'absent' | 'exempted' | 'withheld' | 'incomplete'
  components jsonb not null default '[]'::jsonb,
  unique (result_id, course_offering_id)
);

-- -----------------------------------------------------------------------------
-- Integrity triggers
-- -----------------------------------------------------------------------------
create or replace function public.check_exam_subject()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_exam public.examinations;
begin
  select * into v_exam from public.examinations where id = new.examination_id;
  if not exists (select 1 from public.course_offerings o where o.id = new.course_offering_id
      and o.academic_session_id = v_exam.academic_session_id and o.programme_id = v_exam.programme_id
      and o.term_id = v_exam.term_id) then
    raise exception 'Subject offering does not belong to the examination''s class' using errcode = '23514';
  end if;
  if v_exam.status not in ('draft', 'scheduled', 'marks_entry') then
    raise exception 'Examination subjects cannot be changed after marks are locked' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and (new.max_marks <> old.max_marks or new.pass_marks is distinct from old.pass_marks)
     and exists (select 1 from public.marks m where m.examination_subject_id = new.id) then
    if exists (select 1 from public.marks m where m.examination_subject_id = new.id and m.marks_obtained > new.max_marks) then
      raise exception 'Existing marks exceed the new maximum marks' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger examination_subjects_check before insert or update on public.examination_subjects
  for each row execute function public.check_exam_subject();

create or replace function public.prevent_exam_subject_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.marks m where m.examination_subject_id = old.id) then
    raise exception 'Cannot remove a subject that already has marks' using errcode = 'P0001';
  end if;
  return old;
end;
$$;
create trigger examination_subjects_no_delete before delete on public.examination_subjects
  for each row execute function public.prevent_exam_subject_delete();

create or replace function public.check_exam_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' and current_setting('dcc.allow_exam_status_change', true) is distinct from 'on' then
    raise exception 'A published examination cannot be modified' using errcode = 'P0001';
  end if;
  if new.status is distinct from old.status and current_setting('dcc.allow_exam_status_change', true) is distinct from 'on' then
    raise exception 'Examination status can only be changed through the workflow functions' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger examinations_check_update before update on public.examinations
  for each row execute function public.check_exam_update();

-- Marks may never be edited directly once the exam is locked (defence in depth).
create or replace function public.check_marks_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.exam_status;
  v_max numeric;
begin
  select e.status, es.max_marks into v_status, v_max
  from public.examination_subjects es join public.examinations e on e.id = es.examination_id
  where es.id = coalesce(new.examination_subject_id, old.examination_subject_id);
  if v_status <> 'marks_entry' then
    raise exception 'Marks can only be changed while the examination is open for marks entry (current: %)', v_status
      using errcode = 'P0001';
  end if;
  if tg_op <> 'DELETE' and new.marks_obtained is not null and new.marks_obtained > v_max then
    raise exception 'Marks % exceed the maximum of %', new.marks_obtained, v_max using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger marks_check_write before insert or update or delete on public.marks
  for each row execute function public.check_marks_write();

create or replace function public.prevent_published_result_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_exam uuid;
begin
  if tg_table_name = 'results' then
    v_exam := coalesce(old.examination_id, new.examination_id);
  else
    select r.examination_id into v_exam from public.results r where r.id = coalesce(old.result_id, new.result_id);
  end if;
  if exists (select 1 from public.examinations e where e.id = v_exam and e.status in ('results_approved', 'published')) then
    raise exception 'Approved or published results cannot be modified' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger results_immutable before update or delete on public.results
  for each row execute function public.prevent_published_result_change();
create trigger result_subjects_immutable before update or delete on public.result_subjects
  for each row execute function public.prevent_published_result_change();

-- -----------------------------------------------------------------------------
-- Candidate pairs (student × subject offering) for an examination
-- -----------------------------------------------------------------------------
create or replace function public.exam_candidate_pairs(p_exam_id uuid)
returns table (student_id uuid, enrolment_id uuid, course_offering_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with ex as (select * from public.examinations where id = p_exam_id)
  select e.student_id, e.id, sse.course_offering_id
  from ex
  join public.student_enrolments e
    on e.academic_session_id = ex.academic_session_id and e.programme_id = ex.programme_id and e.term_id = ex.term_id
   and e.status in ('active', 'promoted', 'repeated', 'completed')
  join public.student_subject_enrolments sse on sse.enrolment_id = e.id
  where exists (select 1 from public.examination_subjects es
                where es.examination_id = ex.id and es.course_offering_id = sse.course_offering_id)
    and (ex.candidate_mode = 'all_enrolled'
         or exists (select 1 from public.examination_candidates c
                    where c.examination_id = ex.id and c.student_id = e.student_id
                      and c.course_offering_id = sse.course_offering_id));
$$;
revoke execute on function public.exam_candidate_pairs(uuid) from public, anon, authenticated;

-- Missing marks: candidate × component with no mark row.
create or replace function public.exam_missing_marks(p_exam_id uuid)
returns table (examination_subject_id uuid, student_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select es.id, cp.student_id
  from public.exam_candidate_pairs(p_exam_id) cp
  join public.examination_subjects es on es.examination_id = p_exam_id and es.course_offering_id = cp.course_offering_id
  where not exists (select 1 from public.marks m where m.examination_subject_id = es.id and m.student_id = cp.student_id);
$$;
revoke execute on function public.exam_missing_marks(uuid) from public, anon, authenticated;

-- Marks-entry progress per subject component (visible to exam staff and assigned teachers).
create or replace function public.exam_marks_progress(p_exam_id uuid)
returns table (examination_subject_id uuid, candidates bigint, entered bigint, missing bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not ((select public.has_any_permission(array['exams.view', 'marks.enter_all', 'results.view']))
          or exists (select 1 from public.examination_subjects es where es.examination_id = p_exam_id
                     and (public.is_assigned_to_offering(es.course_offering_id) or es.examiner_staff_id = (select public.current_staff_id())))) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  return query
  select es.id,
         count(cp.student_id),
         count(m.id),
         count(cp.student_id) - count(m.id)
  from public.examination_subjects es
  left join public.exam_candidate_pairs(p_exam_id) cp on cp.course_offering_id = es.course_offering_id
  left join public.marks m on m.examination_subject_id = es.id and m.student_id = cp.student_id
  where es.examination_id = p_exam_id
  group by es.id;
end;
$$;
grant execute on function public.exam_marks_progress(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS helpers
-- -----------------------------------------------------------------------------
create or replace function public.is_student_in_class(p_session_id uuid, p_programme_id uuid, p_term_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.student_enrolments e
    where e.student_id = (select public.current_student_id())
      and e.academic_session_id = p_session_id and e.programme_id = p_programme_id and e.term_id = p_term_id
  );
$$;
grant execute on function public.is_student_in_class(uuid, uuid, uuid) to authenticated;

create or replace function public.can_view_exam(p_exam_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.examinations ex
    where ex.id = p_exam_id
      and (
        (select public.has_any_permission(array['exams.view', 'results.view']))
        or exists (select 1 from public.examination_subjects es where es.examination_id = ex.id
                   and (public.is_assigned_to_offering(es.course_offering_id) or es.examiner_staff_id = (select public.current_staff_id())))
        or (ex.status <> 'draft' and public.is_student_in_class(ex.academic_session_id, ex.programme_id, ex.term_id))
      )
  );
$$;
grant execute on function public.can_view_exam(uuid) to authenticated;

create or replace function public.can_enter_marks(p_exam_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.has_permission('marks.enter_all'))
      or ((select public.has_permission('marks.enter')) and exists (
            select 1 from public.examination_subjects es
            where es.id = p_exam_subject_id
              and (public.is_assigned_to_offering(es.course_offering_id) or es.examiner_staff_id = (select public.current_staff_id()))));
$$;
grant execute on function public.can_enter_marks(uuid) to authenticated;

create or replace function public.my_markable_exam_subject_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select es.id from public.examination_subjects es
  where (select public.has_permission('marks.enter'))
    and (es.course_offering_id in (select public.my_offering_ids())
         or es.examiner_staff_id = (select public.current_staff_id()));
$$;
grant execute on function public.my_markable_exam_subject_ids() to authenticated;

create or replace function public.is_exam_published(p_exam_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.examinations where id = p_exam_id and status = 'published');
$$;
grant execute on function public.is_exam_published(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.examination_types enable row level security;
alter table public.grading_rules enable row level security;
alter table public.examinations enable row level security;
alter table public.examination_subjects enable row level security;
alter table public.examination_candidates enable row level security;
alter table public.marks enable row level security;
alter table public.mark_revisions enable row level security;
alter table public.results enable row level security;
alter table public.result_subjects enable row level security;

create policy examination_types_select on public.examination_types for select to authenticated using (true);
create policy examination_types_write on public.examination_types for all to authenticated
  using ((select public.has_permission('exams.manage'))) with check ((select public.has_permission('exams.manage')));

create policy grading_rules_select on public.grading_rules for select to authenticated using (true);
create policy grading_rules_write on public.grading_rules for all to authenticated
  using ((select public.has_permission('grading.manage'))) with check ((select public.has_permission('grading.manage')));

-- The permission check comes first and does not depend on the row, so INSERT ... RETURNING
-- works (can_view_exam() cannot see a row inserted in the same statement).
create policy examinations_select on public.examinations for select to authenticated
  using ((select public.has_any_permission(array['exams.view', 'results.view'])) or public.can_view_exam(id));
create policy examinations_insert on public.examinations for insert to authenticated
  with check ((select public.has_permission('exams.manage')) and status = 'draft');
create policy examinations_update on public.examinations for update to authenticated
  using ((select public.has_permission('exams.manage')) and status in ('draft', 'scheduled', 'marks_entry'))
  with check ((select public.has_permission('exams.manage')));
create policy examinations_delete on public.examinations for delete to authenticated
  using ((select public.has_permission('exams.manage')) and status = 'draft');
revoke update on public.examinations from authenticated;
grant update (name, examination_type_id, grading_scheme_id, start_date, end_date, marks_entry_deadline,
  candidate_mode, is_provisional) on public.examinations to authenticated;

create policy examination_subjects_select on public.examination_subjects for select to authenticated
  using (public.can_view_exam(examination_id));
create policy examination_subjects_write on public.examination_subjects for all to authenticated
  using ((select public.has_permission('exams.manage'))) with check ((select public.has_permission('exams.manage')));

create policy examination_candidates_select on public.examination_candidates for select to authenticated
  using ((select public.has_any_permission(array['exams.view', 'results.view'])) or student_id = (select public.current_student_id()));
create policy examination_candidates_write on public.examination_candidates for all to authenticated
  using ((select public.has_permission('exams.manage'))) with check ((select public.has_permission('exams.manage')));

create policy marks_select on public.marks for select to authenticated
  using (
    (select public.has_any_permission(array['marks.enter_all', 'results.view', 'exams.view']))
    or examination_subject_id in (select public.my_markable_exam_subject_ids())
    or (student_id = (select public.current_student_id()) and exists (
          select 1 from public.examination_subjects es
          where es.id = examination_subject_id and public.is_exam_published(es.examination_id)))
  );
-- No write policies: save_marks() is the only write path.

create policy mark_revisions_select on public.mark_revisions for select to authenticated
  using ((select public.has_any_permission(array['marks.enter_all', 'results.view', 'audit.view']))
         or examination_subject_id in (select public.my_markable_exam_subject_ids()));

create policy results_select on public.results for select to authenticated
  using (
    (select public.has_permission('results.view'))
    or (student_id = (select public.current_student_id()) and public.is_exam_published(examination_id))
  );
create policy result_subjects_select on public.result_subjects for select to authenticated
  using (exists (select 1 from public.results r where r.id = result_id));  -- inherits results RLS

-- -----------------------------------------------------------------------------
-- Marks entry
-- -----------------------------------------------------------------------------
-- p_entries = [{"student_id": "...", "marks": 45.5, "status": "present"}, ...]
-- An entry with status 'present' and marks null clears an existing mark.
create or replace function public.save_marks(p_exam_subject_id uuid, p_entries jsonb, p_reason text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_es public.examination_subjects;
  v_exam public.examinations;
  v_deadline timestamptz;
  v_after_deadline boolean;
  v_bad integer;
  v_changed integer := 0;
  e record;
  v_existing public.marks;
  v_status public.mark_status;
  v_marks numeric;
begin
  select * into v_es from public.examination_subjects where id = p_exam_subject_id;
  if v_es.id is null then
    raise exception 'Examination subject not found' using errcode = 'P0002';
  end if;
  select * into v_exam from public.examinations where id = v_es.examination_id for share;

  if not public.can_enter_marks(p_exam_subject_id) then
    raise exception 'You are not authorised to enter marks for this subject' using errcode = '42501';
  end if;
  if v_exam.status <> 'marks_entry' then
    raise exception 'Marks entry is not open for this examination (status: %)', v_exam.status using errcode = 'P0001';
  end if;

  v_deadline := coalesce(v_es.marks_deadline, v_exam.marks_entry_deadline);
  v_after_deadline := v_deadline is not null and now() > v_deadline;
  if v_after_deadline then
    if not (select public.has_permission('marks.correct')) then
      raise exception 'The marks entry deadline has passed. Contact the Examination Controller for corrections.' using errcode = '42501';
    end if;
    if nullif(trim(p_reason), '') is null then
      raise exception 'A reason is required for corrections after the deadline' using errcode = '22023';
    end if;
  end if;

  if jsonb_typeof(p_entries) <> 'array' then
    raise exception 'Entries must be an array' using errcode = '22023';
  end if;

  select count(*) - count(distinct x ->> 'student_id') into v_bad from jsonb_array_elements(p_entries) x;
  if v_bad > 0 then
    raise exception 'Duplicate students in marks submission' using errcode = '23505';
  end if;

  -- Every student must be a candidate for this subject
  select count(*) into v_bad
  from jsonb_array_elements(p_entries) x
  where not exists (select 1 from public.exam_candidate_pairs(v_exam.id) cp
                    where cp.student_id = (x ->> 'student_id')::uuid and cp.course_offering_id = v_es.course_offering_id);
  if v_bad > 0 then
    raise exception '% student(s) are not candidates for this subject', v_bad using errcode = '23514';
  end if;

  for e in select j.value as x from jsonb_array_elements(p_entries) j loop
    v_status := coalesce(nullif(e.x ->> 'status', ''), 'present')::public.mark_status;
    if e.x ? 'marks' and jsonb_typeof(e.x -> 'marks') not in ('number', 'null') then
      raise exception 'Marks must be numeric' using errcode = '22023';
    end if;
    v_marks := (e.x ->> 'marks')::numeric;

    if v_status = 'present' and v_marks is not null then
      if v_marks < 0 or v_marks > v_es.max_marks then
        raise exception 'Marks % for a student are outside 0–%', v_marks, v_es.max_marks using errcode = '23514';
      end if;
      if v_marks <> round(v_marks, 2) then
        raise exception 'Marks may have at most two decimal places' using errcode = '22023';
      end if;
    elsif v_status <> 'present' then
      v_marks := null;  -- non-present statuses never carry marks
    end if;

    select * into v_existing from public.marks
      where examination_subject_id = p_exam_subject_id and student_id = (e.x ->> 'student_id')::uuid
      for update;

    if v_existing.id is null then
      if v_status = 'present' and v_marks is null then
        continue;  -- nothing to save
      end if;
      insert into public.marks (examination_subject_id, student_id, marks_obtained, status, entered_by, updated_by)
      values (p_exam_subject_id, (e.x ->> 'student_id')::uuid, v_marks, v_status, (select auth.uid()), (select auth.uid()))
      returning * into v_existing;
      insert into public.mark_revisions (mark_id, examination_subject_id, student_id, old_marks, new_marks, old_status, new_status, reason, changed_by)
      values (v_existing.id, p_exam_subject_id, v_existing.student_id, null, v_marks, null, v_status, nullif(trim(p_reason), ''), (select auth.uid()));
      v_changed := v_changed + 1;
    elsif v_status = 'present' and v_marks is null then
      delete from public.marks where id = v_existing.id;
      insert into public.mark_revisions (mark_id, examination_subject_id, student_id, old_marks, new_marks, old_status, new_status, reason, changed_by)
      values (v_existing.id, p_exam_subject_id, v_existing.student_id, v_existing.marks_obtained, null, v_existing.status, null,
              coalesce(nullif(trim(p_reason), ''), 'cleared'), (select auth.uid()));
      v_changed := v_changed + 1;
    elsif v_existing.marks_obtained is distinct from v_marks or v_existing.status <> v_status then
      update public.marks
        set marks_obtained = v_marks, status = v_status, updated_by = (select auth.uid()), updated_at = now(),
            revision = revision + 1
        where id = v_existing.id;
      insert into public.mark_revisions (mark_id, examination_subject_id, student_id, old_marks, new_marks, old_status, new_status, reason, changed_by)
      values (v_existing.id, p_exam_subject_id, v_existing.student_id, v_existing.marks_obtained, v_marks, v_existing.status, v_status,
              nullif(trim(p_reason), ''), (select auth.uid()));
      v_changed := v_changed + 1;
    end if;
  end loop;

  if v_after_deadline and v_changed > 0 then
    perform public.log_audit('marks.correct', 'examination_subjects', p_exam_subject_id::text,
      jsonb_build_object('changed', v_changed, 'reason', p_reason));
  end if;
  return v_changed;
end;
$$;
grant execute on function public.save_marks(uuid, jsonb, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Result computation
-- -----------------------------------------------------------------------------
create or replace function public.grade_for(p_scheme_id uuid, p_percent numeric, p_pass boolean)
returns table (grade text, grade_point numeric)
language sql
stable
set search_path = ''
as $$
  select r.grade, r.grade_point
  from public.grading_rules r
  where r.grading_scheme_id = p_scheme_id
    and (
      (p_pass and r.min_percent <= p_percent and r.is_pass)
      or (not p_pass and not r.is_pass)
    )
  order by case when p_pass then r.min_percent end desc nulls last,
           case when not p_pass then r.min_percent end asc nulls last
  limit 1;
$$;
grant execute on function public.grade_for(uuid, numeric, boolean) to authenticated;

create or replace function public.compute_exam_results(p_exam_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam public.examinations;
  v_scheme public.grading_schemes;
  v_missing integer;
  v_count integer := 0;
  st record;
  sub record;
  v_result_id uuid;
  v_sub_rows jsonb;
  -- per-subject
  s_max numeric; s_obt numeric; s_pct numeric; s_pass boolean; s_status text;
  s_comp_ok boolean; s_threshold numeric; s_grade text; s_gp numeric; s_components jsonb;
  s_any_present boolean; s_all_exempt boolean; s_withheld boolean; s_incomplete boolean;
  -- per-student
  t_max numeric; t_obt numeric; t_pct numeric; t_failed integer; t_status public.result_status;
  t_grade text; t_gp numeric; t_withheld boolean; t_incomplete boolean; t_any_present boolean; t_counted integer;
  t_gp_sum numeric; t_credit_sum numeric; t_gp_n integer; t_credits_earned numeric;
  c record;
begin
  if not (select public.has_permission('results.process')) then
    raise exception 'Not authorised to process results' using errcode = '42501';
  end if;
  select * into v_exam from public.examinations where id = p_exam_id for update;
  if v_exam.id is null then
    raise exception 'Examination not found' using errcode = 'P0002';
  end if;
  if v_exam.status not in ('marks_locked', 'results_processed') then
    raise exception 'Marks must be locked before results can be processed (status: %)', v_exam.status using errcode = 'P0001';
  end if;
  select * into v_scheme from public.grading_schemes where id = v_exam.grading_scheme_id;

  select count(*) into v_missing from public.exam_missing_marks(p_exam_id);
  if v_missing > 0 then
    raise exception 'Cannot process results: % mark(s) are missing', v_missing using errcode = 'P0001';
  end if;

  delete from public.results where examination_id = p_exam_id;

  for st in
    select distinct cp.student_id, cp.enrolment_id from public.exam_candidate_pairs(p_exam_id) cp
  loop
    t_max := 0; t_obt := 0; t_failed := 0; t_withheld := false; t_incomplete := false; t_any_present := false;
    t_counted := 0; t_gp_sum := 0; t_credit_sum := 0; t_gp_n := 0; t_credits_earned := 0;
    v_sub_rows := '[]'::jsonb;

    for sub in
      select cp.course_offering_id, s.code, s.name, cc.name as category,
             coalesce(o.credits, s.credits) as credits
      from public.exam_candidate_pairs(p_exam_id) cp
      join public.course_offerings o on o.id = cp.course_offering_id
      join public.subjects s on s.id = o.subject_id
      left join public.course_categories cc on cc.id = o.category_id
      where cp.student_id = st.student_id
      order by s.code
    loop
      s_max := 0; s_obt := 0; s_comp_ok := true; s_threshold := 0; s_components := '[]'::jsonb;
      s_any_present := false; s_all_exempt := true; s_withheld := false; s_incomplete := false;

      for c in
        select es.component, es.max_marks, es.pass_marks, m.marks_obtained, m.status, (m.id is null) as missing
        from public.examination_subjects es
        left join public.marks m on m.examination_subject_id = es.id and m.student_id = st.student_id
        where es.examination_id = p_exam_id and es.course_offering_id = sub.course_offering_id
        order by es.component
      loop
        s_components := s_components || jsonb_build_object(
          'component', c.component, 'max', c.max_marks, 'pass', c.pass_marks,
          'obtained', c.marks_obtained, 'status', case when c.missing then 'missing' else c.status::text end);
        if c.missing then
          s_incomplete := true;
          continue;
        end if;
        if c.status = 'exempted' then
          continue;
        end if;
        s_all_exempt := false;
        if c.status in ('malpractice', 'withheld') then
          s_withheld := true;
        end if;
        s_max := s_max + c.max_marks;
        s_threshold := s_threshold + coalesce(c.pass_marks, 0);
        if c.status = 'present' then
          s_any_present := true;
          s_obt := s_obt + c.marks_obtained;
          if c.pass_marks is not null and c.marks_obtained < c.pass_marks then
            s_comp_ok := false;
          end if;
        else
          s_comp_ok := false;  -- absent / withheld component cannot be passed
        end if;
      end loop;

      if s_incomplete then
        s_status := 'incomplete'; s_pass := null; s_pct := null; s_grade := null; s_gp := null;
        t_incomplete := true;
      elsif s_all_exempt then
        s_status := 'exempted'; s_pass := null; s_pct := null; s_grade := null; s_gp := null;
        s_max := null; s_obt := null;
      else
        s_pct := round(100.0 * s_obt / s_max, v_scheme.decimals);
        if s_withheld then
          s_status := 'withheld'; s_pass := false; t_withheld := true;
        else
          s_pass := (not v_scheme.require_component_pass or s_comp_ok)
                    and (case when v_scheme.subject_pass_percent is not null then s_pct >= v_scheme.subject_pass_percent
                              else s_obt >= s_threshold end);
          s_status := case when not s_any_present then 'absent' when s_pass then 'pass' else 'fail' end;
          if not s_any_present then s_pass := false; end if;
        end if;
        select g.grade, g.grade_point into s_grade, s_gp from public.grade_for(v_scheme.id, s_pct, coalesce(s_pass, false)) g;
        if not s_pass then t_failed := t_failed + 1; end if;
        if s_any_present then t_any_present := true; end if;
        t_max := t_max + s_max; t_obt := t_obt + s_obt; t_counted := t_counted + 1;
        if s_gp is not null then
          t_gp_n := t_gp_n + 1;
          if sub.credits is not null and sub.credits > 0 then
            t_gp_sum := t_gp_sum + s_gp * sub.credits; t_credit_sum := t_credit_sum + sub.credits;
          end if;
        end if;
        if s_pass and sub.credits is not null then t_credits_earned := t_credits_earned + sub.credits; end if;
      end if;

      v_sub_rows := v_sub_rows || jsonb_build_object(
        'course_offering_id', sub.course_offering_id, 'code', sub.code, 'name', sub.name, 'category', sub.category,
        'credits', sub.credits, 'max', s_max, 'obtained', s_obt, 'pct', s_pct, 'grade', s_grade, 'gp', s_gp,
        'pass', s_pass, 'status', s_status, 'components', s_components);
    end loop;

    if t_counted > 0 then
      t_pct := round(100.0 * t_obt / t_max, v_scheme.decimals);
    else
      t_pct := null;
    end if;

    if t_incomplete then
      t_status := 'incomplete';
    elsif t_withheld then
      t_status := 'withheld';
    elsif t_counted > 0 and not t_any_present then
      t_status := 'absent';
    elsif t_counted = 0 then
      t_status := 'incomplete';  -- all subjects exempted: no basis for a result
    elsif (t_failed = 0 or not v_scheme.require_all_subjects_pass)
          and (v_scheme.aggregate_pass_percent is null or t_pct >= v_scheme.aggregate_pass_percent) then
      t_status := 'pass';
    elsif t_failed between 1 and v_scheme.max_failed_subjects_for_compartment
          and (v_scheme.aggregate_pass_percent is null or t_pct >= v_scheme.aggregate_pass_percent) then
      t_status := 'compartment';
    else
      t_status := 'fail';
    end if;

    t_grade := null; t_gp := null;
    if t_pct is not null and t_status in ('pass', 'fail', 'compartment') then
      select g.grade into t_grade from public.grade_for(v_scheme.id, t_pct, t_status = 'pass') g;
      if v_scheme.use_grade_points then
        if v_scheme.use_credits and t_credit_sum > 0 then
          t_gp := round(t_gp_sum / t_credit_sum, 2);
        elsif t_gp_n > 0 then
          select round(avg((x ->> 'gp')::numeric), 2) into t_gp
          from jsonb_array_elements(v_sub_rows) x where x ->> 'gp' is not null;
        end if;
      end if;
    end if;

    insert into public.results (examination_id, student_id, enrolment_id, total_max, total_obtained, percentage, grade,
      grade_point, credits_earned, failed_subjects, status, verification_code, computed_by)
    values (p_exam_id, st.student_id, st.enrolment_id,
      case when t_counted > 0 then t_max end, case when t_counted > 0 then t_obt end,
      case when t_status = 'incomplete' then null else t_pct end,
      t_grade, t_gp, case when v_scheme.use_credits then t_credits_earned end, t_failed, t_status,
      upper(encode(extensions.gen_random_bytes(6), 'hex')), (select auth.uid()))
    returning id into v_result_id;

    insert into public.result_subjects (result_id, course_offering_id, subject_code, subject_name, category, credits,
      max_marks, marks_obtained, percentage, grade, grade_point, is_pass, status, components)
    select v_result_id, (x ->> 'course_offering_id')::uuid, x ->> 'code', x ->> 'name', x ->> 'category',
      (x ->> 'credits')::numeric, (x ->> 'max')::numeric, (x ->> 'obtained')::numeric, (x ->> 'pct')::numeric,
      x ->> 'grade', (x ->> 'gp')::numeric, (x ->> 'pass')::boolean, x ->> 'status', x -> 'components'
    from jsonb_array_elements(v_sub_rows) x;

    v_count := v_count + 1;
  end loop;

  perform set_config('dcc.allow_exam_status_change', 'on', true);
  update public.examinations
    set status = 'results_processed', processed_by = (select auth.uid()), processed_at = now(),
        approved_by = null, approved_at = null
    where id = p_exam_id;
  perform set_config('dcc.allow_exam_status_change', 'off', true);

  perform public.log_audit('results.process', 'examinations', p_exam_id::text, jsonb_build_object('results', v_count));
  return v_count;
end;
$$;
grant execute on function public.compute_exam_results(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Examination workflow transitions
-- -----------------------------------------------------------------------------
create or replace function public.transition_examination(p_exam_id uuid, p_to public.exam_status, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam public.examinations;
  v_n integer;
begin
  if not (select public.has_any_permission(array['exams.manage', 'marks.lock', 'results.approve', 'results.publish', 'results.unpublish'])) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  select * into v_exam from public.examinations where id = p_exam_id for update;
  if v_exam.id is null then
    raise exception 'Examination not found' using errcode = 'P0002';
  end if;

  if p_to = 'scheduled' then
    if not (select public.has_permission('exams.manage')) then raise exception 'Not authorised' using errcode = '42501'; end if;
    if v_exam.status not in ('draft', 'marks_entry') then
      raise exception 'Cannot schedule from status %', v_exam.status using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.examination_subjects where examination_id = p_exam_id) then
      raise exception 'Add at least one subject before scheduling' using errcode = 'P0001';
    end if;

  elsif p_to = 'marks_entry' then
    if v_exam.status in ('draft', 'scheduled') then
      if not (select public.has_permission('exams.manage')) then raise exception 'Not authorised' using errcode = '42501'; end if;
      if not exists (select 1 from public.examination_subjects where examination_id = p_exam_id) then
        raise exception 'Add at least one subject before opening marks entry' using errcode = 'P0001';
      end if;
    elsif v_exam.status in ('marks_locked', 'results_processed') then
      -- Re-opening for corrections discards unapproved processed results.
      if not (select public.has_permission('marks.lock')) then raise exception 'Not authorised' using errcode = '42501'; end if;
      if nullif(trim(p_reason), '') is null then
        raise exception 'A reason is required to reopen marks entry' using errcode = '22023';
      end if;
      delete from public.results where examination_id = p_exam_id;
    else
      raise exception 'Cannot reopen marks entry from status %', v_exam.status using errcode = 'P0001';
    end if;

  elsif p_to = 'marks_locked' then
    if not (select public.has_permission('marks.lock')) then raise exception 'Not authorised to lock marks' using errcode = '42501'; end if;
    if v_exam.status <> 'marks_entry' then
      raise exception 'Only examinations open for marks entry can be locked' using errcode = 'P0001';
    end if;
    select count(*) into v_n from public.exam_missing_marks(p_exam_id);
    if v_n > 0 then
      raise exception 'Cannot lock: % mark(s) are missing. Record marks or a status (absent/exempted) for every candidate.', v_n
        using errcode = 'P0001';
    end if;
    select count(*) into v_n from public.exam_candidate_pairs(p_exam_id);
    if v_n = 0 then
      raise exception 'Cannot lock: the examination has no candidates' using errcode = 'P0001';
    end if;

  elsif p_to = 'results_approved' then
    if not (select public.has_permission('results.approve')) then raise exception 'Not authorised to approve results' using errcode = '42501'; end if;
    if v_exam.status <> 'results_processed' then
      raise exception 'Results must be processed before approval' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.results where examination_id = p_exam_id and status = 'incomplete') then
      raise exception 'Results contain incomplete records and cannot be approved' using errcode = 'P0001';
    end if;
    -- Results must be newer than every mark change.
    if exists (select 1 from public.marks m join public.examination_subjects es on es.id = m.examination_subject_id
               where es.examination_id = p_exam_id and m.updated_at > v_exam.processed_at) then
      raise exception 'Marks changed after processing; re-process results first' using errcode = 'P0001';
    end if;

  elsif p_to = 'published' then
    if not (select public.has_permission('results.publish')) then raise exception 'Not authorised to publish results' using errcode = '42501'; end if;
    if v_exam.status <> 'results_approved' then
      raise exception 'Results must be approved before publication' using errcode = 'P0001';
    end if;
    select count(*) into v_n from public.exam_missing_marks(p_exam_id);
    if v_n > 0 then raise exception 'Cannot publish: % mark(s) are missing', v_n using errcode = 'P0001'; end if;
    if (select count(distinct student_id) from public.exam_candidate_pairs(p_exam_id))
       <> (select count(*) from public.results where examination_id = p_exam_id) then
      raise exception 'Cannot publish: results do not cover every candidate; re-process results' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.results where examination_id = p_exam_id and status = 'incomplete') then
      raise exception 'Cannot publish incomplete results' using errcode = 'P0001';
    end if;

  elsif p_to = 'results_processed' then
    -- Withdraw approval or publication (exceptional; audited, reason required).
    if v_exam.status = 'published' then
      if not (select public.has_permission('results.unpublish')) then
        raise exception 'Only a Super Administrator can withdraw published results' using errcode = '42501';
      end if;
    elsif v_exam.status = 'results_approved' then
      if not (select public.has_any_permission(array['results.approve', 'results.unpublish'])) then
        raise exception 'Not authorised' using errcode = '42501';
      end if;
    else
      raise exception 'Use compute_exam_results to process results' using errcode = 'P0001';
    end if;
    if nullif(trim(p_reason), '') is null then
      raise exception 'A reason is required' using errcode = '22023';
    end if;
  else
    raise exception 'Unsupported transition to %', p_to using errcode = '22023';
  end if;

  perform set_config('dcc.allow_exam_status_change', 'on', true);
  update public.examinations set
    status = p_to,
    locked_by = case when p_to = 'marks_locked' then (select auth.uid()) when p_to = 'marks_entry' then null else locked_by end,
    locked_at = case when p_to = 'marks_locked' then now() when p_to = 'marks_entry' then null else locked_at end,
    approved_by = case when p_to = 'results_approved' then (select auth.uid()) when p_to in ('results_processed', 'marks_entry') then null else approved_by end,
    approved_at = case when p_to = 'results_approved' then now() when p_to in ('results_processed', 'marks_entry') then null else approved_at end,
    published_by = case when p_to = 'published' then (select auth.uid()) when p_to in ('results_processed', 'marks_entry') then null else published_by end,
    published_at = case when p_to = 'published' then now() when p_to in ('results_processed', 'marks_entry') then null else published_at end
  where id = p_exam_id;
  perform set_config('dcc.allow_exam_status_change', 'off', true);

  perform public.log_audit('exam.' || p_to::text, 'examinations', p_exam_id::text,
    jsonb_build_object('from', v_exam.status, 'to', p_to, 'reason', p_reason));
end;
$$;
grant execute on function public.transition_examination(uuid, public.exam_status, text) to authenticated;

-- Create improvement/supplementary candidates from failed subjects of a source exam.
create or replace function public.add_candidates_from_failures(p_target_exam_id uuid, p_source_exam_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if not (select public.has_permission('exams.manage')) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if not exists (select 1 from public.examinations where id = p_source_exam_id and status = 'published') then
    raise exception 'Source examination results must be published' using errcode = 'P0001';
  end if;
  insert into public.examination_candidates (examination_id, student_id, course_offering_id, source_result_id)
  select p_target_exam_id, r.student_id, rs.course_offering_id, r.id
  from public.results r
  join public.result_subjects rs on rs.result_id = r.id
  where r.examination_id = p_source_exam_id and rs.is_pass = false
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
grant execute on function public.add_candidates_from_failures(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Public verification (anon): minimal information, published results only.
-- -----------------------------------------------------------------------------
create or replace function public.verify_result(p_code text)
returns table (
  student_name text, admission_no text, programme text, term text, examination text,
  academic_session text, result_status public.result_status, percentage numeric, published_at timestamptz,
  is_provisional boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select st.full_name, st.admission_no, p.name, t.name, ex.name, s.name, r.status, r.percentage, ex.published_at,
         ex.is_provisional
  from public.results r
  join public.examinations ex on ex.id = r.examination_id and ex.status = 'published'
  join public.students st on st.id = r.student_id
  join public.programmes p on p.id = ex.programme_id
  join public.programme_terms t on t.id = ex.term_id
  join public.academic_sessions s on s.id = ex.academic_session_id
  where r.verification_code = upper(trim(p_code))
    and length(trim(p_code)) between 8 and 32;
$$;
grant execute on function public.verify_result(text) to anon, authenticated;

create trigger audit_examination_subjects after insert or update or delete on public.examination_subjects
  for each row execute function public.audit_row_change();
create trigger audit_grading_rules after insert or update or delete on public.grading_rules
  for each row execute function public.audit_row_change();
create trigger audit_grading_schemes after insert or update or delete on public.grading_schemes
  for each row execute function public.audit_row_change();
