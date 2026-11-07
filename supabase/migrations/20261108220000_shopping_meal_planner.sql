-- Meal planner / shopping list: chosen retailer per item, preferred shop on the list,
-- and RPCs to reserve budget / complete a list into real expenses (never automatic).

alter table public.shopping_lists
  add column if not exists preferred_retailer_id uuid references public.retailers (id) on delete set null,
  add column if not exists strategy text
    check (strategy is null or strategy in ('cheapest_single', 'cheapest_combo', 'preferred', 'min_visits')),
  add column if not exists meal_week_start date;

alter table public.shopping_list_items
  add column if not exists retailer_id uuid references public.retailers (id) on delete set null;

create index if not exists shopping_list_items_retailer_idx
  on public.shopping_list_items (retailer_id) where retailer_id is not null;

-- Reserve (or refresh) an active grocery reservation for a shopping list.
-- Reservations are never expenses; they only reduce what is still available to spend.
create or replace function public.reserve_shopping_budget(
  p_list_id uuid,
  p_amount numeric,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lst record;
  budget_id uuid;
  reservation_id uuid;
  cat_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'reservation amount must be positive' using errcode = 'check_violation';
  end if;

  select l.id, l.household_id, l.name, l.status
    into lst
  from public.shopping_lists l
  where l.id = p_list_id;
  if not found then
    raise exception 'shopping list not found' using errcode = 'P0002';
  end if;
  -- SELECT … FOR UPDATE under RLS hides rows the caller cannot update, which would look like
  -- "not found". Check write access explicitly so viewers get 42501.
  if not public.can_write_household(lst.household_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if lst.status = 'completed' or lst.status = 'archived' then
    raise exception 'cannot reserve budget for a completed list' using errcode = 'check_violation';
  end if;

  perform 1 from public.shopping_lists where id = lst.id for update;

  select b.id into budget_id
  from public.budgets b
  where b.household_id = lst.household_id
    and b.is_active
    and b.start_date <= current_date
    and b.end_date >= current_date
  order by b.start_date desc
  limit 1;
  if budget_id is null then
    raise exception 'no active budget covers today' using errcode = 'P0002';
  end if;

  select c.id into cat_id
  from public.transaction_categories c
  where c.household_id = lst.household_id and c.system_key = 'groceries'
  limit 1;

  -- release any prior active reservation for this list, then insert a fresh one
  update public.budget_reservations
  set status = 'released', released_at = now()
  where shopping_list_id = lst.id and status = 'active';

  insert into public.budget_reservations (
    household_id, budget_id, shopping_list_id, category_id, amount, status, is_grocery, note, reserved_by
  ) values (
    lst.household_id, budget_id, lst.id, cat_id, round(p_amount, 2), 'active', true,
    coalesce(nullif(btrim(p_note), ''), 'Reserved for ' || lst.name),
    auth.uid()
  )
  returning id into reservation_id;

  update public.shopping_lists
  set planned_budget = round(p_amount, 2)
  where id = lst.id;

  return reservation_id;
end;
$$;

-- Explicitly convert a finished shopping list into real expenses + purchase history.
-- Releases any active reservation for the list (purchases already count as expenses —
-- fulfilling would double-count). Never called automatically for planned lists.
create or replace function public.complete_shopping_list(
  p_list_id uuid,
  p_occurred_on date default current_date,
  p_paid_by uuid default null,
  p_scope public.spending_scope default 'shared'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lst record;
  item record;
  purchase_id uuid;
  tx_id uuid;
  category uuid;
  unit_price numeric(12, 2);
  total numeric(14, 2);
  purchases int := 0;
  expense_total numeric(14, 2) := 0;
begin
  select l.id, l.household_id, l.name, l.status
    into lst
  from public.shopping_lists l
  where l.id = p_list_id;
  if not found then
    raise exception 'shopping list not found' using errcode = 'P0002';
  end if;
  if not public.can_write_household(lst.household_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if lst.status = 'completed' then
    raise exception 'shopping list already completed' using errcode = 'check_violation';
  end if;
  if lst.status = 'archived' then
    raise exception 'cannot complete an archived list' using errcode = 'check_violation';
  end if;

  perform 1 from public.shopping_lists where id = lst.id for update;

  select c.id into category
  from public.transaction_categories c
  where c.household_id = lst.household_id and c.kind = 'expense' and c.is_grocery and not c.is_archived
  order by c.sort_order, c.created_at
  limit 1;

  for item in
    select *
    from public.shopping_list_items i
    where i.list_id = lst.id and i.is_checked
    order by i.sort_order, i.created_at
  loop
    unit_price := coalesce(item.actual_unit_price, item.estimated_unit_price);
    if unit_price is null or unit_price <= 0 then
      continue;
    end if;
    total := round(item.quantity * unit_price, 2);
    expense_total := expense_total + total;

    if item.product_id is not null then
      purchase_id := public.record_product_purchase(
        item.product_id,
        item.quantity,
        unit_price,
        coalesce(p_occurred_on, current_date),
        item.retailer_id,
        p_paid_by,
        false,
        p_scope
      );
      purchases := purchases + 1;
    else
      insert into public.transactions (
        household_id, type, amount, occurred_on, description, category_id, scope, paid_by,
        retailer_id, source, created_by
      ) values (
        lst.household_id, 'expense', total, coalesce(p_occurred_on, current_date),
        left(item.name, 280) || ' × ' || trim_scale(item.quantity)::text,
        category, p_scope, p_paid_by, item.retailer_id, 'shopping_list', auth.uid()
      )
      returning id into tx_id;
      purchases := purchases + 1;
    end if;

    if item.actual_unit_price is null then
      update public.shopping_list_items
      set actual_unit_price = unit_price
      where id = item.id;
    end if;
  end loop;

  update public.shopping_lists
  set status = 'completed', completed_at = now()
  where id = lst.id;

  -- Purchases already recorded as expenses: release the reservation so it stops holding budget.
  update public.budget_reservations
  set status = 'released', released_at = now()
  where shopping_list_id = lst.id and status = 'active';

  return jsonb_build_object(
    'list_id', lst.id,
    'purchases', purchases,
    'expense_total', expense_total
  );
end;
$$;

revoke all on function public.reserve_shopping_budget(uuid, numeric, text),
  public.complete_shopping_list(uuid, date, uuid, public.spending_scope) from public, anon;
grant execute on function public.reserve_shopping_budget(uuid, numeric, text),
  public.complete_shopping_list(uuid, date, uuid, public.spending_scope) to authenticated, service_role;
