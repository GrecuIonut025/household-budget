-- Purchase history inserts keep product statistics up to date.
begin;
select plan(15);
select tests.seed_fixture();

insert into public.products (id, household_id, name) values (tests.id('milk'), tests.id('hhA'), 'Milk 1L');

select row_eq(
  $$ select purchase_count, total_quantity, total_spent, avg_price, min_price, max_price, last_price, last_purchase_date
     from public.products where id = tests.id('milk') $$,
  row(0, 0::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::date),
  'a new product has empty statistics');

insert into public.product_purchase_history (household_id, product_id, retailer_id, purchased_on, quantity, unit_price)
values (tests.id('hhA'), tests.id('milk'), (select id from public.retailers where slug = 'lidl'), '2026-01-10', 2, 5.00);

select row_eq(
  $$ select purchase_count, total_quantity, total_spent, avg_price, min_price, max_price, last_price, last_purchase_date
     from public.products where id = tests.id('milk') $$,
  row(1, 2.000::numeric, 10.00::numeric, 5.0000::numeric, 5.00::numeric, 5.00::numeric, 5.00::numeric, '2026-01-10'::date),
  'first purchase initialises statistics');

insert into public.product_purchase_history (household_id, product_id, retailer_id, purchased_on, quantity, unit_price)
values (tests.id('hhA'), tests.id('milk'), (select id from public.retailers where slug = 'kaufland'), '2026-01-20', 1, 7.50);
-- backdated purchase must not become the "last" purchase
insert into public.product_purchase_history (household_id, product_id, retailer_id, purchased_on, quantity, unit_price)
values (tests.id('hhA'), tests.id('milk'), (select id from public.retailers where slug = 'penny'), '2026-01-05', 3, 4.00);

select row_eq(
  $$ select purchase_count, total_quantity, total_spent, avg_price, min_price, max_price, last_price, last_purchase_date
     from public.products where id = tests.id('milk') $$,
  row(3, 6.000::numeric, 29.50::numeric, 4.9167::numeric, 4.00::numeric, 7.50::numeric, 7.50::numeric, '2026-01-20'::date),
  'statistics aggregate multiple purchases (backdated rows do not change last_*)');
select is((select r.slug from public.retailers r where r.id = (select last_retailer_id from public.products where id = tests.id('milk'))),
  'kaufland', 'last retailer follows the latest purchase');
select is((select total_price from public.product_purchase_history where product_id = tests.id('milk') and quantity = 3), 12.00::numeric,
  'total_price is quantity * unit_price');

-- deleting the latest purchase recomputes from the remaining rows
delete from public.product_purchase_history where product_id = tests.id('milk') and unit_price = 7.50;
select row_eq(
  $$ select purchase_count, total_quantity, total_spent, avg_price, max_price, last_price, last_purchase_date
     from public.products where id = tests.id('milk') $$,
  row(2, 5.000::numeric, 22.00::numeric, 4.4000::numeric, 5.00::numeric, 5.00::numeric, '2026-01-10'::date),
  'deleting a purchase recomputes statistics');

update public.product_purchase_history set unit_price = 6.00 where product_id = tests.id('milk') and quantity = 2;
select row_eq(
  $$ select total_spent, max_price, last_price from public.products where id = tests.id('milk') $$,
  row(24.00::numeric, 6.00::numeric, 6.00::numeric), 'updating a purchase recomputes statistics');

delete from public.product_purchase_history where product_id = tests.id('milk');
select row_eq(
  $$ select purchase_count, total_spent, avg_price, last_price, last_purchase_date from public.products where id = tests.id('milk') $$,
  row(0, 0::numeric, null::numeric, null::numeric, null::date), 'removing every purchase resets statistics');

-- a purchase inserted by a household member (through RLS) also updates the stats
select tests.as_user('bob');
select lives_ok($$ insert into public.product_purchase_history (household_id, product_id, purchased_on, quantity, unit_price, purchased_by)
  values (tests.id('hhA'), tests.id('milk'), '2026-02-01', 1, 6.5, tests.id('bob')) $$, 'member can record a purchase');
select is((select purchase_count from public.products where id = tests.id('milk')), 1, 'stats updated for RLS-inserted purchase');
select throws_ok($$ insert into public.product_purchase_history (household_id, product_id, purchased_on, quantity, unit_price)
  values (tests.id('hhA'), tests.id('B-product'), '2026-02-01', 1, 1) $$, '23503', null,
  'a purchase cannot reference a product of another household');
select throws_ok($$ insert into public.product_purchase_history (household_id, product_id, quantity, unit_price)
  values (tests.id('hhA'), tests.id('milk'), 0, 1) $$, '23514', null, 'quantity must be positive');
select tests.as_superuser();

-- price history is written by trigger on every price change
insert into public.product_prices (id, household_id, product_id, retailer_id, price, source, match_confidence, match_method)
values (tests.id('milk-price'), tests.id('hhA'), tests.id('milk'), (select id from public.retailers where slug = 'lidl'), 6.49, 'adapter', 0.87, 'barcode');
update public.product_prices set price = 5.99 where id = tests.id('milk-price');
update public.product_prices set is_verified = true where id = tests.id('milk-price');
select is((select count(*)::int from public.product_price_history where product_id = tests.id('milk')), 2,
  'price history records inserts and price changes only');
select results_eq($$ select price from public.product_price_history where product_id = tests.id('milk') order by recorded_at, price desc $$,
  array[6.49::numeric, 5.99::numeric], 'price history keeps the previous price');
select throws_ok($$ insert into public.product_prices (household_id, product_id, retailer_id, price, source, match_confidence)
  values (tests.id('hhA'), tests.id('milk'), (select id from public.retailers where slug = 'lidl'), 1, 'manual', 1) $$,
  '23505', null, 'one current price per product, retailer and store');

select * from finish();
rollback;
