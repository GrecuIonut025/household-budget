-- Shared pgTAP helpers and a deterministic fixture. Runs first (alphabetical order) and commits.
-- Everything lives in the `tests` schema so it never collides with application objects.

begin;
create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Deterministic uuid for a label, e.g. tests.id('alice').
create or replace function tests.id(label text) returns uuid
language sql immutable as $$ select md5(label)::uuid $$;

create or replace function tests.as_user(uid uuid) returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object(
    'sub', uid, 'role', 'authenticated',
    'email', (select email from auth.users where id = uid)
  )::text, true);
  execute 'set local role authenticated';
end;
$$;

create or replace function tests.as_user(label text) returns void
language sql as $$ select tests.as_user(tests.id(label)) $$;

create or replace function tests.as_anon() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end;
$$;

create or replace function tests.as_superuser() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Number of rows the CURRENT role can see for a household, summed over every household-owned table.
create or replace function tests.visible_rows_for_household(hid uuid) returns bigint
language plpgsql as $$
declare
  t record;
  n bigint;
  total bigint := 0;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'household_id' and tb.table_type = 'BASE TABLE'
  loop
    execute format('select count(*) from public.%I where household_id = $1', t.table_name) into n using hid;
    total := total + n;
  end loop;
  return total;
end;
$$;

-- Household-owned tables that the fixture populates for every household.
create or replace function tests.household_tables() returns text[]
language sql immutable as $$
  select array[
    'household_members', 'household_invites', 'transaction_categories', 'budgets', 'savings_goals',
    'savings_goal_contributions', 'transactions', 'products', 'product_barcodes', 'product_prices',
    'product_price_history', 'product_purchase_history', 'recipes', 'recipe_ingredients', 'pantry_items',
    'meal_plans', 'shopping_lists', 'shopping_list_items', 'budget_reservations', 'price_alerts',
    'retailer_stores'
  ]
$$;

-- Populates one row in every household-owned table. Run as superuser.
create or replace function tests.seed_household_data(hid uuid, owner uuid, tag text) returns void
language plpgsql as $$
declare
  lidl uuid := (select id from public.retailers where slug = 'lidl');
  cat_groceries uuid := (select id from public.transaction_categories where household_id = hid and system_key = 'groceries');
  budget uuid := tests.id(tag || '-budget');
  goal uuid := tests.id(tag || '-goal');
  product uuid := tests.id(tag || '-product');
  recipe uuid := tests.id(tag || '-recipe');
  list uuid := tests.id(tag || '-list');
  tx uuid := tests.id(tag || '-tx');
begin
  insert into public.budgets (id, household_id, name, start_date, end_date, spending_limit, grocery_limit)
  values (budget, hid, tag || ' budget', '2026-11-01', '2026-11-30', 3000, 1000);
  insert into public.savings_goals (id, household_id, name, target_amount) values (goal, hid, tag || ' goal', 2000);
  insert into public.savings_goal_contributions (household_id, goal_id, user_id, amount, contributed_on)
  values (hid, goal, owner, 100, '2026-11-02');
  insert into public.transactions (id, household_id, type, amount, occurred_on, description, category_id, paid_by, created_by)
  values (tx, hid, 'expense', 42, '2026-11-03', tag || ' tx', cat_groceries, owner, owner);
  insert into public.products (id, household_id, name, brand) values (product, hid, tag || ' product', 'Brand');
  insert into public.product_barcodes (household_id, product_id, barcode) values (hid, product, '4006381333931');
  insert into public.product_prices (household_id, product_id, retailer_id, price, source, match_method, match_confidence)
  values (hid, product, lidl, 9.99, 'manual', 'manual', 1);
  insert into public.product_purchase_history (household_id, product_id, retailer_id, transaction_id, purchased_on, quantity, unit_price, purchased_by)
  values (hid, product, lidl, tx, '2026-11-03', 2, 5, owner);
  insert into public.recipes (id, household_id, title) values (recipe, hid, tag || ' recipe');
  insert into public.recipe_ingredients (household_id, recipe_id, product_id, name, quantity, unit)
  values (hid, recipe, product, 'ingredient', 1, 'pcs');
  insert into public.pantry_items (household_id, product_id, name, quantity) values (hid, product, 'pantry', 1);
  insert into public.meal_plans (household_id, plan_date, meal_type, recipe_id) values (hid, '2026-11-08', 'dinner', recipe);
  insert into public.shopping_lists (id, household_id, name, planned_budget) values (list, hid, tag || ' list', 100);
  insert into public.shopping_list_items (household_id, list_id, product_id, name, quantity, estimated_unit_price)
  values (hid, list, product, 'item', 2, 5);
  insert into public.budget_reservations (household_id, budget_id, shopping_list_id, amount) values (hid, budget, list, 100);
  insert into public.price_alerts (household_id, product_id, user_id, target_price) values (hid, product, owner, 5);
  insert into public.retailer_stores (retailer_id, household_id, name, city) values (lidl, hid, tag || ' store', 'Cluj-Napoca');
  insert into public.household_invites (household_id, email, token_hash, invited_by)
  values (hid, lower(tag) || '@example.com', md5(tag), owner);
end;
$$;

-- World used by most tests:
--   household A: alice (owner), dana (admin), bob (member), carol (viewer)
--   household B: dave (owner)
--   erin belongs to no household
create or replace function tests.seed_fixture() returns void
language plpgsql as $$
declare
  hh_a uuid := tests.id('hhA');
  hh_b uuid := tests.id('hhB');
  u text;
begin
  perform tests.as_superuser();
  foreach u in array array['alice', 'bob', 'carol', 'dana', 'dave', 'erin'] loop
    insert into auth.users (id, email) values (tests.id(u), u || '@example.com');
  end loop;

  insert into public.households (id, name, household_size, created_by) values (hh_a, 'Household A', 4, tests.id('alice'));
  insert into public.households (id, name, created_by) values (hh_b, 'Household B', tests.id('dave'));
  insert into public.household_members (household_id, user_id, role) values
    (hh_a, tests.id('dana'), 'admin'),
    (hh_a, tests.id('bob'), 'member'),
    (hh_a, tests.id('carol'), 'viewer');

  perform tests.seed_household_data(hh_a, tests.id('alice'), 'A');
  perform tests.seed_household_data(hh_b, tests.id('dave'), 'B');
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

select plan(1);
select ok(true, 'test helpers installed');
select * from finish();
commit;
