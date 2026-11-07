-- SQL budget engine: totals, grocery spending, reservations vs actual expenses, daily allowance.
-- The same scenario (and numbers) is covered for the TypeScript engine in src/lib/budget-engine.
begin;
select plan(13);
select tests.seed_fixture();

update public.households set opening_balance = 100 where id = tests.id('hhA');
-- the fixture already holds: groceries tx 42 (2026-11-03, alice), reservation 100 (active), contribution 100
insert into public.transactions (household_id, type, amount, occurred_on, description, category_id, scope, paid_by) values
  (tests.id('hhA'), 'income', 5000, '2026-11-01', 'salary', (select id from public.transaction_categories where household_id = tests.id('hhA') and system_key = 'salary'), 'shared', null),
  (tests.id('hhA'), 'expense', 200, '2026-11-02', 'groceries shared', (select id from public.transaction_categories where household_id = tests.id('hhA') and system_key = 'groceries'), 'shared', null),
  (tests.id('hhA'), 'expense', 100, '2026-11-07', 'groceries alice', (select id from public.transaction_categories where household_id = tests.id('hhA') and system_key = 'groceries'), 'individual', tests.id('alice')),
  (tests.id('hhA'), 'expense', 1000, '2026-11-03', 'rent', (select id from public.transaction_categories where household_id = tests.id('hhA') and system_key = 'housing'), 'shared', null),
  (tests.id('hhA'), 'expense', 50, '2026-11-07', 'misc', null, 'shared', null),
  (tests.id('hhA'), 'expense', 999, '2026-10-31', 'before period', null, 'shared', null),
  (tests.id('hhA'), 'expense', 999, '2026-12-01', 'after period', null, 'shared', null);
insert into public.budget_reservations (id, household_id, budget_id, amount, status, fulfilled_at, released_at) values
  (tests.id('res-active'), tests.id('hhA'), tests.id('A-budget'), 200, 'active', null, null),
  (tests.id('res-fulfilled'), tests.id('hhA'), tests.id('A-budget'), 150, 'fulfilled', now(), null),
  (tests.id('res-released'), tests.id('hhA'), tests.id('A-budget'), 100, 'released', null, now());
insert into public.savings_goal_contributions (household_id, goal_id, user_id, amount, contributed_on) values
  (tests.id('hhA'), tests.id('A-goal'), tests.id('alice'), 500, '2026-11-04');

select row_eq(
  $$ select income, expenses, grocery_expenses, shared_expenses, individual_expenses, reserved_total, reserved_grocery,
            committed, remaining, grocery_remaining, days_total, days_left, round(daily_allowance, 4), today_spent
     from public.budget_summary(tests.id('A-budget'), '2026-11-07') $$,
  row(5000::numeric, 1392::numeric, 342::numeric, 1292::numeric, 100::numeric, 300::numeric, 300::numeric,
      1692::numeric, 1308::numeric, 358::numeric, 30, 24, 60.7500::numeric, 150::numeric),
  'budget summary: reservations are excluded from expenses and subtracted from what is left');

select is((select expenses from public.budget_summary(tests.id('A-budget'), '2026-11-07')),
  (select sum(amount) from public.transactions where household_id = tests.id('hhA') and type = 'expense' and occurred_on between '2026-11-01' and '2026-11-30'),
  'summary expenses equal the sum of in-period expense transactions');

select is((select days_left from public.budget_summary(tests.id('A-budget'), '2026-10-15')), 30, 'before the period all days are left');
select is((select days_left from public.budget_summary(tests.id('A-budget'), '2026-12-15')), 0, 'after the period no days are left');
select is((select daily_allowance from public.budget_summary(tests.id('A-budget'), '2026-12-15')), null::numeric, 'no allowance once the period is over');

update public.budgets set spending_limit = null where id = tests.id('A-budget');
select row_eq($$ select remaining, daily_allowance, grocery_remaining from public.budget_summary(tests.id('A-budget'), '2026-11-07') $$,
  row(null::numeric, null::numeric, 358::numeric), 'without a spending limit no allowance is invented');
update public.budgets set spending_limit = 1000 where id = tests.id('A-budget');
select is((select daily_allowance from public.budget_summary(tests.id('A-budget'), '2026-11-07')), 0::numeric,
  'overspent budgets get a zero allowance');
update public.budgets set spending_limit = 3000 where id = tests.id('A-budget');

select row_eq(
  $$ select opening_balance, income_total, expense_total, saved_total, balance, available
     from public.household_balances where household_id = tests.id('hhA') $$,
  row(100::numeric, 5000::numeric, 3390::numeric, 600::numeric, 1710::numeric, 1110::numeric),
  'household balance: opening + income - expenses, minus savings for availability');

select row_eq($$ select current_amount, remaining_amount, percent_complete from public.savings_goal_progress where goal_id = tests.id('A-goal') $$,
  row(600::numeric, 1400::numeric, 30.0::numeric), 'savings goal progress');

select row_eq($$ select expenses, individual_expenses, grocery_expenses from public.spending_by_member(tests.id('hhA'), '2026-11-01', '2026-11-30') where user_id = tests.id('alice') $$,
  row(142::numeric, 100::numeric, 142::numeric), 'spending by member attributes expenses to alice');

-- fulfilling a reservation turns it into a real expense
select tests.as_user('bob');
select lives_ok($$ select public.fulfill_budget_reservation(tests.id('res-active'), 180, '2026-11-05', 'weekly shop') $$, 'member fulfils a reservation');
select row_eq($$ select expenses, reserved_total, round(daily_allowance, 4) from public.budget_summary(tests.id('A-budget'), '2026-11-07') $$,
  row(1572::numeric, 100::numeric, 61.5833::numeric), 'fulfilled reservation becomes an actual expense and stops being reserved');

select tests.as_user('dave');
select is((select count(*)::int from public.budget_summary(tests.id('A-budget'), '2026-11-07') where budget_id is not null), 0,
  'budget summary is invisible across households');

select tests.as_superuser();
select * from finish();
rollback;
