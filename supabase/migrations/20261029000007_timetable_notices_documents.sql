-- =============================================================================
-- DCC Portal — Timetable, notices, notifications, documents & storage
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Timetable
-- -----------------------------------------------------------------------------
create table public.timetable_periods (
  period_no smallint primary key check (period_no between 1 and 12),
  start_time time not null,
  end_time time not null,
  label text,
  check (end_time > start_time)
);

create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  academic_session_id uuid not null references public.academic_sessions (id) on delete restrict,
  programme_id uuid not null references public.programmes (id) on delete restrict,
  term_id uuid not null references public.programme_terms (id) on delete restrict,
  section text not null default '',
  course_offering_id uuid not null references public.course_offerings (id) on delete cascade,
  staff_id uuid references public.staff (id) on delete set null,
  day_of_week smallint not null check (day_of_week between 1 and 6),   -- 1 = Monday … 6 = Saturday
  period_no smallint not null references public.timetable_periods (period_no) on delete restrict,
  room text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Conflict prevention: a class, a teacher and a room can each be in one place per slot.
create unique index timetable_class_slot on public.timetable_entries (academic_session_id, programme_id, term_id, section, day_of_week, period_no);
create unique index timetable_teacher_slot on public.timetable_entries (academic_session_id, staff_id, day_of_week, period_no) where staff_id is not null;
create unique index timetable_room_slot on public.timetable_entries (academic_session_id, lower(room), day_of_week, period_no) where room is not null and room <> '';
create trigger timetable_entries_updated_at before update on public.timetable_entries
  for each row execute function public.set_updated_at();

create or replace function public.check_timetable_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.course_offerings o where o.id = new.course_offering_id
      and o.academic_session_id = new.academic_session_id and o.programme_id = new.programme_id and o.term_id = new.term_id) then
    raise exception 'Subject does not belong to the selected class' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger timetable_entries_check before insert or update on public.timetable_entries
  for each row execute function public.check_timetable_entry();

-- Returns conflicts a proposed slot would create (for friendly UI messages).
create or replace function public.timetable_conflicts(
  p_session_id uuid, p_programme_id uuid, p_term_id uuid, p_section text, p_staff_id uuid,
  p_room text, p_day smallint, p_period smallint, p_exclude_id uuid default null
)
returns table (kind text, entry_id uuid, description text)
language sql
stable
security invoker
set search_path = ''
as $$
  select 'class', t.id, 'Class already has ' || s.name || ' in this slot'
  from public.timetable_entries t
  join public.course_offerings o on o.id = t.course_offering_id join public.subjects s on s.id = o.subject_id
  where t.academic_session_id = p_session_id and t.programme_id = p_programme_id and t.term_id = p_term_id
    and t.section = coalesce(p_section, '') and t.day_of_week = p_day and t.period_no = p_period
    and t.id is distinct from p_exclude_id
  union all
  select 'teacher', t.id, 'Teacher is already assigned to ' || p.code || ' ' || pt.name
  from public.timetable_entries t
  join public.programmes p on p.id = t.programme_id join public.programme_terms pt on pt.id = t.term_id
  where p_staff_id is not null and t.academic_session_id = p_session_id and t.staff_id = p_staff_id
    and t.day_of_week = p_day and t.period_no = p_period and t.id is distinct from p_exclude_id
  union all
  select 'room', t.id, 'Room ' || t.room || ' is already in use'
  from public.timetable_entries t
  where nullif(p_room, '') is not null and t.academic_session_id = p_session_id and lower(t.room) = lower(p_room)
    and t.day_of_week = p_day and t.period_no = p_period and t.id is distinct from p_exclude_id;
$$;
grant execute on function public.timetable_conflicts(uuid, uuid, uuid, text, uuid, text, smallint, smallint, uuid) to authenticated;

alter table public.timetable_periods enable row level security;
alter table public.timetable_entries enable row level security;
create policy timetable_periods_select on public.timetable_periods for select to authenticated using (true);
create policy timetable_periods_write on public.timetable_periods for all to authenticated
  using ((select public.has_permission('timetable.manage'))) with check ((select public.has_permission('timetable.manage')));
-- Timetables are not confidential: any signed-in user may read them.
create policy timetable_entries_select on public.timetable_entries for select to authenticated using (true);
create policy timetable_entries_write on public.timetable_entries for all to authenticated
  using ((select public.has_permission('timetable.manage'))) with check ((select public.has_permission('timetable.manage')));

-- -----------------------------------------------------------------------------
-- Document metadata (files live in private Supabase Storage buckets)
-- -----------------------------------------------------------------------------
create table public.document_metadata (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  path text not null,
  owner_type text not null check (owner_type in ('student', 'admission', 'notice', 'staff', 'institution')),
  owner_id uuid,
  category text,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);
create index document_metadata_owner_idx on public.document_metadata (owner_type, owner_id);

alter table public.admission_documents
  add constraint admission_documents_file_fk foreign key (file_document_id) references public.document_metadata (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Notices
-- -----------------------------------------------------------------------------
create type public.notice_category as enum ('academic', 'examination', 'admission', 'holiday', 'fee', 'general');
create type public.notice_status as enum ('draft', 'published', 'archived');

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 2),
  body text not null,
  category public.notice_category not null default 'general',
  status public.notice_status not null default 'draft',
  publish_at timestamptz,
  expires_at timestamptz,
  is_pinned boolean not null default false,
  attachment_document_id uuid references public.document_metadata (id) on delete set null,
  author_id uuid references public.profiles (id) on delete set null,
  published_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or publish_at is null or expires_at > publish_at)
);
create index notices_visible_idx on public.notices (status, publish_at desc);
create trigger notices_updated_at before update on public.notices
  for each row execute function public.set_updated_at();

-- Audience rows: a notice is visible to a user if ANY audience row matches.
create table public.notice_audiences (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices (id) on delete cascade,
  audience text not null check (audience in ('everyone', 'all_students', 'all_staff', 'programme', 'class')),
  programme_id uuid references public.programmes (id) on delete cascade,
  term_id uuid references public.programme_terms (id) on delete cascade,
  check (case audience
           when 'programme' then programme_id is not null and term_id is null
           when 'class' then programme_id is not null and term_id is not null
           else programme_id is null and term_id is null
         end)
);
create index notice_audiences_notice_idx on public.notice_audiences (notice_id);

create or replace function public.can_read_notice(p_notice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.notices n
    where n.id = p_notice_id
      and n.status = 'published'
      and (n.publish_at is null or n.publish_at <= now())
      and (n.expires_at is null or n.expires_at > now())
      and exists (
        select 1 from public.notice_audiences a
        where a.notice_id = n.id
          and (
            a.audience = 'everyone'
            or (a.audience = 'all_staff' and (select public.current_staff_id()) is not null)
            or (a.audience = 'all_students' and (select public.current_student_id()) is not null)
            or (a.audience in ('programme', 'class') and (
                  (select public.current_staff_id()) is not null   -- staff see class notices
                  or exists (
                    select 1 from public.student_enrolments e
                    join public.academic_sessions s on s.id = e.academic_session_id
                    where e.student_id = (select public.current_student_id()) and e.status = 'active'
                      and e.programme_id = a.programme_id
                      and (a.audience = 'programme' or e.term_id = a.term_id))))
          )
      )
  );
$$;
grant execute on function public.can_read_notice(uuid) to authenticated;

alter table public.notices enable row level security;
alter table public.notice_audiences enable row level security;

create policy notices_select on public.notices for select to authenticated
  using ((select public.has_permission('notices.manage')) or public.can_read_notice(id));
create policy notices_insert on public.notices for insert to authenticated
  with check ((select public.has_permission('notices.manage')) and status = 'draft' and author_id = (select auth.uid()));
create policy notices_update on public.notices for update to authenticated
  using ((select public.has_permission('notices.manage')))
  with check ((select public.has_permission('notices.manage')) and (status = 'draft' or (select public.has_permission('notices.publish'))));
-- status / publication stamps change only through publish_notice().
revoke update on public.notices from authenticated;
grant update (title, body, category, publish_at, expires_at, is_pinned, attachment_document_id) on public.notices to authenticated;
create policy notices_delete on public.notices for delete to authenticated
  using ((select public.has_permission('notices.manage')) and status = 'draft');

create policy notice_audiences_select on public.notice_audiences for select to authenticated
  using ((select public.has_permission('notices.manage')) or public.can_read_notice(notice_id));
create policy notice_audiences_write on public.notice_audiences for all to authenticated
  using ((select public.has_permission('notices.manage'))) with check ((select public.has_permission('notices.manage')));

-- Publishing stamps author/time and requires notices.publish.
create or replace function public.publish_notice(p_notice_id uuid, p_publish boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_permission('notices.publish')) then
    raise exception 'Not authorised to publish notices' using errcode = '42501';
  end if;
  if p_publish and not exists (select 1 from public.notice_audiences where notice_id = p_notice_id) then
    raise exception 'Select at least one audience before publishing' using errcode = 'P0001';
  end if;
  update public.notices
    set status = case when p_publish then 'published'::public.notice_status else 'archived'::public.notice_status end,
        published_by = case when p_publish then (select auth.uid()) else published_by end,
        published_at = case when p_publish then now() else published_at end,
        publish_at = case when p_publish then coalesce(publish_at, now()) else publish_at end
    where id = p_notice_id;
  perform public.log_audit(case when p_publish then 'notice.publish' else 'notice.archive' end, 'notices', p_notice_id::text, '{}'::jsonb);
end;
$$;
grant execute on function public.publish_notice(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Personal notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  link text check (link is null or link ~ '^/[A-Za-z0-9/_\-?=&.%]*$'),
  kind text not null default 'info',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Low-attendance alerts: notifies students (with accounts) below the threshold.
create or replace function public.send_low_attendance_alerts(p_academic_session_id uuid, p_programme_id uuid default null, p_term_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_threshold numeric;
  v_n integer;
begin
  if not (select public.has_any_permission(array['attendance.manage', 'attendance.view_all'])) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  select attendance_threshold into v_threshold from public.institution_settings where id = 1;
  insert into public.notifications (user_id, title, body, link, kind)
  select st.profile_id,
         'Low attendance warning',
         format('Your attendance is %s%%, below the required %s%%. Please contact your class teacher.', a.pct, v_threshold),
         '/my/attendance', 'warning'
  from (
    select r.student_id,
           round(100.0 * count(*) filter (where s.counts_as_present) / nullif(count(*) filter (where s.counts_in_total), 0), 2) as pct
    from public.attendance_records r
    join public.attendance_sessions ss on ss.id = r.attendance_session_id
    join public.attendance_statuses s on s.code = r.status_code
    where ss.academic_session_id = p_academic_session_id
      and (p_programme_id is null or ss.programme_id = p_programme_id)
      and (p_term_id is null or ss.term_id = p_term_id)
    group by r.student_id
  ) a
  join public.students st on st.id = a.student_id
  where a.pct is not null and a.pct < v_threshold and st.profile_id is not null and st.status = 'active';
  get diagnostics v_n = row_count;
  perform public.log_audit('attendance.alerts', 'academic_sessions', p_academic_session_id::text, jsonb_build_object('sent', v_n));
  return v_n;
end;
$$;
grant execute on function public.send_low_attendance_alerts(uuid, uuid, uuid) to authenticated;

-- Notify students when results are published.
create or replace function public.notify_results_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    insert into public.notifications (user_id, title, body, link, kind)
    select st.profile_id, 'Result published', new.name || ' results are now available.', '/my/results', 'success'
    from public.results r join public.students st on st.id = r.student_id
    where r.examination_id = new.id and st.profile_id is not null;
  end if;
  return new;
end;
$$;
create trigger examinations_notify_published after update of status on public.examinations
  for each row execute function public.notify_results_published();

-- -----------------------------------------------------------------------------
-- Document metadata RLS
-- -----------------------------------------------------------------------------
alter table public.document_metadata enable row level security;
create policy document_metadata_select on public.document_metadata for select to authenticated
  using (
    (owner_type = 'student' and ((select public.has_permission('students.view')) or owner_id = (select public.current_student_id())))
    or (owner_type = 'admission' and (select public.has_permission('admissions.view')))
    or (owner_type = 'staff' and ((select public.has_permission('staff.view_confidential')) or owner_id = (select public.current_staff_id())))
    or (owner_type = 'notice' and ((select public.has_permission('notices.manage')) or exists (
          select 1 from public.notices n where n.attachment_document_id = id and public.can_read_notice(n.id))))
    or owner_type = 'institution'
  );
create policy document_metadata_insert on public.document_metadata for insert to authenticated
  with check (
    uploaded_by = (select auth.uid()) and (
      (owner_type = 'student' and (select public.has_permission('students.manage')))
      or (owner_type = 'admission' and (select public.has_permission('admissions.manage')))
      or (owner_type = 'staff' and (select public.has_permission('staff.manage')))
      or (owner_type = 'notice' and (select public.has_permission('notices.manage')))
      or (owner_type = 'institution' and (select public.has_permission('settings.manage')))
    )
  );
create policy document_metadata_delete on public.document_metadata for delete to authenticated
  using (
    (owner_type = 'student' and (select public.has_permission('students.manage')))
    or (owner_type = 'admission' and (select public.has_permission('admissions.manage')))
    or (owner_type = 'staff' and (select public.has_permission('staff.manage')))
    or (owner_type = 'notice' and (select public.has_permission('notices.manage')))
    or (owner_type = 'institution' and (select public.has_permission('settings.manage')))
  );

-- -----------------------------------------------------------------------------
-- Storage: private buckets with size and MIME restrictions.
-- Objects are reachable only via short-lived signed URLs created server-side
-- after the app checks access through document_metadata RLS.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('student-documents', 'student-documents', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('admission-documents', 'admission-documents', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf']),
  ('notice-attachments', 'notice-attachments', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png']),
  ('institution-assets', 'institution-assets', false, 2097152, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
on conflict (id) do nothing;

-- Storage object policies mirror document_metadata: an object is readable when
-- the caller can read a metadata row pointing at it.
create policy dcc_storage_read on storage.objects for select to authenticated
  using (
    bucket_id in ('student-documents', 'admission-documents', 'notice-attachments', 'institution-assets')
    and exists (select 1 from public.document_metadata d where d.bucket = bucket_id and d.path = name)
  );
create policy dcc_storage_insert on storage.objects for insert to authenticated
  with check (
    (bucket_id = 'student-documents' and (select public.has_permission('students.manage')))
    or (bucket_id = 'admission-documents' and (select public.has_permission('admissions.manage')))
    or (bucket_id = 'notice-attachments' and (select public.has_permission('notices.manage')))
    or (bucket_id = 'institution-assets' and (select public.has_permission('settings.manage')))
  );
create policy dcc_storage_delete on storage.objects for delete to authenticated
  using (
    (bucket_id = 'student-documents' and (select public.has_permission('students.manage')))
    or (bucket_id = 'admission-documents' and (select public.has_permission('admissions.manage')))
    or (bucket_id = 'notice-attachments' and (select public.has_permission('notices.manage')))
    or (bucket_id = 'institution-assets' and (select public.has_permission('settings.manage')))
  );

create trigger audit_notices after update on public.notices
  for each row execute function public.audit_row_change();
create trigger audit_timetable after insert or update or delete on public.timetable_entries
  for each row execute function public.audit_row_change();
create trigger audit_institution_settings after update on public.institution_settings
  for each row execute function public.audit_row_change();
create trigger audit_role_permissions after insert or delete on public.role_permissions
  for each row execute function public.audit_row_change();
