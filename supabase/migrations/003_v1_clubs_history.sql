-- ============================================================================
-- 003_v1_clubs_history.sql
-- Adds: clubs table, club_id on events/expenses, undo-review, audit log,
--       club-aware SQL aggregate functions.
-- Safe to run once on top of 001 and 002.
-- Wrapped in a transaction so any failure rolls everything back.
-- ============================================================================

BEGIN;

-- ============ 1. CLUBS TABLE ============

create table if not exists public.clubs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- Seed the three clubs (idempotent)
insert into public.clubs (name) values
  ('Digital VJTI'),
  ('GDG'),
  ('TEDxVJTI Mumbai')
on conflict (name) do nothing;

-- RLS: authenticated users can SELECT; no client insert/update/delete
alter table public.clubs enable row level security;

create policy "clubs_select_authenticated" on public.clubs
  for select to authenticated
  using (true);

-- ============ 2. events: add club_id ============

-- Add nullable first so existing rows don't break
alter table public.events
  add column if not exists club_id uuid references public.clubs (id) on delete restrict;

-- Backfill existing events → Digital VJTI
update public.events
   set club_id = (select id from public.clubs where name = 'Digital VJTI')
 where club_id is null;

-- Now enforce NOT NULL
alter table public.events
  alter column club_id set not null;

-- Replace global unique(name) with unique(club_id, name)
alter table public.events
  drop constraint if exists events_name_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'events_club_name_key'
       and conrelid = 'public.events'::regclass
  ) then
    alter table public.events add constraint events_club_name_key unique (club_id, name);
  end if;
end;
$$;

-- ============ 3. expenses: add club_id, revert_reason, indexes ============

alter table public.expenses
  add column if not exists club_id      uuid references public.clubs (id) on delete restrict,
  add column if not exists revert_reason text;

-- Backfill existing expenses → Digital VJTI
update public.expenses
   set club_id = (select id from public.clubs where name = 'Digital VJTI')
 where club_id is null;

alter table public.expenses
  alter column club_id set not null;

create index if not exists expenses_club_idx on public.expenses (club_id);

-- ============ 4. Replace insert policy (club + event consistency) ============

drop policy if exists "expenses_insert_own_pending" on public.expenses;

create policy "expenses_insert_own_pending" on public.expenses
  for insert to authenticated
  with check (
    user_id   = auth.uid()
    and status       = 'pending'
    and reviewed_by  is null
    and reviewed_at  is null
    and reject_reason is null
    and bill_path ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$')
    and exists (
      select 1
        from public.events ev
       where ev.id        = public.expenses.event_id
         and ev.is_active = true
         and ev.club_id   = public.expenses.club_id
    )
  );

-- ============ 5. Replace guard_expense_update() ============

create or replace function public.guard_expense_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- SQL editor / owner bypass
  if auth.uid() is null then
    return new;
  end if;

  -- Immutable columns (common to all transitions)
  if new.user_id       is distinct from old.user_id
  or new.club_id       is distinct from old.club_id
  or new.event_id      is distinct from old.event_id
  or new.amount        is distinct from old.amount
  or new.title         is distinct from old.title
  or new.description   is distinct from old.description
  or new.expense_date  is distinct from old.expense_date
  or new.bill_path     is distinct from old.bill_path
  or new.created_at    is distinct from old.created_at then
    raise exception 'Immutable fields cannot be changed';
  end if;

  -- Transition A: review (pending → approved | rejected)
  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    if new.status = 'rejected' then
      if new.reject_reason is null or length(trim(new.reject_reason)) = 0 then
        raise exception 'A reject reason is required';
      end if;
    else
      -- approving: clear reject_reason
      new.reject_reason := null;
    end if;
    new.reviewed_by   := auth.uid();
    new.reviewed_at   := now();
    new.revert_reason := null;
    return new;
  end if;

  -- Transition B: undo review (approved | rejected → pending)
  if old.status in ('approved', 'rejected') and new.status = 'pending' then
    if new.revert_reason is null or length(trim(new.revert_reason)) = 0 then
      raise exception 'A revert reason is required to undo a review';
    end if;
    new.reviewed_by  := null;
    new.reviewed_at  := null;
    new.reject_reason := null;
    -- revert_reason stays on the row (already set by caller)
    return new;
  end if;

  -- Anything else is invalid
  raise exception 'Invalid status change. Undo the review first.';
end;
$$;

-- ============ 6. AUDIT LOG ============

create table if not exists public.expense_audit_log (
  id           bigint generated always as identity primary key,
  expense_id   uuid        not null,
  club_id      uuid        not null,
  student_id   uuid        not null,
  actor_id     uuid,
  actor_name   text,
  actor_email  text,
  action       text        not null check (action in ('uploaded','approved','rejected','review_reverted')),
  from_status  text,
  to_status    text,
  amount       numeric(12,2),
  title        text,
  reason       text,
  created_at   timestamptz not null default now()
);

-- No foreign keys (intentional — supports owner cleanup without cascades)
create index if not exists audit_created_idx    on public.expense_audit_log (created_at desc);
create index if not exists audit_club_idx       on public.expense_audit_log (club_id);
create index if not exists audit_expense_idx    on public.expense_audit_log (expense_id);
create index if not exists audit_student_idx    on public.expense_audit_log (student_id);

alter table public.expense_audit_log enable row level security;

-- Admins can read; nobody can write from the client
create policy "audit_select_admin" on public.expense_audit_log
  for select to authenticated
  using (public.is_admin());

-- ─── Trigger: log INSERT (student uploads) ───────────────────────────────────

create or replace function public.log_expense_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name  text;
  v_actor_email text;
begin
  select full_name, email
    into v_actor_name, v_actor_email
    from public.profiles
   where id = new.user_id;

  insert into public.expense_audit_log
    (expense_id, club_id, student_id, actor_id, actor_name, actor_email,
     action, from_status, to_status, amount, title, reason, created_at)
  values
    (new.id, new.club_id, new.user_id,
     new.user_id, v_actor_name, v_actor_email,
     'uploaded', null, 'pending',
     new.amount, new.title, null,
     new.created_at);

  return new;
end;
$$;

drop trigger if exists expenses_after_insert_audit on public.expenses;
create trigger expenses_after_insert_audit
  after insert on public.expenses
  for each row execute function public.log_expense_insert();

-- ─── Trigger: log UPDATE (review / undo) ─────────────────────────────────────

create or replace function public.log_expense_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name  text;
  v_actor_email text;
  v_action      text;
  v_reason      text;
begin
  -- Only log status transitions
  if old.status = new.status then
    return new;
  end if;

  -- Determine action
  if old.status = 'pending' and new.status = 'approved' then
    v_action := 'approved';
    v_reason := null;
  elsif old.status = 'pending' and new.status = 'rejected' then
    v_action := 'rejected';
    v_reason := new.reject_reason;
  elsif old.status in ('approved', 'rejected') and new.status = 'pending' then
    v_action := 'review_reverted';
    v_reason := new.revert_reason;
  else
    return new;
  end if;

  -- Snapshot actor (may be null for owner operations)
  if auth.uid() is not null then
    select full_name, email
      into v_actor_name, v_actor_email
      from public.profiles
     where id = auth.uid();
  end if;

  insert into public.expense_audit_log
    (expense_id, club_id, student_id, actor_id, actor_name, actor_email,
     action, from_status, to_status, amount, title, reason)
  values
    (new.id, new.club_id, new.user_id,
     auth.uid(), v_actor_name, v_actor_email,
     v_action, old.status::text, new.status::text,
     new.amount, new.title, v_reason);

  return new;
end;
$$;

drop trigger if exists expenses_after_update_audit on public.expenses;
create trigger expenses_after_update_audit
  after update on public.expenses
  for each row execute function public.log_expense_update();

-- ─── Backfill audit log for existing data ────────────────────────────────────

-- 'uploaded' row per existing expense (created_at = expense created_at)
insert into public.expense_audit_log
  (expense_id, club_id, student_id, actor_id, actor_name, actor_email,
   action, from_status, to_status, amount, title, reason, created_at)
select
  e.id,
  e.club_id,
  e.user_id,
  e.user_id,
  p.full_name,
  p.email,
  'uploaded',
  null,
  'pending',
  e.amount,
  e.title,
  null,
  e.created_at
from public.expenses e
join public.profiles p on p.id = e.user_id
where not exists (
  select 1 from public.expense_audit_log al
   where al.expense_id = e.id and al.action = 'uploaded'
);

-- 'approved' or 'rejected' rows for already-reviewed expenses
insert into public.expense_audit_log
  (expense_id, club_id, student_id, actor_id, actor_name, actor_email,
   action, from_status, to_status, amount, title, reason, created_at)
select
  e.id,
  e.club_id,
  e.user_id,
  e.reviewed_by,
  rp.full_name,
  rp.email,
  e.status::text,
  'pending',
  e.status::text,
  e.amount,
  e.title,
  e.reject_reason,
  coalesce(e.reviewed_at, e.created_at)
from public.expenses e
left join public.profiles rp on rp.id = e.reviewed_by
where e.status in ('approved', 'rejected')
  and not exists (
    select 1 from public.expense_audit_log al
     where al.expense_id = e.id and al.action = e.status::text
  );

-- ============ 7. Club-aware aggregate SQL FUNCTIONS ============

-- Drop old views first (may not exist if 002 already dropped v_kpis)
drop view if exists public.v_kpis cascade;
drop view if exists public.v_spend_by_student cascade;
drop view if exists public.v_spend_by_event cascade;
drop view if exists public.v_spend_by_month cascade;

-- ─── kpi_summary ─────────────────────────────────────────────────────────────

create or replace function public.kpi_summary(p_club_id uuid default null)
returns table (
  approved_total  numeric,
  approved_count  bigint,
  pending_count   bigint,
  pending_amount  numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(sum(case when status = 'approved' then amount else 0 end), 0) as approved_total,
    coalesce(count(case when status = 'approved' then 1 end), 0)          as approved_count,
    coalesce(count(case when status = 'pending'  then 1 end), 0)          as pending_count,
    coalesce(sum(case when status = 'pending'  then amount else 0 end), 0) as pending_amount
  from public.expenses
  where (p_club_id is null or club_id = p_club_id);
$$;

-- ─── spend_by_student ─────────────────────────────────────────────────────────

create or replace function public.spend_by_student(p_club_id uuid default null)
returns table (
  user_id        uuid,
  full_name      text,
  email          text,
  approved_count bigint,
  approved_total numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id            as user_id,
    p.full_name,
    p.email,
    count(e.id)                        as approved_count,
    coalesce(sum(e.amount), 0)         as approved_total
  from public.profiles p
  left join public.expenses e
    on e.user_id  = p.id
   and e.status   = 'approved'
   and (p_club_id is null or e.club_id = p_club_id)
  where p.role = 'student'
  group by p.id, p.full_name, p.email;
$$;

-- ─── spend_by_event ─────────────────────────────────────────────────────────

create or replace function public.spend_by_event(p_club_id uuid default null)
returns table (
  event_id       uuid,
  event_name     text,
  club_name      text,
  approved_count bigint,
  approved_total numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    ev.id           as event_id,
    ev.name         as event_name,
    c.name          as club_name,
    count(e.id)                    as approved_count,
    coalesce(sum(e.amount), 0)     as approved_total
  from public.events ev
  join public.clubs c on c.id = ev.club_id
  left join public.expenses e
    on e.event_id = ev.id
   and e.status   = 'approved'
  where (p_club_id is null or ev.club_id = p_club_id)
  group by ev.id, ev.name, c.name;
$$;

-- ─── spend_by_month ──────────────────────────────────────────────────────────

create or replace function public.spend_by_month(p_club_id uuid default null)
returns table (
  month          date,
  approved_total numeric,
  approved_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    date_trunc('month', expense_date)::date as month,
    sum(amount)                             as approved_total,
    count(*)                                as approved_count
  from public.expenses
  where status = 'approved'
    and (p_club_id is null or club_id = p_club_id)
  group by 1
  order by 1;
$$;

-- ─── spend_by_club ───────────────────────────────────────────────────────────

create or replace function public.spend_by_club()
returns table (
  club_id        uuid,
  club_name      text,
  approved_count bigint,
  approved_total numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id            as club_id,
    c.name          as club_name,
    count(e.id)                    as approved_count,
    coalesce(sum(e.amount), 0)     as approved_total
  from public.clubs c
  left join public.expenses e
    on e.club_id = c.id
   and e.status  = 'approved'
  group by c.id, c.name;
$$;

-- Grant EXECUTE to authenticated users
grant execute on function public.kpi_summary(uuid)      to authenticated;
grant execute on function public.spend_by_student(uuid) to authenticated;
grant execute on function public.spend_by_event(uuid)   to authenticated;
grant execute on function public.spend_by_month(uuid)   to authenticated;
grant execute on function public.spend_by_club()        to authenticated;

COMMIT;
