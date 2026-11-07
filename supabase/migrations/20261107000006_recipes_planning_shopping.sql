-- Recipes, pantry, meal planner, shopping lists, budget reservations and price alerts.

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text,
  servings numeric(6, 2) not null default 2 check (servings > 0),
  prep_minutes integer check (prep_minutes is null or prep_minutes >= 0),
  cook_minutes integer check (cook_minutes is null or cook_minutes >= 0),
  instructions text,
  tags text[] not null default '{}',
  image_path text,
  source_url text,
  is_favorite boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);
create index recipes_household_idx on public.recipes (household_id);
create index recipes_tags_idx on public.recipes using gin (tags);
create trigger recipes_set_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_id uuid not null,
  -- linked catalogue product (optional: free-text ingredients are allowed)
  product_id uuid,
  name text not null check (char_length(btrim(name)) > 0),
  quantity numeric(12, 3) check (quantity is null or quantity > 0),
  unit text,
  is_optional boolean not null default false,
  note text,
  sort_order integer not null default 0,
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade,
  foreign key (product_id, household_id) references public.products (id, household_id) on delete set null (product_id)
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, sort_order);
create index recipe_ingredients_product_idx on public.recipe_ingredients (product_id) where product_id is not null;

create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid,
  name text not null check (char_length(btrim(name)) > 0),
  quantity numeric(12, 3) not null default 0 check (quantity >= 0),
  unit text,
  -- below this quantity the item counts as running low
  min_quantity numeric(12, 3) check (min_quantity is null or min_quantity >= 0),
  expires_on date,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, household_id) references public.products (id, household_id) on delete set null (product_id)
);
create unique index pantry_items_product_idx on public.pantry_items (household_id, product_id) where product_id is not null;
create index pantry_items_expiry_idx on public.pantry_items (household_id, expires_on) where expires_on is not null;
create trigger pantry_items_set_updated_at before update on public.pantry_items
  for each row execute function public.set_updated_at();

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  plan_date date not null,
  meal_type public.meal_type not null,
  recipe_id uuid,
  -- used when no recipe is linked
  custom_title text,
  servings numeric(6, 2) check (servings is null or servings > 0),
  status public.meal_status not null default 'planned',
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recipe_id is not null or nullif(btrim(custom_title), '') is not null),
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade
);
create index meal_plans_household_date_idx on public.meal_plans (household_id, plan_date);
create trigger meal_plans_set_updated_at before update on public.meal_plans
  for each row execute function public.set_updated_at();

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  status public.shopping_list_status not null default 'active',
  scope public.spending_scope not null default 'shared',
  owner_id uuid,
  retailer_id uuid references public.retailers (id) on delete set null,
  planned_for date,
  planned_budget numeric(14, 2) check (planned_budget is null or planned_budget >= 0),
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  check ((scope = 'individual') = (owner_id is not null)),
  foreign key (household_id, owner_id) references public.household_members (household_id, user_id) on delete cascade
);
create index shopping_lists_household_idx on public.shopping_lists (household_id, status);
create trigger shopping_lists_set_updated_at before update on public.shopping_lists
  for each row execute function public.set_updated_at();

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null,
  product_id uuid,
  recipe_id uuid,
  name text not null check (char_length(btrim(name)) > 0),
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  unit text,
  estimated_unit_price numeric(12, 2) check (estimated_unit_price is null or estimated_unit_price >= 0),
  actual_unit_price numeric(12, 2) check (actual_unit_price is null or actual_unit_price >= 0),
  is_checked boolean not null default false,
  checked_by uuid references public.profiles (id) on delete set null,
  checked_at timestamptz,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (list_id, household_id) references public.shopping_lists (id, household_id) on delete cascade,
  foreign key (product_id, household_id) references public.products (id, household_id) on delete set null (product_id),
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete set null (recipe_id)
);
create index shopping_list_items_list_idx on public.shopping_list_items (list_id, sort_order);
create index shopping_list_items_product_idx on public.shopping_list_items (product_id) where product_id is not null;
create trigger shopping_list_items_set_updated_at before update on public.shopping_list_items
  for each row execute function public.set_updated_at();

-- Money set aside for planned shopping. NEVER counted as an actual expense; the budget engine
-- reports it separately and subtracts it from what is still available to spend.
create table public.budget_reservations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  budget_id uuid not null,
  shopping_list_id uuid,
  category_id uuid,
  amount numeric(14, 2) not null check (amount > 0),
  status public.reservation_status not null default 'active',
  -- grocery reservations count against the budget's grocery limit
  is_grocery boolean not null default true,
  note text,
  reserved_by uuid references public.profiles (id) on delete set null,
  fulfilled_transaction_id uuid,
  fulfilled_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  check (status <> 'fulfilled' or fulfilled_at is not null),
  foreign key (budget_id, household_id) references public.budgets (id, household_id) on delete cascade,
  foreign key (shopping_list_id, household_id) references public.shopping_lists (id, household_id) on delete set null (shopping_list_id),
  foreign key (category_id, household_id) references public.transaction_categories (id, household_id) on delete set null (category_id),
  foreign key (fulfilled_transaction_id, household_id) references public.transactions (id, household_id) on delete set null (fulfilled_transaction_id)
);
create index budget_reservations_budget_idx on public.budget_reservations (budget_id, status);
-- one live reservation per shopping list
create unique index budget_reservations_list_active_idx on public.budget_reservations (shopping_list_id)
  where status = 'active' and shopping_list_id is not null;
create trigger budget_reservations_set_updated_at before update on public.budget_reservations
  for each row execute function public.set_updated_at();

create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid not null,
  -- null retailer = any retailer
  retailer_id uuid references public.retailers (id) on delete cascade,
  user_id uuid not null,
  direction public.alert_direction not null default 'below',
  target_price numeric(12, 2) not null check (target_price > 0),
  is_active boolean not null default true,
  last_triggered_at timestamptz,
  last_triggered_price numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, household_id) references public.products (id, household_id) on delete cascade,
  foreign key (household_id, user_id) references public.household_members (household_id, user_id) on delete cascade,
  unique nulls not distinct (user_id, product_id, retailer_id, direction)
);
create index price_alerts_product_idx on public.price_alerts (product_id) where is_active;
create trigger price_alerts_set_updated_at before update on public.price_alerts
  for each row execute function public.set_updated_at();
