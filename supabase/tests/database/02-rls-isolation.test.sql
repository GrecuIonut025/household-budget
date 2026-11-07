-- Cross-household isolation: a user of household A must never see or touch household B (and vice versa).
begin;
select plan(28);
select tests.seed_fixture();

-- alice (owner of A) -------------------------------------------------------
select tests.as_user('alice');
select is(tests.visible_rows_for_household(tests.id('hhB')), 0::bigint, 'alice sees no rows of household B in any table');
select ok(tests.visible_rows_for_household(tests.id('hhA')) > 0, 'alice sees household A data');
select results_eq($$ select id from public.households $$, array[tests.id('hhA')], 'alice only sees her own household');
select results_eq($$ select user_id from public.household_members where household_id = tests.id('hhA') order by user_id::text $$,
  $$ select u from unnest(array[tests.id('alice'), tests.id('bob'), tests.id('carol'), tests.id('dana')]) u order by u::text $$,
  'alice sees the members of A');
select is((select count(*)::int from public.profiles where id = tests.id('dave')), 0, 'alice cannot read the profile of a stranger');
select is((select count(*)::int from public.profiles where id = tests.id('bob')), 1, 'alice can read the profile of a household member');
select is((select count(*)::int from public.retailers), 7, 'retailers are readable by every signed-in user');
select is((select count(*)::int from public.retailer_stores where household_id is distinct from tests.id('hhA')), 0,
  'custom stores of other households are hidden');

select throws_ok(
  $$ insert into public.products (household_id, name) values (tests.id('hhB'), 'smuggled') $$,
  '42501', null, 'alice cannot insert into household B');
select throws_ok(
  $$ insert into public.transactions (household_id, type, amount) values (tests.id('hhB'), 'expense', 1) $$,
  '42501', null, 'alice cannot insert transactions into household B');
select is_empty($$ update public.products set name = 'hacked' where household_id = tests.id('hhB') returning id $$,
  'alice cannot update products of B');
select is_empty($$ delete from public.transactions where household_id = tests.id('hhB') returning id $$,
  'alice cannot delete transactions of B');
select is_empty($$ update public.households set name = 'hacked' where id = tests.id('hhB') returning id $$,
  'alice cannot rename household B');
select throws_ok(
  $$ insert into public.product_barcodes (household_id, product_id, barcode)
     values (tests.id('hhA'), tests.id('B-product'), '5449000000996') $$,
  '23503', null, 'composite FK stops linking an A row to a B product');
select throws_ok(
  $$ update public.products set household_id = tests.id('hhB') where id = tests.id('A-product') $$,
  '42501', null, 'rows cannot be moved to another household');
select throws_ok(
  $$ insert into public.household_members (household_id, user_id, role) values (tests.id('hhB'), tests.id('alice'), 'member') $$,
  '42501', null, 'users cannot add themselves to a household');
select throws_ok(
  $$ insert into public.households (name, created_by) values ('rogue', tests.id('alice')) $$,
  '42501', null, 'households can only be created through create_household()');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('household-media', tests.id('hhB')::text || '/x.png') $$,
  '42501', null, 'alice cannot upload into the storage folder of household B');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('household-media', tests.id('hhA')::text || '/x.png') $$,
  'alice can upload into the folder of her household');

-- dave (owner of B) ----------------------------------------------------------
select tests.as_user('dave');
select is(tests.visible_rows_for_household(tests.id('hhA')), 0::bigint, 'dave sees no rows of household A in any table');
select is((select count(*)::int from storage.objects), 0, 'dave cannot list the files of household A');

-- erin (no household) -------------------------------------------------------
select tests.as_user('erin');
select is((select count(*)::int from public.households), 0, 'a user without a household sees no households');
select is(tests.visible_rows_for_household(tests.id('hhA')) + tests.visible_rows_for_household(tests.id('hhB')), 0::bigint,
  'a user without a household sees no household data');
select is((select count(*)::int from public.profiles where id <> tests.id('erin')), 0, 'erin sees only her own profile');

-- anon ----------------------------------------------------------------------
select tests.as_anon();
select throws_ok($$ select * from public.households $$, '42501', null, 'anon has no access to households');
select throws_ok($$ select * from public.transactions $$, '42501', null, 'anon has no access to transactions');
select throws_ok($$ select public.is_household_member(tests.id('hhA')) $$, '42501', null, 'anon cannot call RLS helper functions');
select throws_ok($$ select public.create_household('x') $$, '42501', null, 'anon cannot create households');

select tests.as_superuser();
select * from finish();
rollback;
