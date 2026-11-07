-- Read-side budget engine in SQL. Mirrors src/lib/budget-engine (kept in sync by tests).
-- Views use security_invoker so row level security of the caller applies.
-- Reservations are never part of "expenses"; they are reported as `reserved_*`.

create view public.household_balances with (security_invoker = true) as
select
  h.id as household_id,
  h.currency,
  h.opening_balance,
  coalesce(t.income_total, 0) as income_total,
  coalesce(t.expense_total, 0) as expense_total,
  coalesce(s.saved_total, 0) as saved_total,
  h.opening_balance + coalesce(t.income_total, 0) - coalesce(t.expense_total, 0) as balance,
  h.opening_balance + coalesce(t.income_total, 0) - coalesce(t.expense_total, 0) - coalesce(s.saved_total, 0) as available
from public.households h
left join lateral (
  select
    sum(amount) filter (where type = 'income') as income_total,
    sum(amount) filter (where type = 'expense') as expense_total
  from public.transactions where household_id = h.id
) t on true
left join lateral (
  select sum(amount) as saved_total from public.savings_goal_contributions where household_id = h.id
) s on true;

create view public.savings_goal_progress with (security_invoker = true) as
select
  g.id as goal_id,
  g.household_id,
  g.name,
  g.scope,
  g.owner_id,
  g.status,
  g.target_amount,
  g.target_date,
  coalesce(c.current_amount, 0) as current_amount,
  greatest(g.target_amount - coalesce(c.current_amount, 0), 0) as remaining_amount,
  round(least(coalesce(c.current_amount, 0) / g.target_amount, 1) * 100, 1) as percent_complete
from public.savings_goals g
left join lateral (
  select sum(amount) as current_amount from public.savings_goal_contributions where goal_id = g.id
) c on true;

create view public.shopping_list_totals with (security_invoker = true) as
select
  l.id as list_id,
  l.household_id,
  count(i.id) as item_count,
  count(i.id) filter (where i.is_checked) as checked_count,
  coalesce(sum(i.quantity * i.estimated_unit_price), 0)::numeric(14, 2) as estimated_total,
  coalesce(sum(i.quantity * coalesce(i.actual_unit_price, i.estimated_unit_price)) filter (where i.is_checked), 0)::numeric(14, 2) as checked_total
from public.shopping_lists l
left join public.shopping_list_items i on i.list_id = l.id
group by l.id, l.household_id;

create type public.budget_summary_row as (
  budget_id uuid,
  household_id uuid,
  period_start date,
  period_end date,
  spending_limit numeric,
  grocery_limit numeric,
  income numeric,
  expenses numeric,
  grocery_expenses numeric,
  shared_expenses numeric,
  individual_expenses numeric,
  reserved_total numeric,
  reserved_grocery numeric,
  committed numeric,
  remaining numeric,
  grocery_remaining numeric,
  days_total integer,
  days_left integer,
  daily_allowance numeric,
  today_spent numeric
);

-- Summary of one budget period as of p_today.
--   expenses        actual expense transactions inside the period (reservations excluded)
--   committed       expenses + active reservations
--   remaining       spending_limit - committed (null without a limit)
--   daily_allowance what can be spent per remaining day, counting today and
--                   ignoring today's own spending so it stays stable during the day
create or replace function public.budget_summary(p_budget_id uuid, p_today date default current_date)
returns public.budget_summary_row
language plpgsql
stable
set search_path = ''
as $$
declare
  b public.budgets%rowtype;
  res public.budget_summary_row;
  v_income numeric;
  v_expenses numeric;
  v_grocery numeric;
  v_shared numeric;
  v_individual numeric;
  v_before_today numeric;
  v_today numeric;
  v_reserved numeric;
  v_reserved_grocery numeric;
  v_days_left integer;
begin
  select * into b from public.budgets where id = p_budget_id;
  if not found then
    return null;
  end if;

  select
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0),
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0),
    coalesce(sum(t.amount) filter (where t.type = 'expense' and c.is_grocery), 0),
    coalesce(sum(t.amount) filter (where t.type = 'expense' and t.scope = 'shared'), 0),
    coalesce(sum(t.amount) filter (where t.type = 'expense' and t.scope = 'individual'), 0),
    coalesce(sum(t.amount) filter (where t.type = 'expense' and t.occurred_on < p_today), 0),
    coalesce(sum(t.amount) filter (where t.type = 'expense' and t.occurred_on = p_today), 0)
  into v_income, v_expenses, v_grocery, v_shared, v_individual, v_before_today, v_today
  from public.transactions t
  left join public.transaction_categories c on c.id = t.category_id and c.household_id = t.household_id
  where t.household_id = b.household_id
    and t.occurred_on between b.start_date and b.end_date;

  select
    coalesce(sum(r.amount), 0),
    coalesce(sum(r.amount) filter (where r.is_grocery), 0)
  into v_reserved, v_reserved_grocery
  from public.budget_reservations r
  where r.budget_id = b.id and r.status = 'active';

  v_days_left := case
    when p_today > b.end_date then 0
    when p_today < b.start_date then (b.end_date - b.start_date) + 1
    else (b.end_date - p_today) + 1
  end;

  res.budget_id := b.id;
  res.household_id := b.household_id;
  res.period_start := b.start_date;
  res.period_end := b.end_date;
  res.spending_limit := b.spending_limit;
  res.grocery_limit := b.grocery_limit;
  res.income := v_income;
  res.expenses := v_expenses;
  res.grocery_expenses := v_grocery;
  res.shared_expenses := v_shared;
  res.individual_expenses := v_individual;
  res.reserved_total := v_reserved;
  res.reserved_grocery := v_reserved_grocery;
  res.committed := v_expenses + v_reserved;
  res.remaining := case when b.spending_limit is null then null else b.spending_limit - (v_expenses + v_reserved) end;
  res.grocery_remaining := case when b.grocery_limit is null then null else b.grocery_limit - (v_grocery + v_reserved_grocery) end;
  res.days_total := (b.end_date - b.start_date) + 1;
  res.days_left := v_days_left;
  res.daily_allowance := case
    when b.spending_limit is null or v_days_left = 0 then null
    else greatest(0, (b.spending_limit - v_before_today - v_reserved) / v_days_left)
  end;
  res.today_spent := v_today;
  return res;
end;
$$;

-- Spending and income per member over a date range (inclusive). Unattributed rows have user_id null.
create or replace function public.spending_by_member(p_household_id uuid, p_from date, p_to date)
returns table (
  user_id uuid,
  income numeric,
  expenses numeric,
  shared_expenses numeric,
  individual_expenses numeric,
  grocery_expenses numeric
)
language sql
stable
set search_path = ''
as $$
  select
    t.paid_by,
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0),
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0),
    coalesce(sum(t.amount) filter (where t.type = 'expense' and t.scope = 'shared'), 0),
    coalesce(sum(t.amount) filter (where t.type = 'expense' and t.scope = 'individual'), 0),
    coalesce(sum(t.amount) filter (where t.type = 'expense' and c.is_grocery), 0)
  from public.transactions t
  left join public.transaction_categories c on c.id = t.category_id and c.household_id = t.household_id
  where t.household_id = p_household_id and t.occurred_on between p_from and p_to
  group by t.paid_by
$$;

grant execute on function public.budget_summary(uuid, date), public.spending_by_member(uuid, date, date)
  to authenticated, service_role;
revoke execute on function public.budget_summary(uuid, date), public.spending_by_member(uuid, date, date)
  from public, anon;
