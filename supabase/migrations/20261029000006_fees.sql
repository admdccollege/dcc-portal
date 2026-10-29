-- =============================================================================
-- DCC Portal — Fees, concessions, payments, receipts
-- =============================================================================
-- Financial integrity rules
-- * Completed payments are immutable. Mistakes are corrected by a reversal
--   (status → 'reversed' + payment_adjustments row), never by editing/deleting.
-- * Payments are recorded only through record_payment(), which locks the
--   student's fee assignment, prevents overpayment and issues a sequential
--   receipt number in the same transaction.
-- * Amount due for an assignment is derived (view student_fee_balances):
--     due = gross + charges − approved concessions − completed payments + refunds
--   Gross is snapshotted on assignment so later structure edits never rewrite
--   historical dues.
-- * No card or banking credentials are stored (reference numbers only).
-- =============================================================================

create type public.fee_category as enum
  ('admission', 'semester', 'tuition', 'laboratory', 'hostel', 'examination', 'fine', 'miscellaneous');
create type public.concession_status as enum ('pending', 'approved', 'rejected', 'revoked');
create type public.payment_status as enum ('completed', 'reversed');
create type public.adjustment_kind as enum ('reversal', 'refund', 'charge', 'fine', 'waiver');

create table public.fee_heads (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category public.fee_category not null,
  is_optional boolean not null default false,
  is_active boolean not null default true
);

create table public.payment_methods (
  code text primary key check (code ~ '^[a-z_]+$'),
  name text not null,
  requires_reference boolean not null default false,
  is_active boolean not null default true
);

create table public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  academic_session_id uuid not null references public.academic_sessions (id) on delete restrict,
  programme_id uuid not null references public.programmes (id) on delete restrict,
  term_id uuid references public.programme_terms (id) on delete restrict,
  name text not null,
  due_date date,
  late_fine_per_day numeric(10,2) not null default 0 check (late_fine_per_day >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_session_id, programme_id, term_id, name)
);
create trigger fee_structures_updated_at before update on public.fee_structures
  for each row execute function public.set_updated_at();

create table public.fee_structure_items (
  id uuid primary key default gen_random_uuid(),
  fee_structure_id uuid not null references public.fee_structures (id) on delete cascade,
  fee_head_id uuid not null references public.fee_heads (id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  unique (fee_structure_id, fee_head_id)
);

create table public.student_fee_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete restrict,
  fee_structure_id uuid not null references public.fee_structures (id) on delete restrict,
  enrolment_id uuid references public.student_enrolments (id) on delete set null,
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  items jsonb not null default '[]'::jsonb,         -- snapshot of heads and amounts
  due_date date,
  is_cancelled boolean not null default false,
  cancelled_reason text,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, fee_structure_id)
);
create index student_fee_assignments_student_idx on public.student_fee_assignments (student_id);

create table public.fee_concessions (
  id uuid primary key default gen_random_uuid(),
  student_fee_assignment_id uuid not null references public.student_fee_assignments (id) on delete restrict,
  kind text not null check (kind in ('scholarship', 'concession', 'waiver')),
  amount numeric(12,2) not null check (amount > 0),
  reason text not null,
  status public.concession_status not null default 'pending',
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_remarks text
);
create index fee_concessions_assignment_idx on public.fee_concessions (student_fee_assignment_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  student_id uuid not null references public.students (id) on delete restrict,
  student_fee_assignment_id uuid not null references public.student_fee_assignments (id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  method_code text not null references public.payment_methods (code) on delete restrict,
  reference_no text,
  remarks text,
  status public.payment_status not null default 'completed',
  received_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index payments_student_idx on public.payments (student_id);
create index payments_date_idx on public.payments (payment_date);
create index payments_assignment_idx on public.payments (student_fee_assignment_id);

create table public.payment_adjustments (
  id uuid primary key default gen_random_uuid(),
  student_fee_assignment_id uuid not null references public.student_fee_assignments (id) on delete restrict,
  payment_id uuid references public.payments (id) on delete restrict,
  kind public.adjustment_kind not null,
  amount numeric(12,2) not null check (amount > 0),
  reason text not null check (length(trim(reason)) > 2),
  authorized_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index payment_adjustments_assignment_idx on public.payment_adjustments (student_fee_assignment_id);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments (id) on delete restrict,
  receipt_no text not null unique,
  issued_by uuid references public.profiles (id) on delete set null,
  issued_at timestamptz not null default now(),
  print_count integer not null default 0,
  last_printed_at timestamptz
);

alter table public.admissions
  add constraint admissions_fee_payment_fk foreign key (admission_fee_payment_id) references public.payments (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Immutability of financial records
-- -----------------------------------------------------------------------------
create or replace function public.protect_payments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
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
create trigger payments_protect before update or delete on public.payments
  for each row execute function public.protect_payments();

create or replace function public.protect_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% records are append-only', tg_table_name using errcode = 'P0001';
end;
$$;
create trigger payment_adjustments_protect before update or delete on public.payment_adjustments
  for each row execute function public.protect_append_only();
create trigger audit_logs_protect before update or delete on public.audit_logs
  for each row execute function public.protect_append_only();
create trigger mark_revisions_protect before update or delete on public.mark_revisions
  for each row execute function public.protect_append_only();

-- Assignment amounts may not change after creation (cancel and reassign instead).
create or replace function public.protect_fee_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Fee assignments cannot be deleted; cancel instead' using errcode = 'P0001';
  end if;
  if new.gross_amount <> old.gross_amount or new.items <> old.items or new.student_id <> old.student_id
     or new.fee_structure_id <> old.fee_structure_id then
    raise exception 'Fee assignment amounts are immutable; cancel and reassign instead' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger student_fee_assignments_protect before update or delete on public.student_fee_assignments
  for each row execute function public.protect_fee_assignment();

create trigger audit_payments after insert or update on public.payments
  for each row execute function public.audit_row_change();
create trigger audit_payment_adjustments after insert on public.payment_adjustments
  for each row execute function public.audit_row_change();
create trigger audit_fee_concessions after insert or update on public.fee_concessions
  for each row execute function public.audit_row_change();
create trigger audit_fee_assignments after insert or update on public.student_fee_assignments
  for each row execute function public.audit_row_change();
create trigger audit_fee_structure_items after insert or update or delete on public.fee_structure_items
  for each row execute function public.audit_row_change();

-- -----------------------------------------------------------------------------
-- Balances (security_invoker: callers see only rows RLS allows)
-- -----------------------------------------------------------------------------
create view public.student_fee_balances
with (security_invoker = true)
as
select
  a.id as assignment_id,
  a.student_id,
  a.fee_structure_id,
  fs.name as fee_structure_name,
  fs.academic_session_id,
  fs.programme_id,
  fs.term_id,
  a.gross_amount,
  coalesce(ch.total, 0)::numeric(12,2) as charges,
  coalesce(cn.total, 0)::numeric(12,2) as concessions,
  coalesce(pm.total, 0)::numeric(12,2) as paid,
  coalesce(rf.total, 0)::numeric(12,2) as refunded,
  (a.gross_amount + coalesce(ch.total, 0) - coalesce(cn.total, 0) - coalesce(pm.total, 0) + coalesce(rf.total, 0))::numeric(12,2) as balance,
  a.due_date,
  (a.due_date is not null and a.due_date < current_date
    and (a.gross_amount + coalesce(ch.total, 0) - coalesce(cn.total, 0) - coalesce(pm.total, 0) + coalesce(rf.total, 0)) > 0) as is_overdue,
  a.is_cancelled,
  a.created_at
from public.student_fee_assignments a
join public.fee_structures fs on fs.id = a.fee_structure_id
left join lateral (select sum(amount) total from public.payment_adjustments x
                   where x.student_fee_assignment_id = a.id and x.kind in ('charge', 'fine')) ch on true
left join lateral (select sum(amount) total from public.fee_concessions x
                   where x.student_fee_assignment_id = a.id and x.status = 'approved') cn on true
left join lateral (select sum(amount) total from public.payments x
                   where x.student_fee_assignment_id = a.id and x.status = 'completed') pm on true
left join lateral (select sum(amount) total from public.payment_adjustments x
                   where x.student_fee_assignment_id = a.id and x.kind = 'refund') rf on true;

-- Waivers reduce the balance like an approved concession; they are recorded
-- as approved fee_concessions of kind 'waiver' (with authorisation) so the
-- view stays a single source of truth.

-- Internal balance helper used inside locked transactions.
create or replace function public.fee_assignment_balance(p_assignment_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select a.gross_amount
    + coalesce((select sum(amount) from public.payment_adjustments x where x.student_fee_assignment_id = a.id and x.kind in ('charge', 'fine')), 0)
    - coalesce((select sum(amount) from public.fee_concessions x where x.student_fee_assignment_id = a.id and x.status = 'approved'), 0)
    - coalesce((select sum(amount) from public.payments x where x.student_fee_assignment_id = a.id and x.status = 'completed'), 0)
    + coalesce((select sum(amount) from public.payment_adjustments x where x.student_fee_assignment_id = a.id and x.kind = 'refund'), 0)
  from public.student_fee_assignments a where a.id = p_assignment_id;
$$;
revoke execute on function public.fee_assignment_balance(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.fee_heads enable row level security;
alter table public.payment_methods enable row level security;
alter table public.fee_structures enable row level security;
alter table public.fee_structure_items enable row level security;
alter table public.student_fee_assignments enable row level security;
alter table public.fee_concessions enable row level security;
alter table public.payments enable row level security;
alter table public.payment_adjustments enable row level security;
alter table public.receipts enable row level security;

create policy fee_heads_select on public.fee_heads for select to authenticated using (true);
create policy fee_heads_write on public.fee_heads for all to authenticated
  using ((select public.has_permission('fees.manage'))) with check ((select public.has_permission('fees.manage')));
create policy payment_methods_select on public.payment_methods for select to authenticated using (true);
create policy payment_methods_write on public.payment_methods for all to authenticated
  using ((select public.has_permission('fees.manage'))) with check ((select public.has_permission('fees.manage')));

create policy fee_structures_select on public.fee_structures for select to authenticated using (true);
create policy fee_structures_write on public.fee_structures for all to authenticated
  using ((select public.has_permission('fees.manage'))) with check ((select public.has_permission('fees.manage')));
create policy fee_structure_items_select on public.fee_structure_items for select to authenticated using (true);
create policy fee_structure_items_write on public.fee_structure_items for all to authenticated
  using ((select public.has_permission('fees.manage'))) with check ((select public.has_permission('fees.manage')));

create policy student_fee_assignments_select on public.student_fee_assignments for select to authenticated
  using ((select public.has_permission('fees.view')) or student_id = (select public.current_student_id()));
-- Inserts via assign_fee_structure(); cancellation via cancel_fee_assignment().

create policy fee_concessions_select on public.fee_concessions for select to authenticated
  using ((select public.has_permission('fees.view')) or exists (
    select 1 from public.student_fee_assignments a where a.id = student_fee_assignment_id
      and a.student_id = (select public.current_student_id())));

create policy payments_select on public.payments for select to authenticated
  using ((select public.has_permission('fees.view')) or student_id = (select public.current_student_id()));
create policy payment_adjustments_select on public.payment_adjustments for select to authenticated
  using ((select public.has_permission('fees.view')) or exists (
    select 1 from public.student_fee_assignments a where a.id = student_fee_assignment_id
      and a.student_id = (select public.current_student_id())));
create policy receipts_select on public.receipts for select to authenticated
  using ((select public.has_permission('fees.view')) or exists (
    select 1 from public.payments p where p.id = payment_id and p.student_id = (select public.current_student_id())));

grant select on public.student_fee_balances to authenticated;

-- -----------------------------------------------------------------------------
-- Fee workflow functions
-- -----------------------------------------------------------------------------
-- Assign a fee structure to students (snapshotting items). Returns count created.
create or replace function public.assign_fee_structure(p_fee_structure_id uuid, p_student_ids uuid[], p_optional_head_ids uuid[] default '{}')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fs public.fee_structures;
  v_items jsonb;
  v_gross numeric;
  v_n integer;
begin
  if not (select public.has_permission('fees.manage')) then
    raise exception 'Not authorised to assign fees' using errcode = '42501';
  end if;
  select * into v_fs from public.fee_structures where id = p_fee_structure_id;
  if v_fs.id is null or not v_fs.is_active then
    raise exception 'Fee structure not found or inactive' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('fee_head_id', h.id, 'code', h.code, 'name', h.name,
           'category', h.category, 'amount', i.amount) order by h.code), '[]'::jsonb),
         coalesce(sum(i.amount), 0)
    into v_items, v_gross
  from public.fee_structure_items i join public.fee_heads h on h.id = i.fee_head_id
  where i.fee_structure_id = p_fee_structure_id
    and (not h.is_optional or h.id = any (coalesce(p_optional_head_ids, '{}')));

  insert into public.student_fee_assignments (student_id, fee_structure_id, enrolment_id, gross_amount, items, due_date, assigned_by)
  select s.id, v_fs.id,
         (select e.id from public.student_enrolments e where e.student_id = s.id and e.status = 'active' limit 1),
         v_gross, v_items, v_fs.due_date, (select auth.uid())
  from public.students s
  where s.id = any (p_student_ids) and s.status = 'active'
  on conflict (student_id, fee_structure_id) do nothing;
  get diagnostics v_n = row_count;

  perform public.log_audit('fees.assign', 'fee_structures', p_fee_structure_id::text,
    jsonb_build_object('students', v_n, 'gross', v_gross));
  return v_n;
end;
$$;
grant execute on function public.assign_fee_structure(uuid, uuid[], uuid[]) to authenticated;

create or replace function public.cancel_fee_assignment(p_assignment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_permission('fees.manage')) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  if exists (select 1 from public.payments where student_fee_assignment_id = p_assignment_id and status = 'completed') then
    raise exception 'Reverse all payments before cancelling this assignment' using errcode = 'P0001';
  end if;
  update public.student_fee_assignments set is_cancelled = true, cancelled_reason = p_reason where id = p_assignment_id;
end;
$$;
grant execute on function public.cancel_fee_assignment(uuid, text) to authenticated;

-- Financial-year aware sequential receipt number: RCPT/2026-27/000123
create or replace function public.next_receipt_no(p_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_start_month integer;
  v_fy_start integer;
  v_fy text;
begin
  select receipt_no_prefix, financial_year_start_month into v_prefix, v_start_month
  from public.institution_settings where id = 1;
  v_fy_start := case when extract(month from p_date) >= v_start_month
                     then extract(year from p_date)::integer else extract(year from p_date)::integer - 1 end;
  v_fy := v_fy_start || '-' || lpad(((v_fy_start + 1) % 100)::text, 2, '0');
  return format('%s/%s/%s', v_prefix, v_fy, lpad(public.next_sequence_value('receipt:' || v_fy)::text, 6, '0'));
end;
$$;
revoke execute on function public.next_receipt_no(date) from public, anon, authenticated;

create or replace function public.record_payment(
  p_assignment_id uuid,
  p_amount numeric,
  p_method_code text,
  p_payment_date date default current_date,
  p_reference_no text default null,
  p_remarks text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.student_fee_assignments;
  v_method public.payment_methods;
  v_balance numeric;
  v_receipt text;
  v_payment_id uuid;
begin
  if not (select public.has_permission('payments.record')) then
    raise exception 'Not authorised to record payments' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Payment amount must be a positive value with at most two decimals' using errcode = '22023';
  end if;
  if p_payment_date > current_date then
    raise exception 'Payment date cannot be in the future' using errcode = '22023';
  end if;

  -- Lock the assignment row: concurrent payments on the same dues serialise here.
  select * into v_assignment from public.student_fee_assignments where id = p_assignment_id for update;
  if v_assignment.id is null then
    raise exception 'Fee assignment not found' using errcode = 'P0002';
  end if;
  if v_assignment.is_cancelled then
    raise exception 'Fee assignment is cancelled' using errcode = 'P0001';
  end if;

  select * into v_method from public.payment_methods where code = p_method_code and is_active;
  if v_method.code is null then
    raise exception 'Invalid payment method' using errcode = '22023';
  end if;
  if v_method.requires_reference and nullif(trim(p_reference_no), '') is null then
    raise exception 'A reference number is required for %', v_method.name using errcode = '22023';
  end if;

  v_balance := public.fee_assignment_balance(p_assignment_id);
  if p_amount > v_balance then
    raise exception 'Payment of % exceeds the outstanding balance of %', p_amount, v_balance using errcode = 'P0001';
  end if;

  v_receipt := public.next_receipt_no(p_payment_date);

  insert into public.payments (receipt_no, student_id, student_fee_assignment_id, amount, payment_date, method_code,
    reference_no, remarks, received_by)
  values (v_receipt, v_assignment.student_id, p_assignment_id, p_amount, p_payment_date, p_method_code,
    nullif(trim(p_reference_no), ''), nullif(trim(p_remarks), ''), (select auth.uid()))
  returning id into v_payment_id;

  insert into public.receipts (payment_id, receipt_no, issued_by) values (v_payment_id, v_receipt, (select auth.uid()));
  return v_payment_id;
end;
$$;
grant execute on function public.record_payment(uuid, numeric, text, date, text, text) to authenticated;

create or replace function public.reverse_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
begin
  if not (select public.has_permission('payments.reverse')) then
    raise exception 'Not authorised to reverse payments' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null or length(trim(p_reason)) < 5 then
    raise exception 'A reason (at least 5 characters) is required' using errcode = '22023';
  end if;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if v_payment.id is null then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if v_payment.status <> 'completed' then
    raise exception 'Payment is already reversed' using errcode = 'P0001';
  end if;
  perform 1 from public.student_fee_assignments where id = v_payment.student_fee_assignment_id for update;

  perform set_config('dcc.allow_payment_reversal', 'on', true);
  update public.payments set status = 'reversed' where id = p_payment_id;
  perform set_config('dcc.allow_payment_reversal', 'off', true);

  insert into public.payment_adjustments (student_fee_assignment_id, payment_id, kind, amount, reason, authorized_by)
  values (v_payment.student_fee_assignment_id, p_payment_id, 'reversal', v_payment.amount, p_reason, (select auth.uid()));
end;
$$;
grant execute on function public.reverse_payment(uuid, text) to authenticated;

-- Charges, fines and refunds (refund cannot exceed net amount paid).
create or replace function public.record_fee_adjustment(p_assignment_id uuid, p_kind public.adjustment_kind, p_amount numeric, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_paid numeric;
  v_refunded numeric;
begin
  if p_kind in ('reversal', 'waiver') then
    raise exception 'Use reverse_payment() for reversals and concessions for waivers' using errcode = '22023';
  end if;
  if p_kind = 'refund' and not (select public.has_permission('payments.reverse')) then
    raise exception 'Not authorised to record refunds' using errcode = '42501';
  end if;
  if p_kind in ('charge', 'fine') and not (select public.has_permission('fees.manage')) then
    raise exception 'Not authorised to add charges' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive' using errcode = '22023';
  end if;
  perform 1 from public.student_fee_assignments where id = p_assignment_id and not is_cancelled for update;
  if not found then
    raise exception 'Fee assignment not found or cancelled' using errcode = 'P0002';
  end if;
  if p_kind = 'refund' then
    select coalesce(sum(amount), 0) into v_paid from public.payments where student_fee_assignment_id = p_assignment_id and status = 'completed';
    select coalesce(sum(amount), 0) into v_refunded from public.payment_adjustments where student_fee_assignment_id = p_assignment_id and kind = 'refund';
    if p_amount > v_paid - v_refunded then
      raise exception 'Refund exceeds the net amount paid (%)', v_paid - v_refunded using errcode = 'P0001';
    end if;
  end if;
  insert into public.payment_adjustments (student_fee_assignment_id, kind, amount, reason, authorized_by)
  values (p_assignment_id, p_kind, p_amount, p_reason, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.record_fee_adjustment(uuid, public.adjustment_kind, numeric, text) to authenticated;

create or replace function public.request_concession(p_assignment_id uuid, p_kind text, p_amount numeric, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (select public.has_any_permission(array['fees.manage', 'concessions.approve'])) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  insert into public.fee_concessions (student_fee_assignment_id, kind, amount, reason, requested_by)
  values (p_assignment_id, p_kind, p_amount, p_reason, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.request_concession(uuid, text, numeric, text) to authenticated;

create or replace function public.decide_concession(p_concession_id uuid, p_approve boolean, p_remarks text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.fee_concessions;
  v_balance numeric;
begin
  if not (select public.has_permission('concessions.approve')) then
    raise exception 'Not authorised to approve concessions' using errcode = '42501';
  end if;
  select * into v_c from public.fee_concessions where id = p_concession_id for update;
  if v_c.id is null then raise exception 'Concession not found' using errcode = 'P0002'; end if;
  if v_c.status <> 'pending' then raise exception 'Concession already decided' using errcode = 'P0001'; end if;
  if v_c.requested_by = (select auth.uid()) and not (select public.has_role('super_admin')) then
    raise exception 'A concession must be approved by someone other than the requester' using errcode = '42501';
  end if;
  if p_approve then
    perform 1 from public.student_fee_assignments where id = v_c.student_fee_assignment_id for update;
    v_balance := public.fee_assignment_balance(v_c.student_fee_assignment_id);
    if v_c.amount > v_balance then
      raise exception 'Concession of % exceeds the outstanding balance of %', v_c.amount, v_balance using errcode = 'P0001';
    end if;
  end if;
  update public.fee_concessions
    set status = case when p_approve then 'approved'::public.concession_status else 'rejected'::public.concession_status end,
        decided_by = (select auth.uid()), decided_at = now(), decision_remarks = p_remarks
    where id = p_concession_id;
end;
$$;
grant execute on function public.decide_concession(uuid, boolean, text) to authenticated;

create or replace function public.mark_receipt_printed(p_payment_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.receipts set print_count = print_count + 1, last_printed_at = now()
  where payment_id = p_payment_id
    and ((select public.has_permission('fees.view')) or exists (
      select 1 from public.payments p where p.id = p_payment_id and p.student_id = (select public.current_student_id())));
$$;
grant execute on function public.mark_receipt_printed(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Admission conversion (needs fees for the admission fee)
-- -----------------------------------------------------------------------------
-- Converts an approved application into a student, assigns the admission fee
-- (from the admission period) and optionally records its payment — atomically.
create or replace function public.convert_admission(
  p_admission_id uuid,
  p_roll_no text default null,
  p_payment jsonb default null       -- {"amount": 1500, "method_code": "cash", "reference_no": null}
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.admissions;
  v_period public.admission_periods;
  v_student_id uuid;
  v_fs_id uuid;
  v_head_id uuid;
  v_assignment_id uuid;
  v_payment_id uuid;
begin
  if not (select public.has_permission('admissions.convert')) then
    raise exception 'Not authorised to admit applicants' using errcode = '42501';
  end if;
  select * into v_a from public.admissions where id = p_admission_id for update;
  if v_a.id is null then raise exception 'Application not found' using errcode = 'P0002'; end if;
  if v_a.status <> 'approved' then
    raise exception 'Only approved applications can be converted (current: %)', v_a.status using errcode = 'P0001';
  end if;
  select * into v_period from public.admission_periods where id = v_a.admission_period_id;

  v_student_id := public.create_student(
    jsonb_build_object('full_name', v_a.applicant_name, 'date_of_birth', v_a.date_of_birth, 'gender', v_a.gender,
      'phone', v_a.phone, 'email', v_a.email, 'address', v_a.address, 'admission_date', current_date),
    jsonb_build_object('name', v_a.guardian_name, 'relationship', v_a.guardian_relationship, 'phone', v_a.guardian_phone),
    jsonb_build_object('academic_session_id', v_period.academic_session_id, 'programme_id', v_period.programme_id,
      'term_id', v_period.term_id, 'roll_no', p_roll_no),
    v_a.preferred_offering_ids
  );

  if v_period.admission_fee > 0 then
    select id into v_head_id from public.fee_heads where category = 'admission' and is_active order by code limit 1;
    if v_head_id is null then
      raise exception 'Configure an active fee head with category "admission" first' using errcode = 'P0001';
    end if;
    insert into public.fee_structures (academic_session_id, programme_id, term_id, name, due_date)
    values (v_period.academic_session_id, v_period.programme_id, v_period.term_id, 'Admission Fee', v_period.closes_on)
    on conflict (academic_session_id, programme_id, term_id, name) do update set name = excluded.name
    returning id into v_fs_id;
    insert into public.fee_structure_items (fee_structure_id, fee_head_id, amount)
    values (v_fs_id, v_head_id, v_period.admission_fee)
    on conflict (fee_structure_id, fee_head_id) do nothing;

    insert into public.student_fee_assignments (student_id, fee_structure_id, enrolment_id, gross_amount, items, due_date, assigned_by)
    select v_student_id, v_fs_id, (select id from public.student_enrolments where student_id = v_student_id and status = 'active'),
           v_period.admission_fee,
           jsonb_build_array(jsonb_build_object('fee_head_id', v_head_id, 'name', 'Admission Fee', 'category', 'admission', 'amount', v_period.admission_fee)),
           v_period.closes_on, (select auth.uid())
    returning id into v_assignment_id;

    if p_payment is not null and (p_payment ->> 'amount') is not null then
      v_payment_id := public.record_payment(v_assignment_id, (p_payment ->> 'amount')::numeric, p_payment ->> 'method_code',
        current_date, p_payment ->> 'reference_no', 'Admission fee');
    end if;
  end if;

  update public.admissions
    set status = 'admitted', student_id = v_student_id,
        admission_fee_payment_id = v_payment_id, admission_fee_paid = (v_payment_id is not null or v_period.admission_fee = 0)
    where id = p_admission_id;

  perform public.log_audit('admission.convert', 'admissions', p_admission_id::text,
    jsonb_build_object('student_id', v_student_id, 'payment_id', v_payment_id));
  return v_student_id;
end;
$$;
grant execute on function public.convert_admission(uuid, text, jsonb) to authenticated;
