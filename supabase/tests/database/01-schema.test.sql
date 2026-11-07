begin;
select plan(14);

select tests.seed_fixture();

select is(
  (select count(*)::int from information_schema.tables t
   where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
     and not (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = t.table_schema and c.relname = t.table_name)),
  0,
  'every table in public has row level security enabled'
);

select is(
  (select count(*)::int from information_schema.tables t
   where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.table_name)),
  0,
  'every table in public has at least one policy'
);

select is(
  (select array_agg(table_name::text order by table_name) from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE'
     and table_name in ('households', 'household_members', 'budgets', 'savings_goals', 'transactions', 'products',
       'product_barcodes', 'product_prices', 'product_price_history', 'retailers', 'retailer_stores',
       'product_purchase_history', 'recipes', 'recipe_ingredients', 'pantry_items', 'meal_plans',
       'shopping_lists', 'shopping_list_items', 'price_alerts', 'budget_reservations', 'household_invites')),
  array['budget_reservations', 'budgets', 'household_invites', 'household_members', 'households', 'meal_plans',
        'pantry_items', 'price_alerts', 'product_barcodes', 'product_price_history', 'product_prices',
        'product_purchase_history', 'products', 'recipe_ingredients', 'recipes', 'retailer_stores', 'retailers',
        'savings_goals', 'shopping_list_items', 'shopping_lists', 'transactions'],
  'all required entities exist'
);

select results_eq(
  $$ select slug from public.retailers order by slug $$,
  array['auchan', 'carrefour', 'kaufland', 'lidl', 'mega-image', 'penny', 'profi'],
  'seven Romanian retailers are seeded'
);

select is((select count(*)::int from public.transaction_categories where household_id = tests.id('hhA')), 13,
  'new household gets built-in categories');
select is((select name from public.transaction_categories where household_id = tests.id('hhA') and is_grocery), 'Groceries',
  'exactly one grocery category is flagged');

select ok(public.is_valid_gtin('4006381333931'), 'valid EAN-13 accepted');
select ok(public.is_valid_gtin('96385074'), 'valid EAN-8 accepted');
select ok(not public.is_valid_gtin('4006381333932'), 'bad check digit rejected');
select ok(not public.is_valid_gtin('12345'), 'wrong length rejected');

select is(
  (select count(*)::int from unnest(tests.household_tables()) t(name)
   where (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I where household_id = %L', t.name, tests.id('hhA')), false, true, '')))[1]::text::int = 0),
  0,
  'fixture populated every household-owned table for household A'
);
select is(
  (select count(*)::int from unnest(tests.household_tables()) t(name)
   where (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I where household_id = %L', t.name, tests.id('hhB')), false, true, '')))[1]::text::int = 0),
  0,
  'fixture populated every household-owned table for household B'
);

select throws_ok(
  $$ insert into public.product_prices (household_id, product_id, retailer_id, price, source)
     values (tests.id('hhA'), tests.id('A-product'), (select id from public.retailers where slug = 'penny'), 3, 'adapter') $$,
  '23514', null, 'adapter prices require a match confidence'
);
select throws_ok(
  $$ insert into public.budgets (household_id, name, start_date, end_date) values (tests.id('hhA'), 'overlap', '2026-11-15', '2026-12-15') $$,
  '23P01', null, 'active budgets of a household cannot overlap'
);

select * from finish();
rollback;
