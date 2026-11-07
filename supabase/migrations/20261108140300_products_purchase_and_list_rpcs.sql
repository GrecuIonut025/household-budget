-- Product workflows that touch several tables atomically. Both functions are SECURITY INVOKER, so every
-- row they write is checked by the caller's RLS policies (viewers cannot write, members can only attribute
-- spending to themselves, tenant-safe composite foreign keys still apply).

-- Records a purchase: creates the budget transaction (grocery category, attributed to the buyer) and the
-- purchase-history row linked to it. Product statistics are updated by the existing purchase-history triggers.
create or replace function public.record_product_purchase(
  p_product_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_purchased_on date default current_date,
  p_retailer_id uuid default null,
  p_purchased_by uuid default null,
  p_is_promo boolean default false,
  p_scope public.spending_scope default 'shared'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  prod record;
  category uuid;
  total numeric(14, 2);
  tx_id uuid;
  purchase_id uuid;
begin
  select p.id, p.household_id, p.name into prod from public.products p where p.id = p_product_id;
  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_unit_price is null or p_unit_price <= 0 then
    raise exception 'quantity and unit price must be positive' using errcode = 'check_violation';
  end if;

  total := round(p_quantity * p_unit_price, 2);
  select c.id into category
  from public.transaction_categories c
  where c.household_id = prod.household_id and c.kind = 'expense' and c.is_grocery and not c.is_archived
  order by c.sort_order, c.created_at
  limit 1;

  insert into public.transactions (
    household_id, type, amount, occurred_on, description, category_id, scope, paid_by, retailer_id, created_by
  ) values (
    prod.household_id, 'expense', total, coalesce(p_purchased_on, current_date),
    left(prod.name, 280) || ' × ' || trim_scale(p_quantity)::text,
    category, p_scope, p_purchased_by, p_retailer_id, auth.uid()
  ) returning id into tx_id;

  insert into public.product_purchase_history (
    household_id, product_id, retailer_id, transaction_id, purchased_on, quantity, unit_price, is_promo, purchased_by
  ) values (
    prod.household_id, prod.id, p_retailer_id, tx_id, coalesce(p_purchased_on, current_date),
    p_quantity, p_unit_price, coalesce(p_is_promo, false), p_purchased_by
  ) returning id into purchase_id;

  return purchase_id;
end;
$$;

-- Creates a draft shopping list from products. Names, units and estimated prices come from the
-- products themselves (last paid price), never from the caller; p_items is [{product_id, quantity}].
create or replace function public.create_shopping_list_from_products(
  p_household_id uuid,
  p_name text,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  list_id uuid;
  inserted int;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 200 then
    raise exception 'between 1 and 200 items are required' using errcode = 'check_violation';
  end if;

  insert into public.shopping_lists (household_id, name, status, scope, created_by)
  values (p_household_id, btrim(p_name), 'draft', 'shared', auth.uid())
  returning id into list_id;

  insert into public.shopping_list_items (household_id, list_id, product_id, name, quantity, unit, estimated_unit_price, sort_order)
  select p.household_id, list_id, p.id, p.name,
         greatest(coalesce((e.item ->> 'quantity')::numeric, 1), 0.001), p.unit, p.last_price, (e.ord - 1)::int
  from jsonb_array_elements(p_items) with ordinality as e(item, ord)
  join public.products p
    on p.id = (e.item ->> 'product_id')::uuid and p.household_id = p_household_id;
  get diagnostics inserted = row_count;

  if inserted = 0 then
    raise exception 'none of the products belong to this household' using errcode = 'check_violation';
  end if;
  return list_id;
end;
$$;

revoke all on function public.record_product_purchase(uuid, numeric, numeric, date, uuid, uuid, boolean, public.spending_scope),
  public.create_shopping_list_from_products(uuid, text, jsonb) from public, anon;
grant execute on function public.record_product_purchase(uuid, numeric, numeric, date, uuid, uuid, boolean, public.spending_scope),
  public.create_shopping_list_from_products(uuid, text, jsonb) to authenticated, service_role;
