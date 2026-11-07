-- Role-aware policies inside one household: owner / admin / member / viewer.
begin;
select plan(31);
select tests.seed_fixture();

-- viewer ---------------------------------------------------------------------
select tests.as_user('carol');
select ok((select count(*) from public.transactions where household_id = tests.id('hhA')) > 0, 'viewer can read transactions');
select throws_ok($$ insert into public.transactions (household_id, type, amount) values (tests.id('hhA'), 'expense', 5) $$,
  '42501', null, 'viewer cannot add transactions');
select throws_ok($$ insert into public.products (household_id, name) values (tests.id('hhA'), 'nope') $$,
  '42501', null, 'viewer cannot add products');
select is_empty($$ update public.shopping_lists set name = 'x' where household_id = tests.id('hhA') returning id $$,
  'viewer cannot edit shopping lists');
select is_empty($$ delete from public.recipes where household_id = tests.id('hhA') returning id $$, 'viewer cannot delete recipes');
select throws_ok($$ insert into public.savings_goal_contributions (household_id, goal_id, user_id, amount)
  values (tests.id('hhA'), tests.id('A-goal'), tests.id('carol'), 10) $$, '42501', null, 'viewer cannot contribute to goals');
select is((select count(*)::int from public.household_invites), 0, 'viewer cannot see invites');

-- member ---------------------------------------------------------------------
select tests.as_user('bob');
select lives_ok($$ insert into public.transactions (household_id, type, amount, description, paid_by, scope)
  values (tests.id('hhA'), 'expense', 12.5, 'bob lunch', tests.id('bob'), 'individual') $$, 'member records own individual spending');
select lives_ok($$ insert into public.transactions (household_id, type, amount, description)
  values (tests.id('hhA'), 'expense', 3, 'shared coffee') $$, 'member records unattributed shared spending');
select throws_ok($$ insert into public.transactions (household_id, type, amount, paid_by, scope)
  values (tests.id('hhA'), 'expense', 9, tests.id('alice'), 'individual') $$, '42501', null, 'member cannot attribute spending to someone else');
select is_empty($$ update public.transactions set amount = 1 where id = tests.id('A-tx') returning id $$,
  'member cannot edit a transaction created by another member');
select is_empty($$ delete from public.transactions where id = tests.id('A-tx') returning id $$,
  'member cannot delete a transaction created by another member');
select lives_ok($$ update public.transactions set amount = 13 where description = 'bob lunch' $$, 'member can edit own transaction');
select throws_ok($$ insert into public.budgets (household_id, name, start_date, end_date) values (tests.id('hhA'), 'b2', '2027-01-01', '2027-01-31') $$,
  '42501', null, 'member cannot create budgets');
select is_empty($$ update public.households set name = 'x' where id = tests.id('hhA') returning id $$, 'member cannot edit household settings');
select lives_ok($$ insert into public.products (household_id, name) values (tests.id('hhA'), 'Milk') $$, 'member can add products');
select lives_ok($$ insert into public.savings_goals (household_id, name, target_amount, scope, owner_id)
  values (tests.id('hhA'), 'Bob bike', 500, 'individual', tests.id('bob')) $$, 'member can create an individual goal');
select throws_ok($$ insert into public.savings_goals (household_id, name, target_amount, scope, owner_id)
  values (tests.id('hhA'), 'Alice stuff', 500, 'individual', tests.id('alice')) $$, '42501', null,
  'member cannot create a goal for another member');
select throws_ok($$ update public.products set purchase_count = 99 where household_id = tests.id('hhA') $$,
  '42501', null, 'derived product statistics cannot be edited');
select is((select count(*)::int from public.household_invites), 0, 'member cannot see invites');

-- admin ----------------------------------------------------------------------
select tests.as_user('dana');
select lives_ok($$ insert into public.budgets (household_id, name, start_date, end_date) values (tests.id('hhA'), 'b2', '2027-01-01', '2027-01-31') $$,
  'admin can create budgets');
select lives_ok($$ update public.households set household_size = 5 where id = tests.id('hhA') $$, 'admin can edit the household');
select lives_ok($$ update public.household_members set role = 'viewer' where user_id = tests.id('bob') and household_id = tests.id('hhA') $$,
  'admin can change a member role');
select is_empty($$ update public.household_members set role = 'member' where user_id = tests.id('alice') and household_id = tests.id('hhA') returning id $$,
  'admin cannot touch the owner row');
select throws_ok($$ update public.household_members set role = 'admin' where user_id = tests.id('bob') and household_id = tests.id('hhA') $$,
  '42501', null, 'admin cannot promote to admin');
select is((select count(*)::int from public.household_invites), 1, 'admin can see invites');
select is_empty($$ delete from public.households where id = tests.id('hhA') returning id $$, 'admin cannot delete the household');

-- owner ----------------------------------------------------------------------
select tests.as_user('alice');
select lives_ok($$ update public.household_members set role = 'admin' where user_id = tests.id('bob') and household_id = tests.id('hhA') $$,
  'owner can promote to admin');
select throws_ok($$ update public.household_members set role = 'owner' where user_id = tests.id('bob') and household_id = tests.id('hhA') $$,
  '42501', null, 'nobody can set owner through a plain update');
select is_empty($$ delete from public.household_members where user_id = tests.id('alice') and household_id = tests.id('hhA') returning id $$,
  'owner cannot remove themselves');
select isnt_empty($$ delete from public.households where id = tests.id('hhA') returning id $$, 'owner can delete the household');

select tests.as_superuser();
select * from finish();
rollback;
