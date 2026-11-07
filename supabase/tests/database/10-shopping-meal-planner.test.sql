-- Shopping list reserve / complete RPCs: reservations never count as expenses;
-- completing a list records purchases and releases the reservation.
begin;
select plan(12);
select tests.seed_fixture();

-- seed a second product + active list with checked items for household A
select tests.as_superuser();
insert into public.products (id, household_id, name, unit, last_price)
values (tests.id('milk'), tests.id('hhA'), 'Milk 1L', 'l', 6.50);
insert into public.shopping_lists (id, household_id, name, status, planned_budget, created_by)
values (tests.id('shop'), tests.id('hhA'), 'Week shop', 'active', 50, tests.id('alice'));
insert into public.shopping_list_items (id, household_id, list_id, product_id, name, quantity, unit, estimated_unit_price, is_checked, sort_order)
values
  (tests.id('item-milk'), tests.id('hhA'), tests.id('shop'), tests.id('milk'), 'Milk 1L', 2, 'l', 6.50, true, 0),
  (tests.id('item-free'), tests.id('hhA'), tests.id('shop'), null, 'Fresh herbs', 1, 'pcs', 4.00, true, 1),
  (tests.id('item-skip'), tests.id('hhA'), tests.id('shop'), tests.id('A-product'), 'Unchecked', 1, 'pcs', 9.99, false, 2);

select tests.as_user('bob');

-- reserve budget -----------------------------------------------------------------
select lives_ok(
  $$ select public.reserve_shopping_budget(tests.id('shop'), 40, 'weekend shop') $$,
  'member can reserve budget for an active list');

select row_eq(
  $$ select amount, status::text, is_grocery, shopping_list_id
     from public.budget_reservations
     where shopping_list_id = tests.id('shop') and status = 'active' $$,
  row(40.00::numeric, 'active'::text, true, tests.id('shop')),
  'reservation is active, grocery-flagged, and linked to the list');

select is(
  (select planned_budget from public.shopping_lists where id = tests.id('shop')),
  40.00::numeric,
  'list planned_budget mirrors the reservation');

-- reserved money reduces grocery remaining but is not an expense
select is(
  (select reserved_grocery from public.budget_summary(tests.id('A-budget'), '2026-11-07'))
    >
  (select grocery_expenses from public.budget_summary(tests.id('A-budget'), '2026-11-07')),
  true,
  'active reservation is reported separately from grocery expenses');

select throws_ok(
  $$ select public.reserve_shopping_budget(tests.id('shop'), 0) $$,
  '23514', null,
  'zero reservation amount is rejected');

-- complete list → expenses + purchase history, reservation released --------------
select lives_ok(
  $$ select public.complete_shopping_list(tests.id('shop'), '2026-11-07', tests.id('bob'), 'shared') $$,
  'member can complete a list into real expenses');

select row_eq(
  $$ select status::text, (completed_at is not null)
     from public.shopping_lists where id = tests.id('shop') $$,
  row('completed'::text, true),
  'list is marked completed');

select is(
  (select count(*)::int from public.budget_reservations
    where shopping_list_id = tests.id('shop') and status = 'active'),
  0,
  'completing releases the reservation (no double-counting)');

select is(
  (select count(*)::int from public.product_purchase_history
    where product_id = tests.id('milk') and purchased_on = '2026-11-07'),
  1,
  'checked product items update purchase history');

select ok(
  (select count(*)::int from public.transactions
    where household_id = tests.id('hhA') and source = 'shopping_list' and occurred_on = '2026-11-07') >= 1,
  'free-text checked items become grocery expense transactions');

select throws_ok(
  $$ select public.complete_shopping_list(tests.id('shop'), '2026-11-07') $$,
  '23514', null,
  'completing an already completed list is rejected');

-- viewer cannot reserve ----------------------------------------------------------
select tests.as_user('carol');
select throws_ok(
  $$ select public.reserve_shopping_budget(
       (select id from public.shopping_lists where household_id = tests.id('hhA') order by created_at limit 1),
       10) $$,
  '42501', null,
  'viewer cannot reserve shopping budget');

select * from finish();
rollback;
