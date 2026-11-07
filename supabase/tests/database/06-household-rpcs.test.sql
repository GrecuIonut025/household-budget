-- create_household, invites, ownership transfer.
begin;
select plan(20);
select tests.seed_fixture();

-- create_household ----------------------------------------------------------
select tests.as_user('erin');
create temp table created as select public.create_household('Erin Home', 3, 'RON', 'en', null, 2500, 800) as id;
grant select on created to authenticated;
select is((select count(*)::int from public.households), 1, 'creator sees the new household');
select is((select role::text from public.household_members where household_id = (select id from created) and user_id = tests.id('erin')), 'owner',
  'creator becomes owner');
select row_eq($$ select name, household_size, currency::text, locale from public.households $$, row('Erin Home'::text, 3::smallint, 'RON'::text, 'en'::text),
  'household stores name, size, currency and locale');
select row_eq($$ select name, period::text, spending_limit, grocery_limit, is_active from public.budgets $$,
  row('Erin Home'::text, 'monthly'::text, 2500::numeric, 800::numeric, true), 'a monthly budget is created with the household');
select is((select count(*)::int from public.transaction_categories), 13, 'built-in categories are seeded');
select throws_ok($$ select public.create_household('  ') $$, '23514', null, 'blank household names are rejected');

-- invites ---------------------------------------------------------------------
select tests.as_user('dana');
create temp table invite as select public.create_household_invite(tests.id('hhA'), 'Erin@Example.com', 'member') as token;
grant select on invite to authenticated;
select is((select char_length(token) from invite), 64, 'invite token is a 64 character secret');
select is((select count(*)::int from public.household_invites where email = 'erin@example.com'), 1, 'invite email is normalised to lowercase');
select throws_ok($$ select public.create_household_invite(tests.id('hhA'), null, 'owner') $$, '23514', null, 'cannot invite an owner');
select throws_ok($$ select public.create_household_invite(tests.id('hhA'), null, 'admin') $$, '42501', null, 'admin cannot invite another admin');

select tests.as_user('bob');
select throws_ok($$ select public.create_household_invite(tests.id('hhA'), null, 'member') $$, '42501', null, 'members cannot invite');

select tests.as_user('dave');
select throws_ok($$ select public.accept_household_invite((select token from invite)) $$, '42501', null,
  'an invite for a specific email cannot be used by someone else');
select throws_ok($$ select public.accept_household_invite('not-a-real-token') $$, '22023', null, 'unknown tokens are rejected');

select tests.as_user('erin');
select is((select public.accept_household_invite((select token from invite))), tests.id('hhA'), 'invitee accepts and gets the household id');
select is((select role::text from public.household_members where household_id = tests.id('hhA') and user_id = tests.id('erin')), 'member', 'invitee joins with the invited role');
select throws_ok($$ select public.accept_household_invite((select token from invite)) $$, '22023', null, 'invite tokens are single use');

-- ownership transfer --------------------------------------------------------------
select tests.as_user('dana');
select throws_ok($$ select public.transfer_household_ownership(tests.id('hhA'), tests.id('dana')) $$, '42501', null, 'only the owner can transfer ownership');
select tests.as_user('alice');
select throws_ok($$ select public.transfer_household_ownership(tests.id('hhA'), tests.id('dave')) $$, '22023', null, 'new owner must already be a member');
select lives_ok($$ select public.transfer_household_ownership(tests.id('hhA'), tests.id('dana')) $$, 'owner transfers ownership');
select tests.as_superuser();
select results_eq($$ select user_id::text || ':' || role::text from public.household_members
  where household_id = tests.id('hhA') and role in ('owner', 'admin') order by role $$,
  array[tests.id('dana')::text || ':owner', tests.id('alice')::text || ':admin'], 'roles are swapped');

select * from finish();
rollback;
