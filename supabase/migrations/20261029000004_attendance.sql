-- =============================================================================
-- DCC Portal — Attendance
-- =============================================================================
-- Attendance % = attended sessions / eligible sessions × 100, where
--   attended  = records whose status has counts_as_present = true
--   eligible  = records whose status has counts_in_total   = true
-- e.g. "Approved leave" can be configured to be excluded from the total
-- (counts_in_total = false) or counted as present (counts_as_present = true).
-- =============================================================================

create table public.attendance_statuses (
  code text primary key check (code ~ '^[A-Z]{1,4}$'),
  label text not null,
  counts_as_present boolean not null,
  counts_in_total boolean not null default true,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  check (not counts_as_present or counts_in_total)
);

-- One attendance event: a class (optionally a specific subject) on a date/period.
create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  academic_session_id uuid not null references public.academic_sessions (id) on delete restrict,
  programme_id uuid not null references public.programmes (id) on delete restrict,
  term_id uuid not null references public.programme_terms (id) on delete restrict,
  course_offering_id uuid references public.course_offerings (id) on delete restrict,
  date date not null,
  period smallint not null default 1 check (period between 1 and 12),
  topic text,
  is_locked boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Prevent duplicate attendance events (NULL offering = whole-class attendance).
create unique index attendance_sessions_unique on public.attendance_sessions
  (academic_session_id, programme_id, term_id, coalesce(course_offering_id, '00000000-0000-0000-0000-000000000000'::uuid), date, period);
create index attendance_sessions_offering_idx on public.attendance_sessions (course_offering_id, date);
create trigger attendance_sessions_updated_at before update on public.attendance_sessions
  for each row execute function public.set_updated_at();

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  attendance_session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  status_code text not null references public.attendance_statuses (code) on delete restrict,
  remarks text,
  recorded_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (attendance_session_id, student_id)
);
create index attendance_records_student_idx on public.attendance_records (student_id);

alter table public.attendance_statuses enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;

create policy attendance_statuses_select on public.attendance_statuses for select to authenticated using (true);
create policy attendance_statuses_write on public.attendance_statuses for all to authenticated
  using ((select public.has_permission('attendance.configure'))) with check ((select public.has_permission('attendance.configure')));

-- Helpers (SECURITY DEFINER) avoid recursive policy evaluation between the
-- sessions and records tables.
create or replace function public.teaches_attendance_session(p_attendance_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.attendance_sessions s
    where s.id = p_attendance_session_id
      and public.is_teacher_of_class(s.academic_session_id, s.programme_id, s.term_id)
  );
$$;

create or replace function public.student_in_attendance_session(p_attendance_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.attendance_records r
    where r.attendance_session_id = p_attendance_session_id
      and r.student_id = (select public.current_student_id())
  );
$$;
grant execute on function public.teaches_attendance_session(uuid) to authenticated;

create or replace function public.my_attendance_session_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.attendance_sessions s
  where exists (
    select 1 from public.teacher_assignments ta
    join public.course_offerings o on o.id = ta.course_offering_id
    where ta.staff_id = (select public.current_staff_id())
      and o.academic_session_id = s.academic_session_id and o.programme_id = s.programme_id and o.term_id = s.term_id);
$$;

create or replace function public.my_student_attendance_session_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.attendance_session_id from public.attendance_records r
  where r.student_id = (select public.current_student_id());
$$;
grant execute on function public.my_attendance_session_ids() to authenticated;
grant execute on function public.my_student_attendance_session_ids() to authenticated;
grant execute on function public.student_in_attendance_session(uuid) to authenticated;

create policy attendance_sessions_select on public.attendance_sessions for select to authenticated
  using (
    (select public.has_permission('attendance.view_all'))
    or id in (select public.my_attendance_session_ids())
    or id in (select public.my_student_attendance_session_ids())
  );

create policy attendance_records_select on public.attendance_records for select to authenticated
  using (
    (select public.has_permission('attendance.view_all'))
    or student_id = (select public.current_student_id())
    or attendance_session_id in (select public.my_attendance_session_ids())
  );
-- All writes go through save_attendance() which enforces assignment, cutoff and locking.

-- Can the caller record/edit attendance for this class/subject on this date?
create or replace function public.can_edit_attendance(
  p_session_id uuid, p_programme_id uuid, p_term_id uuid, p_offering_id uuid, p_date date
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_window integer;
begin
  if (select public.has_permission('attendance.manage')) then
    return true;
  end if;
  if not (select public.has_permission('attendance.take')) then
    return false;
  end if;
  if p_offering_id is not null then
    if not public.is_assigned_to_offering(p_offering_id) then
      return false;
    end if;
  elsif not public.is_teacher_of_class(p_session_id, p_programme_id, p_term_id) then
    return false;
  end if;
  select attendance_edit_window_days into v_window from public.institution_settings where id = 1;
  return p_date <= current_date and p_date >= current_date - v_window;
end;
$$;
grant execute on function public.can_edit_attendance(uuid, uuid, uuid, uuid, date) to authenticated;

-- Bulk save for a class. p_records = [{"student_id": "...", "status_code": "P", "remarks": null}, ...]
create or replace function public.save_attendance(
  p_academic_session_id uuid,
  p_programme_id uuid,
  p_term_id uuid,
  p_offering_id uuid,
  p_date date,
  p_period smallint,
  p_records jsonb,
  p_topic text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_locked boolean;
  v_invalid integer;
  v_count integer;
begin
  if p_date > current_date then
    raise exception 'Attendance cannot be recorded for a future date' using errcode = 'P0001';
  end if;
  if not public.can_edit_attendance(p_academic_session_id, p_programme_id, p_term_id, p_offering_id, p_date) then
    raise exception 'You are not permitted to record attendance for this class on this date (not assigned or past the edit cutoff)'
      using errcode = '42501';
  end if;
  if p_offering_id is not null and not exists (
    select 1 from public.course_offerings o where o.id = p_offering_id
      and o.academic_session_id = p_academic_session_id and o.programme_id = p_programme_id and o.term_id = p_term_id) then
    raise exception 'Subject does not belong to the selected class' using errcode = '23514';
  end if;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) = 0 then
    raise exception 'No attendance records supplied' using errcode = '22023';
  end if;

  -- Validate statuses
  select count(*) into v_invalid
  from jsonb_array_elements(p_records) r
  left join public.attendance_statuses s on s.code = r ->> 'status_code' and s.is_active
  where s.code is null;
  if v_invalid > 0 then
    raise exception 'Invalid attendance status in % record(s)', v_invalid using errcode = '22023';
  end if;

  -- Validate duplicates within the payload
  select count(*) - count(distinct r ->> 'student_id') into v_invalid from jsonb_array_elements(p_records) r;
  if v_invalid > 0 then
    raise exception 'Duplicate student entries in attendance submission' using errcode = '23505';
  end if;

  -- Validate every student is enrolled in this class (and subject, if any)
  select count(*) into v_invalid
  from jsonb_array_elements(p_records) r
  where not exists (
    select 1 from public.student_enrolments e
    where e.student_id = (r ->> 'student_id')::uuid
      and e.academic_session_id = p_academic_session_id
      and e.programme_id = p_programme_id
      and e.term_id = p_term_id
      and e.status in ('active', 'promoted', 'repeated', 'completed')
      and (p_offering_id is null or exists (
        select 1 from public.student_subject_enrolments sse
        where sse.enrolment_id = e.id and sse.course_offering_id = p_offering_id))
  );
  if v_invalid > 0 then
    raise exception '% student(s) are not enrolled in this class/subject', v_invalid using errcode = '23514';
  end if;

  insert into public.attendance_sessions (academic_session_id, programme_id, term_id, course_offering_id, date, period, topic, created_by)
  values (p_academic_session_id, p_programme_id, p_term_id, p_offering_id, p_date, coalesce(p_period, 1), p_topic, (select auth.uid()))
  on conflict (academic_session_id, programme_id, term_id, coalesce(course_offering_id, '00000000-0000-0000-0000-000000000000'::uuid), date, period)
  do update set topic = coalesce(excluded.topic, public.attendance_sessions.topic), updated_at = now()
  returning id, is_locked into v_session_id, v_locked;

  if v_locked and not (select public.has_permission('attendance.manage')) then
    raise exception 'This attendance register is locked' using errcode = 'P0001';
  end if;

  insert into public.attendance_records (attendance_session_id, student_id, status_code, remarks, recorded_by)
  select v_session_id, (r ->> 'student_id')::uuid, r ->> 'status_code', nullif(r ->> 'remarks', ''), (select auth.uid())
  from jsonb_array_elements(p_records) r
  on conflict (attendance_session_id, student_id) do update
    set status_code = excluded.status_code, remarks = excluded.remarks,
        recorded_by = excluded.recorded_by, updated_at = now()
    where public.attendance_records.status_code is distinct from excluded.status_code
       or public.attendance_records.remarks is distinct from excluded.remarks;

  get diagnostics v_count = row_count;
  if p_date < current_date then
    perform public.log_audit('attendance.save', 'attendance_sessions', v_session_id::text,
      jsonb_build_object('date', p_date, 'changed_records', v_count, 'backdated', true));
  end if;
  return v_session_id;
end;
$$;
grant execute on function public.save_attendance(uuid, uuid, uuid, uuid, date, smallint, jsonb, text) to authenticated;

create or replace function public.set_attendance_lock(p_session_id uuid, p_locked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_permission('attendance.manage')) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  update public.attendance_sessions set is_locked = p_locked where id = p_session_id;
  perform public.log_audit(case when p_locked then 'attendance.lock' else 'attendance.unlock' end,
    'attendance_sessions', p_session_id::text, '{}'::jsonb);
end;
$$;
grant execute on function public.set_attendance_lock(uuid, boolean) to authenticated;

-- Per-student attendance summary for a class (optionally subject / date range).
-- Uses SECURITY INVOKER so RLS on attendance tables limits what each caller sees.
create or replace function public.attendance_summary(
  p_academic_session_id uuid,
  p_programme_id uuid default null,
  p_term_id uuid default null,
  p_offering_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_student_id uuid default null
)
returns table (
  student_id uuid,
  attended bigint,
  eligible bigint,
  excluded bigint,
  total_records bigint,
  percentage numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.student_id,
    count(*) filter (where st.counts_as_present) as attended,
    count(*) filter (where st.counts_in_total) as eligible,
    count(*) filter (where not st.counts_in_total) as excluded,
    count(*) as total_records,
    case when count(*) filter (where st.counts_in_total) = 0 then null
         else round(100.0 * count(*) filter (where st.counts_as_present) / count(*) filter (where st.counts_in_total), 2)
    end as percentage
  from public.attendance_records r
  join public.attendance_sessions s on s.id = r.attendance_session_id
  join public.attendance_statuses st on st.code = r.status_code
  where s.academic_session_id = p_academic_session_id
    and (p_programme_id is null or s.programme_id = p_programme_id)
    and (p_term_id is null or s.term_id = p_term_id)
    and (p_offering_id is null or s.course_offering_id = p_offering_id)
    and (p_from is null or s.date >= p_from)
    and (p_to is null or s.date <= p_to)
    and (p_student_id is null or r.student_id = p_student_id)
  group by r.student_id;
$$;
grant execute on function public.attendance_summary(uuid, uuid, uuid, uuid, date, date, uuid) to authenticated;
