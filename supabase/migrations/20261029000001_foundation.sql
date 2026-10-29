-- =============================================================================
-- DCC Portal — Foundation: identity, roles & permissions, settings, audit log
-- =============================================================================
-- Conventions
--   * Every table has RLS enabled. Access is granted only through policies that
--     call the helper functions defined here (has_permission, etc.).
--   * Roles are stored in public.user_roles, never in auth user metadata, so a
--     user cannot elevate their own privileges by editing their JWT metadata.
--   * Sensitive multi-step operations are implemented as SECURITY DEFINER
--     functions that check permissions explicitly and run in one transaction.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- Supabase grants EXECUTE on new public functions to anon/authenticated by
-- default. We grant execute explicitly per function instead.
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email extensions.citext,
  phone text,
  avatar_path text,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (email) where email is not null;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Keep profile email in sync with auth email.
create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_auth_user_email_change();

-- -----------------------------------------------------------------------------
-- Roles & permissions
-- -----------------------------------------------------------------------------
create table public.roles (
  id smallint generated always as identity primary key,
  key text not null unique check (key ~ '^[a-z_]+$'),
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.permissions (
  key text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  module text not null,
  description text not null
);

create table public.role_permissions (
  role_id smallint not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id smallint not null references public.roles (id) on delete restrict,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
create index user_roles_role_idx on public.user_roles (role_id);

-- Permission check used throughout RLS policies and RPC functions.
-- SECURITY DEFINER so it can read role tables regardless of the caller's RLS;
-- it only ever answers for auth.uid(), so it cannot leak other users' roles.
create or replace function public.has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = (select auth.uid())
      and p.is_active
      and rp.permission_key = p_key
  );
$$;

create or replace function public.has_any_permission(p_keys text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = (select auth.uid())
      and p.is_active
      and rp.permission_key = any (p_keys)
  );
$$;

create or replace function public.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid()) and r.key = p_role
  );
$$;

-- Returns the caller's permissions and roles (used by the app shell).
create or replace function public.my_access()
returns table (roles text[], permissions text[])
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(array(
      select distinct r.key
      from public.user_roles ur join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
      order by 1
    ), '{}'),
    coalesce(array(
      select distinct rp.permission_key
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.profiles p on p.id = ur.user_id
      where ur.user_id = (select auth.uid()) and p.is_active
      order by 1
    ), '{}');
$$;

-- -----------------------------------------------------------------------------
-- Institution settings (singleton row)
-- -----------------------------------------------------------------------------
create table public.institution_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null default 'Damdei Christian College',
  short_name text not null default 'DCC',
  address text not null default 'Manipur, India',
  phone text,
  email text,
  website text,
  logo_path text,
  -- attendance
  attendance_threshold numeric(5,2) not null default 75 check (attendance_threshold between 0 and 100),
  attendance_edit_window_days integer not null default 3 check (attendance_edit_window_days >= 0),
  -- numbering
  admission_no_prefix text not null default 'DCC',
  application_no_prefix text not null default 'APP',
  receipt_no_prefix text not null default 'RCPT',
  -- financial year start month (India: April = 4)
  financial_year_start_month integer not null default 4 check (financial_year_start_month between 1 and 12),
  -- documents
  marksheet_footer_note text not null default
    'This is a college-issued statement of marks. It is not an official university or council marksheet.',
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger institution_settings_updated_at before update on public.institution_settings
  for each row execute function public.set_updated_at();
insert into public.institution_settings (id) values (1);

-- -----------------------------------------------------------------------------
-- Audit log (append-only)
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id);

create or replace function public.log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- Generic row-level audit trigger for sensitive tables.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
  v_details jsonb;
begin
  if tg_op = 'DELETE' then
    v_id := (to_jsonb(old) ->> 'id');
    v_details := jsonb_build_object('old', to_jsonb(old));
  elsif tg_op = 'UPDATE' then
    v_id := (to_jsonb(new) ->> 'id');
    v_details := jsonb_build_object(
      'changed', (
        select coalesce(jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value)), '{}'::jsonb)
        from jsonb_each(to_jsonb(new)) n
        join jsonb_each(to_jsonb(old)) o on o.key = n.key
        where n.value is distinct from o.value and n.key not in ('updated_at')
      )
    );
    if v_details -> 'changed' = '{}'::jsonb then
      return new;
    end if;
  else
    v_id := (to_jsonb(new) ->> 'id');
    v_details := jsonb_build_object('new', to_jsonb(new));
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), lower(tg_op), tg_table_name, v_id, v_details);

  return coalesce(new, old);
end;
$$;

-- Users must not change these tables directly: audit logs are written only by
-- SECURITY DEFINER functions/triggers.
alter table public.audit_logs enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.institution_settings enable row level security;

create policy audit_logs_select on public.audit_logs
  for select to authenticated using ((select public.has_permission('audit.view')));

create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.has_any_permission(array['users.view', 'staff.view', 'students.view'])));
-- Users may update their own non-privileged profile fields (column grants below).
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.has_permission('users.manage')))
  with check (id = (select auth.uid()) or (select public.has_permission('users.manage')));

create policy roles_select on public.roles for select to authenticated using (true);
create policy permissions_select on public.permissions for select to authenticated using (true);
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
create policy role_permissions_manage on public.role_permissions
  for all to authenticated
  using ((select public.has_permission('roles.manage')))
  with check ((select public.has_permission('roles.manage')));

create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_permission('users.view')));
-- Role grants go through public.set_user_roles() only; no direct write policy.

create policy institution_settings_select on public.institution_settings
  for select to authenticated using (true);
create policy institution_settings_update on public.institution_settings
  for update to authenticated
  using ((select public.has_permission('settings.manage')))
  with check ((select public.has_permission('settings.manage')));

-- Column-level protection: a user editing their own profile may change only
-- presentational fields. is_active/email are changed by administrators via
-- server-side functions.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_path, last_seen_at) on public.profiles to authenticated;

-- Role assignment (atomic replace, audited, cannot self-escalate).
create or replace function public.set_user_roles(p_user_id uuid, p_role_keys text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text[];
begin
  if not (select public.has_permission('users.manage')) then
    raise exception 'Not authorised to manage user roles' using errcode = '42501';
  end if;
  -- Only super administrators may grant or revoke the super_admin role.
  if 'super_admin' = any (p_role_keys) and not (select public.has_role('super_admin')) then
    raise exception 'Only a Super Administrator can grant the Super Administrator role' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) and not (select public.has_role('super_admin')) then
    raise exception 'You cannot change your own roles' using errcode = '42501';
  end if;

  select coalesce(array_agg(r.key order by r.key), '{}') into v_old
  from public.user_roles ur join public.roles r on r.id = ur.role_id
  where ur.user_id = p_user_id;

  if 'super_admin' = any (v_old) and not ('super_admin' = any (p_role_keys)) then
    if not (select public.has_role('super_admin')) then
      raise exception 'Only a Super Administrator can revoke the Super Administrator role' using errcode = '42501';
    end if;
    if (select count(*) from public.user_roles ur join public.roles r on r.id = ur.role_id
        where r.key = 'super_admin') <= 1 then
      raise exception 'At least one Super Administrator must remain' using errcode = 'P0001';
    end if;
  end if;

  if exists (select 1 from unnest(p_role_keys) k where k not in (select key from public.roles)) then
    raise exception 'Unknown role in %', p_role_keys using errcode = '22023';
  end if;

  delete from public.user_roles where user_id = p_user_id;
  insert into public.user_roles (user_id, role_id, granted_by)
  select p_user_id, r.id, (select auth.uid()) from public.roles r where r.key = any (p_role_keys);

  perform public.log_audit('roles.set', 'profiles', p_user_id::text,
    jsonb_build_object('from', v_old, 'to', p_role_keys));
end;
$$;

-- Admin activation / deactivation of accounts.
create or replace function public.set_profile_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_permission('users.manage')) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) and not p_active then
    raise exception 'You cannot deactivate your own account' using errcode = 'P0001';
  end if;
  update public.profiles set is_active = p_active where id = p_user_id;
  perform public.log_audit(case when p_active then 'user.activate' else 'user.deactivate' end,
    'profiles', p_user_id::text, '{}'::jsonb);
end;
$$;

-- Restrict EXECUTE on helpers: anon gets nothing by default.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.has_any_permission(text[]) to authenticated;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.my_access() to authenticated;
grant execute on function public.set_user_roles(uuid, text[]) to authenticated;
grant execute on function public.set_profile_active(uuid, boolean) to authenticated;
-- log_audit is internal (called from other SECURITY DEFINER functions).
-- Server code using the service-role key records events via log_audit_as().
create or replace function public.log_audit_as(
  p_actor uuid, p_action text, p_entity_type text, p_entity_id text, p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (p_actor, p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;
revoke execute on function public.log_audit_as(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.log_audit_as(uuid, text, text, text, jsonb) to service_role;
