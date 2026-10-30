-- =============================================================================
-- User administration: edit and delete user accounts from the portal.
--
-- 1. Audit log entries keep a readable actor label, so history still says who
--    did what after an account is deleted.
-- 2. Deleting an account clears references to it ("on delete set null") in
--    append-only / immutable tables (payments, audit log, marks, results,
--    examinations). The protection triggers allow exactly that change and
--    nothing else: only the listed user-reference columns may change, only to
--    NULL, and only when the referenced profile no longer exists.
-- 3. user_deletion_check(): Super Administrator only; never yourself; never the
--    last Super Administrator. The actual deletion is done by the server with
--    the Auth admin API after this check passes.
-- 4. admin_update_profile(): audited name/phone edits by user managers.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Audit actor label
-- -----------------------------------------------------------------------------
alter table public.audit_logs add column actor_label text;

create or replace function public.audit_logs_set_actor_label()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.actor_id is not null and new.actor_label is null then
    select nullif(trim(coalesce(p.full_name, '') || coalesce(' <' || p.email || '>', '')), '')
      into new.actor_label
    from public.profiles p where p.id = new.actor_id;
  end if;
  return new;
end;
$$;
create trigger audit_logs_actor_label before insert on public.audit_logs
  for each row execute function public.audit_logs_set_actor_label();

-- Backfill existing rows (the append-only trigger is suspended only for this statement).
alter table public.audit_logs disable trigger audit_logs_protect;
update public.audit_logs a
set actor_label = nullif(trim(coalesce(p.full_name, '') || coalesce(' <' || p.email || '>', '')), '')
from public.profiles p
where p.id = a.actor_id and a.actor_label is null;
alter table public.audit_logs enable trigger audit_logs_protect;

-- -----------------------------------------------------------------------------
-- 2. Allow the FK "set null" of a deleted account through protection triggers
-- -----------------------------------------------------------------------------
create or replace function public.is_deleted_profile_unlink(p_table text, p_old jsonb, p_new jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cols text[];
  v_key text;
  v_changed integer := 0;
begin
  v_cols := case p_table
    when 'audit_logs' then array['actor_id']
    when 'payments' then array['received_by']
    when 'payment_adjustments' then array['authorized_by']
    when 'mark_revisions' then array['changed_by']
    when 'marks' then array['entered_by', 'updated_by']
    when 'results' then array['computed_by']
    when 'examinations' then array['created_by', 'locked_by', 'processed_by', 'approved_by', 'published_by']
    else array[]::text[]
  end;

  for v_key in select jsonb_object_keys(p_new) loop
    continue when v_key = 'updated_at' or (p_old -> v_key) is not distinct from (p_new -> v_key);
    -- Any other change, or a change to anything but NULL, is not an unlink.
    if not (v_key = any (v_cols)) or jsonb_typeof(p_new -> v_key) <> 'null' or jsonb_typeof(p_old -> v_key) = 'null' then
      return false;
    end if;
    -- The referenced account must really be gone.
    if exists (select 1 from public.profiles p where p.id = (p_old ->> v_key)::uuid) then
      return false;
    end if;
    v_changed := v_changed + 1;
  end loop;
  return v_changed > 0;
end;
$$;
revoke execute on function public.is_deleted_profile_unlink(text, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.protect_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Allow only the FK 'on delete set null' of a deleted user account (see is_deleted_profile_unlink).
  if tg_op = 'UPDATE' and public.is_deleted_profile_unlink(tg_table_name, to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;
  raise exception '% records are append-only', tg_table_name using errcode = 'P0001';
end;
$$;

create or replace function public.protect_payments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Allow only the FK 'on delete set null' of a deleted user account (see is_deleted_profile_unlink).
  if tg_op = 'UPDATE' and public.is_deleted_profile_unlink(tg_table_name, to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Payments cannot be deleted; record a reversal instead' using errcode = 'P0001';
  end if;
  if current_setting('dcc.allow_payment_reversal', true) = 'on'
     and old.status = 'completed' and new.status = 'reversed'
     and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then
    return new;
  end if;
  raise exception 'Completed payments cannot be modified; record a reversal or adjustment instead' using errcode = 'P0001';
end;
$$;

create or replace function public.prevent_published_result_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_exam uuid;
begin
  -- Allow only the FK 'on delete set null' of a deleted user account (see is_deleted_profile_unlink).
  if tg_op = 'UPDATE' and public.is_deleted_profile_unlink(tg_table_name, to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;
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

create or replace function public.check_exam_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Allow only the FK 'on delete set null' of a deleted user account (see is_deleted_profile_unlink).
  if tg_op = 'UPDATE' and public.is_deleted_profile_unlink(tg_table_name, to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;
  if old.status = 'published' and current_setting('dcc.allow_exam_status_change', true) is distinct from 'on' then
    raise exception 'A published examination cannot be modified' using errcode = 'P0001';
  end if;
  if new.status is distinct from old.status and current_setting('dcc.allow_exam_status_change', true) is distinct from 'on' then
    raise exception 'Examination status can only be changed through the workflow functions' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.check_marks_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.exam_status;
  v_max numeric;
begin
  -- Allow only the FK 'on delete set null' of a deleted user account (see is_deleted_profile_unlink).
  if tg_op = 'UPDATE' and public.is_deleted_profile_unlink(tg_table_name, to_jsonb(old), to_jsonb(new)) then
    return new;
  end if;
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

-- -----------------------------------------------------------------------------
-- 3. Deletion pre-check (Super Administrator only)
-- -----------------------------------------------------------------------------
create or replace function public.user_deletion_check(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_roles text[];
begin
  if not (select public.has_role('super_admin')) then
    raise exception 'Only a Super Administrator can delete user accounts' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot delete your own account' using errcode = 'P0001';
  end if;
  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  select coalesce(array_agg(r.key order by r.key), '{}') into v_roles
  from public.user_roles ur join public.roles r on r.id = ur.role_id
  where ur.user_id = p_user_id;
  if 'super_admin' = any (v_roles) and (
    select count(*) from public.user_roles ur join public.roles r on r.id = ur.role_id
    where r.key = 'super_admin') <= 1 then
    raise exception 'At least one Super Administrator must remain' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'email', v_profile.email,
    'full_name', v_profile.full_name,
    'roles', to_jsonb(v_roles),
    'staff_id', (select s.id from public.staff s where s.profile_id = p_user_id),
    'student_id', (select s.id from public.students s where s.profile_id = p_user_id)
  );
end;
$$;
grant execute on function public.user_deletion_check(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Audited profile edits by user managers
-- -----------------------------------------------------------------------------
create or replace function public.admin_update_profile(p_user_id uuid, p_full_name text, p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.profiles;
begin
  if not (select public.has_permission('users.manage')) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  select * into v_old from public.profiles where id = p_user_id;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
             where ur.user_id = p_user_id and r.key = 'super_admin')
     and not (select public.has_role('super_admin')) then
    raise exception 'Only a Super Administrator can edit a Super Administrator' using errcode = '42501';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Name is required' using errcode = '22023';
  end if;
  update public.profiles
  set full_name = trim(p_full_name), phone = nullif(trim(coalesce(p_phone, '')), '')
  where id = p_user_id;
  perform public.log_audit('user.update', 'profiles', p_user_id::text, jsonb_build_object(
    'full_name', jsonb_build_array(v_old.full_name, trim(p_full_name)),
    'phone', jsonb_build_array(v_old.phone, nullif(trim(coalesce(p_phone, '')), ''))));
end;
$$;
grant execute on function public.admin_update_profile(uuid, text, text) to authenticated;
