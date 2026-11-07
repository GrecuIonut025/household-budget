-- Categories, budgets, savings goals and actual transactions.
-- Convention: every household-owned table has household_id and a UNIQUE (id, household_id)
-- so children can use composite FKs that make cross-household references impossible.

create table public.transaction_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind public.transaction_type not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- Stable key for localisation of built-in categories (null for user-created ones).
  system_key text,
  is_grocery boolean not null default false,
  color text,
  icon text,
  sort_order int not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  check (not is_grocery or kind = 'expense')
);
create unique index transaction_categories_name_idx
  on public.transaction_categories (household_id, kind, lower(name));
create unique index transaction_categories_system_key_idx
  on public.transaction_categories (household_id, system_key) where system_key is not null;

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  period public.budget_period not null default 'monthly',
  start_date date not null,
  end_date date not null,
  -- Total planned spending for the period. Null means "no limit set": the engine then
  -- reports no allowance instead of inventing one.
  spending_limit numeric(14, 2) check (spending_limit is null or spending_limit >= 0),
  grocery_limit numeric(14, 2) check (grocery_limit is null or grocery_limit >= 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  check (end_date >= start_date),
  -- at most one active budget covers any given day of a household
  constraint budgets_no_active_overlap exclude using gist (
    household_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (is_active)
);
create index budgets_household_dates_idx on public.budgets (household_id, start_date, end_date);
create trigger budgets_set_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  target_amount numeric(14, 2) not null check (target_amount > 0),
  target_date date,
  -- shared goals belong to the household; individual goals belong to one member
  scope public.spending_scope not null default 'shared',
  owner_id uuid,
  status public.goal_status not null default 'active',
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  check ((scope = 'individual') = (owner_id is not null)),
  -- personal goals disappear together with the member who owns them
  foreign key (household_id, owner_id) references public.household_members (household_id, user_id) on delete cascade
);
create index savings_goals_household_idx on public.savings_goals (household_id, status);
create trigger savings_goals_set_updated_at before update on public.savings_goals
  for each row execute function public.set_updated_at();

create table public.savings_goal_contributions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  goal_id uuid not null,
  -- member who contributed (per-member attribution); nulled when the member leaves
  user_id uuid,
  -- negative amounts are withdrawals
  amount numeric(14, 2) not null check (amount <> 0),
  contributed_on date not null default current_date,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (goal_id, household_id) references public.savings_goals (id, household_id) on delete cascade,
  foreign key (household_id, user_id) references public.household_members (household_id, user_id) on delete set null (user_id)
);
create index savings_contributions_goal_idx on public.savings_goal_contributions (goal_id, contributed_on);
create index savings_contributions_household_idx on public.savings_goal_contributions (household_id, contributed_on);

-- Actual money movements only. Planned shopping money lives in budget_reservations.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  type public.transaction_type not null,
  -- always positive; `type` carries the direction. Amounts are in the household currency.
  amount numeric(14, 2) not null check (amount > 0),
  occurred_on date not null default current_date,
  description text not null default '' check (char_length(description) <= 300),
  category_id uuid,
  scope public.spending_scope not null default 'shared',
  -- member the money belongs to / who paid (per-member attribution)
  paid_by uuid,
  source public.transaction_source not null default 'manual',
  retailer_id uuid references public.retailers (id) on delete set null,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  check (scope = 'shared' or paid_by is not null),
  foreign key (category_id, household_id) references public.transaction_categories (id, household_id) on delete set null (category_id),
  foreign key (household_id, paid_by) references public.household_members (household_id, user_id) on delete set null (paid_by)
);
create index transactions_household_date_idx on public.transactions (household_id, occurred_on desc);
create index transactions_household_type_date_idx on public.transactions (household_id, type, occurred_on);
create index transactions_category_idx on public.transactions (category_id) where category_id is not null;
create index transactions_paid_by_idx on public.transactions (household_id, paid_by, occurred_on) where paid_by is not null;
create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

-- A transaction's category must exist in the same household and have the same kind.
create or replace function public.check_transaction_category()
returns trigger
language plpgsql
as $$
declare
  cat_kind public.transaction_type;
begin
  if new.category_id is not null then
    select c.kind into cat_kind from public.transaction_categories c
    where c.id = new.category_id and c.household_id = new.household_id;
    if cat_kind is distinct from new.type then
      raise exception 'category kind (%) does not match transaction type (%)', cat_kind, new.type
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
create trigger transactions_check_category before insert or update of category_id, type on public.transactions
  for each row execute function public.check_transaction_category();

-- Built-in categories for a fresh household. Names are English; the UI localises by system_key.
create or replace function public.seed_household_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.transaction_categories (household_id, kind, name, system_key, is_grocery, sort_order) values
    (new.id, 'expense', 'Groceries', 'groceries', true, 10),
    (new.id, 'expense', 'Housing', 'housing', false, 20),
    (new.id, 'expense', 'Utilities', 'utilities', false, 30),
    (new.id, 'expense', 'Transport', 'transport', false, 40),
    (new.id, 'expense', 'Health', 'health', false, 50),
    (new.id, 'expense', 'Dining out', 'dining_out', false, 60),
    (new.id, 'expense', 'Entertainment', 'entertainment', false, 70),
    (new.id, 'expense', 'Education', 'education', false, 80),
    (new.id, 'expense', 'Clothing', 'clothing', false, 90),
    (new.id, 'expense', 'Personal care', 'personal_care', false, 100),
    (new.id, 'expense', 'Other', 'other_expense', false, 900),
    (new.id, 'income', 'Salary', 'salary', false, 10),
    (new.id, 'income', 'Other income', 'other_income', false, 900);
  return new;
end;
$$;
create trigger households_seed_categories after insert on public.households
  for each row execute function public.seed_household_categories();
