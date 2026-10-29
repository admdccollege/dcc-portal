-- =============================================================================
-- DCC Portal — Admissions
-- =============================================================================

create type public.admission_status as enum
  ('submitted', 'under_review', 'approved', 'waitlisted', 'rejected', 'admitted', 'withdrawn');

create table public.admission_periods (
  id uuid primary key default gen_random_uuid(),
  academic_session_id uuid not null references public.academic_sessions (id) on delete restrict,
  programme_id uuid not null references public.programmes (id) on delete restrict,
  term_id uuid not null references public.programme_terms (id) on delete restrict,
  title text not null,
  opens_on date not null,
  closes_on date not null,
  admission_fee numeric(12,2) not null default 0 check (admission_fee >= 0),
  seats integer check (seats > 0),
  eligibility_rules text,
  min_qualifying_percent numeric(5,2) check (min_qualifying_percent between 0 and 100),
  required_documents text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_on >= opens_on),
  unique (academic_session_id, programme_id, term_id)
);
create trigger admission_periods_updated_at before update on public.admission_periods
  for each row execute function public.set_updated_at();

create table public.admissions (
  id uuid primary key default gen_random_uuid(),
  application_no text not null unique,
  admission_period_id uuid not null references public.admission_periods (id) on delete restrict,
  applicant_name text not null check (length(trim(applicant_name)) > 1),
  date_of_birth date not null,
  gender public.gender not null default 'undisclosed',
  phone text not null,
  email extensions.citext,
  address text,
  guardian_name text,
  guardian_relationship text,
  guardian_phone text,
  previous_institution text,
  previous_board text,
  previous_exam text,
  previous_year integer check (previous_year between 1980 and 2100),
  previous_percentage numeric(5,2) check (previous_percentage between 0 and 100),
  preferred_offering_ids uuid[] not null default '{}',
  status public.admission_status not null default 'submitted',
  review_remarks text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  admission_fee_paid boolean not null default false,
  admission_fee_payment_id uuid,          -- FK added in fees migration
  student_id uuid references public.students (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index admissions_status_idx on public.admissions (status);
create index admissions_period_idx on public.admissions (admission_period_id);
create trigger admissions_updated_at before update on public.admissions
  for each row execute function public.set_updated_at();

create table public.admission_documents (
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references public.admissions (id) on delete cascade,
  document_name text not null,
  is_required boolean not null default true,
  submitted boolean not null default false,
  verified boolean not null default false,
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  file_document_id uuid,                  -- FK added in documents migration
  remarks text,
  created_at timestamptz not null default now(),
  unique (admission_id, document_name),
  check (not verified or submitted)
);

alter table public.admission_periods enable row level security;
alter table public.admissions enable row level security;
alter table public.admission_documents enable row level security;

create policy admission_periods_select on public.admission_periods for select to authenticated using (true);
create policy admission_periods_write on public.admission_periods for all to authenticated
  using ((select public.has_permission('admissions.manage'))) with check ((select public.has_permission('admissions.manage')));

create policy admissions_select on public.admissions for select to authenticated
  using ((select public.has_permission('admissions.view')));
create policy admissions_insert on public.admissions for insert to authenticated
  with check ((select public.has_permission('admissions.manage')) and status = 'submitted' and student_id is null);
-- Applicant details may be edited by admissions.manage until a decision is made.
-- Status changes go through review_admission(); conversion through convert_admission().
create policy admissions_update on public.admissions for update to authenticated
  using ((select public.has_permission('admissions.manage')) and status in ('submitted', 'under_review', 'waitlisted'))
  with check ((select public.has_permission('admissions.manage')) and status in ('submitted', 'under_review', 'waitlisted'));

revoke update on public.admissions from authenticated;
grant update (applicant_name, date_of_birth, gender, phone, email, address, guardian_name, guardian_relationship,
  guardian_phone, previous_institution, previous_board, previous_exam, previous_year, previous_percentage,
  preferred_offering_ids) on public.admissions to authenticated;

create policy admission_documents_select on public.admission_documents for select to authenticated
  using ((select public.has_permission('admissions.view')));
create policy admission_documents_insert on public.admission_documents for insert to authenticated
  with check ((select public.has_permission('admissions.manage')) and not verified);
-- Verification is done through verify_admission_document() so it is attributed.
create policy admission_documents_update on public.admission_documents for update to authenticated
  using ((select public.has_permission('admissions.manage'))) with check ((select public.has_permission('admissions.manage')));
revoke update on public.admission_documents from authenticated;
grant update (submitted, remarks, file_document_id) on public.admission_documents to authenticated;

create trigger audit_admissions after update on public.admissions
  for each row execute function public.audit_row_change();
create trigger audit_admission_documents after update on public.admission_documents
  for each row execute function public.audit_row_change();

-- Create an application with a generated number and its document checklist.
create or replace function public.create_admission(p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period public.admission_periods;
  v_prefix text;
  v_year integer;
  v_no text;
  v_id uuid;
begin
  if not (select public.has_permission('admissions.manage')) then
    raise exception 'Not authorised to create applications' using errcode = '42501';
  end if;
  select * into v_period from public.admission_periods where id = (p_data ->> 'admission_period_id')::uuid;
  if v_period.id is null then
    raise exception 'Admission period not found' using errcode = 'P0002';
  end if;
  if not v_period.is_active or current_date not between v_period.opens_on and v_period.closes_on then
    if not (select public.has_permission('admissions.review')) then
      raise exception 'The admission period is closed' using errcode = 'P0001';
    end if;
  end if;

  select application_no_prefix into v_prefix from public.institution_settings where id = 1;
  v_year := extract(year from current_date)::integer;
  v_no := format('%s/%s/%s', v_prefix, v_year, lpad(public.next_sequence_value('application:' || v_year)::text, 5, '0'));

  insert into public.admissions (application_no, admission_period_id, applicant_name, date_of_birth, gender, phone, email,
    address, guardian_name, guardian_relationship, guardian_phone, previous_institution, previous_board, previous_exam,
    previous_year, previous_percentage, preferred_offering_ids, created_by)
  values (
    v_no, v_period.id, trim(p_data ->> 'applicant_name'), (p_data ->> 'date_of_birth')::date,
    coalesce(nullif(p_data ->> 'gender', ''), 'undisclosed')::public.gender,
    trim(p_data ->> 'phone'), nullif(trim(p_data ->> 'email'), ''), nullif(trim(p_data ->> 'address'), ''),
    nullif(trim(p_data ->> 'guardian_name'), ''), nullif(trim(p_data ->> 'guardian_relationship'), ''),
    nullif(trim(p_data ->> 'guardian_phone'), ''), nullif(trim(p_data ->> 'previous_institution'), ''),
    nullif(trim(p_data ->> 'previous_board'), ''), nullif(trim(p_data ->> 'previous_exam'), ''),
    nullif(p_data ->> 'previous_year', '')::integer, nullif(p_data ->> 'previous_percentage', '')::numeric,
    coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_data -> 'preferred_offering_ids', '[]'::jsonb)) x), '{}'),
    (select auth.uid())
  )
  returning id into v_id;

  insert into public.admission_documents (admission_id, document_name, is_required)
  select v_id, d, true from unnest(v_period.required_documents) d
  on conflict do nothing;

  perform public.log_audit('admission.create', 'admissions', v_id::text, jsonb_build_object('application_no', v_no));
  return v_id;
end;
$$;
grant execute on function public.create_admission(jsonb) to authenticated;

create or replace function public.verify_admission_document(p_document_id uuid, p_verified boolean, p_remarks text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_permission('admissions.review')) then
    raise exception 'Not authorised to verify documents' using errcode = '42501';
  end if;
  update public.admission_documents
    set verified = p_verified,
        submitted = submitted or p_verified,
        verified_by = case when p_verified then (select auth.uid()) else null end,
        verified_at = case when p_verified then now() else null end,
        remarks = coalesce(p_remarks, remarks)
    where id = p_document_id;
  if not found then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;
end;
$$;
grant execute on function public.verify_admission_document(uuid, boolean, text) to authenticated;

-- Review decision. Approval requires every required document to be verified.
create or replace function public.review_admission(p_admission_id uuid, p_status public.admission_status, p_remarks text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.admission_status;
  v_period public.admission_periods;
  v_pct numeric;
begin
  if not (select public.has_permission('admissions.review')) then
    raise exception 'Not authorised to review applications' using errcode = '42501';
  end if;
  if p_status not in ('under_review', 'approved', 'waitlisted', 'rejected', 'withdrawn') then
    raise exception 'Invalid review status %', p_status using errcode = '22023';
  end if;

  select a.status, a.previous_percentage into v_current, v_pct from public.admissions a where a.id = p_admission_id for update;
  if v_current is null then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if v_current in ('admitted', 'rejected', 'withdrawn') then
    raise exception 'Application is already %', v_current using errcode = 'P0001';
  end if;
  if p_status in ('rejected', 'withdrawn', 'waitlisted') and nullif(trim(p_remarks), '') is null then
    raise exception 'Remarks are required for this decision' using errcode = '22023';
  end if;

  if p_status = 'approved' then
    if exists (select 1 from public.admission_documents d
               where d.admission_id = p_admission_id and d.is_required and not d.verified) then
      raise exception 'All required documents must be verified before approval' using errcode = 'P0001';
    end if;
    select ap.* into v_period from public.admission_periods ap
      join public.admissions a on a.admission_period_id = ap.id where a.id = p_admission_id;
    if v_period.min_qualifying_percent is not null and (v_pct is null or v_pct < v_period.min_qualifying_percent) then
      raise exception 'Applicant does not meet the minimum qualifying percentage (%)', v_period.min_qualifying_percent using errcode = 'P0001';
    end if;
  end if;

  update public.admissions
    set status = p_status, review_remarks = p_remarks, reviewed_by = (select auth.uid()), reviewed_at = now()
    where id = p_admission_id;
end;
$$;
grant execute on function public.review_admission(uuid, public.admission_status, text) to authenticated;
