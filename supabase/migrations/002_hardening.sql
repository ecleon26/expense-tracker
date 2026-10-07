-- ============================================================================
-- 002_hardening.sql: Hardening RLS policies, trigger guards, indexes, and KPI view
-- Safe to run on top of 001_init.sql
-- ============================================================================

-- 1. Replace the policy expenses_insert_own_pending
drop policy if exists "expenses_insert_own_pending" on public.expenses;

create policy "expenses_insert_own_pending" on public.expenses
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and reject_reason is null
    and bill_path ~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$')
    and exists (
      select 1 from public.events ev
      where ev.id = expenses.event_id
        and ev.is_active = true
    )
  );

-- 2. Unique index on public.expenses(bill_path) so one image cannot back two bills
create unique index if not exists idx_expenses_bill_path on public.expenses (bill_path);

-- 3. Replace function guard_expense_update()
create or replace function public.guard_expense_update()
returns trigger
language plpgsql
as $$
begin
  -- If auth.uid() is null (SQL editor / database owner), return NEW immediately so the owner can correct mistakes manually
  if auth.uid() is null then
    return new;
  end if;

  -- Raise unless OLD.status = 'pending'
  if old.status != 'pending' then
    raise exception 'This bill has already been reviewed';
  end if;

  -- Raise unless NEW.status is 'approved' or 'rejected'
  if new.status not in ('approved', 'rejected') then
    raise exception 'Status must be approved or rejected';
  end if;

  -- Keep existing rule that blocks changing user_id, event_id, amount, title, description, expense_date, bill_path, created_at
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

  -- Rejecting requires a non-empty reject_reason
  if new.status = 'rejected' then
    if new.reject_reason is null or length(trim(new.reject_reason)) = 0 then
      raise exception 'A reject reason is required';
    end if;
  end if;

  -- When approving, set reject_reason to null
  if new.status = 'approved' then
    new.reject_reason := null;
  end if;

  -- Set reviewed_by = auth.uid() and reviewed_at = now()
  new.reviewed_by := auth.uid();
  new.reviewed_at := now();

  return new;
end;
$$;

-- 4. View v_kpis (security_invoker = true) returning one row: approved_total, approved_count, pending_count, pending_amount
drop view if exists public.v_kpis;

create view public.v_kpis
with (security_invoker = true) as
select
  coalesce(sum(case when status = 'approved' then amount else 0 end), 0) as approved_total,
  coalesce(count(case when status = 'approved' then 1 end), 0) as approved_count,
  coalesce(count(case when status = 'pending' then 1 end), 0) as pending_count,
  coalesce(sum(case when status = 'pending' then amount else 0 end), 0) as pending_amount
from public.expenses;
