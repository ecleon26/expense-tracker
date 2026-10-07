-- Club Budget Tracker: initial schema
-- Run in Supabase Dashboard > SQL Editor (as a single script).

-- ============ ENUMS ============
create type public.user_role as enum ('student', 'admin');
create type public.expense_status as enum ('pending', 'approved', 'rejected');

-- ============ TABLES ============
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  event_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  event_id uuid not null references public.events (id) on delete restrict,
  title text not null check (char_length(title) between 1 and 120),
  description text,
  amount numeric(12, 2) not null check (amount > 0),
  expense_date date not null,
  bill_path text not null,
  status public.expense_status not null default 'pending',
  reject_reason text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index expenses_user_idx on public.expenses (user_id);
create index expenses_status_idx on public.expenses (status);
create index expenses_event_idx on public.expenses (event_id);

-- ============ HELPERS ============
-- security definer avoids recursive RLS when policies check the admin role
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Create a student profile automatically on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    'student'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only review fields may change after submission; reject needs a reason
create or replace function public.guard_expense_update()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.event_id is distinct from old.event_id
     or new.amount is distinct from old.amount
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.expense_date is distinct from old.expense_date
     or new.bill_path is distinct from old.bill_path
     or new.created_at is distinct from old.created_at then
    raise exception 'Only review fields (status, reject_reason) can be changed';
  end if;

  if new.status = 'rejected'
     and (new.reject_reason is null or length(trim(new.reject_reason)) = 0) then
    raise exception 'A reject reason is required';
  end if;

  new.reviewed_by := auth.uid();
  new.reviewed_at := now();
  return new;
end;
$$;

create trigger expenses_guard_update
  before update on public.expenses
  for each row execute function public.guard_expense_update();

-- ============ ROW LEVEL SECURITY ============
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.expenses enable row level security;

-- profiles: read own row (admin reads all). No client-side update/insert/delete,
-- so nobody can change their own role.
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- events: everyone logged in can read; only admins write
create policy "events_select_all" on public.events
  for select to authenticated
  using (true);

create policy "events_insert_admin" on public.events
  for insert to authenticated
  with check (public.is_admin());

create policy "events_update_admin" on public.events
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- expenses
create policy "expenses_select_own_or_admin" on public.expenses
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "expenses_insert_own_pending" on public.expenses
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and reject_reason is null
  );

create policy "expenses_update_admin" on public.expenses
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No DELETE policies anywhere: records are permanent.

-- ============ AGGREGATE VIEWS (approved only) ============
-- security_invoker makes the views respect the caller's RLS
create view public.v_spend_by_student
with (security_invoker = true) as
select
  p.id as user_id,
  p.full_name,
  p.email,
  count(e.id) as approved_count,
  coalesce(sum(e.amount), 0) as approved_total
from public.profiles p
left join public.expenses e
  on e.user_id = p.id and e.status = 'approved'
where p.role = 'student'
group by p.id, p.full_name, p.email;

create view public.v_spend_by_event
with (security_invoker = true) as
select
  ev.id as event_id,
  ev.name as event_name,
  count(e.id) as approved_count,
  coalesce(sum(e.amount), 0) as approved_total
from public.events ev
left join public.expenses e
  on e.event_id = ev.id and e.status = 'approved'
group by ev.id, ev.name;

create view public.v_spend_by_month
with (security_invoker = true) as
select
  date_trunc('month', expense_date)::date as month,
  sum(amount) as approved_total,
  count(*) as approved_count
from public.expenses
where status = 'approved'
group by 1
order by 1;

-- ============ STORAGE ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bills', 'bills', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Path convention: {user_id}/{uuid}.jpg
create policy "bills_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bills'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "bills_select_own_or_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'bills'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Lets the app clean up an image if the DB insert fails, but ONLY while no
-- expense references that file (a submitted bill's image can never be deleted)
create policy "bills_delete_unreferenced_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bills'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (
      select 1 from public.expenses e where e.bill_path = storage.objects.name
    )
  );

-- ============ MAKE YOURSELF ADMIN (run after you sign up once) ============
-- update public.profiles set role = 'admin' where email = 'your-email@example.com';