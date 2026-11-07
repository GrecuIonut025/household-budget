-- Row level security. Model (see docs/ARCHITECTURE.md):
--   * every household-owned table: SELECT for members; writes by role
--   * viewer = read only, member = day-to-day writes, admin = settings/budgets/members, owner = everything
--   * default deny: tables without a policy for a command reject it
-- Every table in `public` MUST have RLS enabled; supabase/tests/database/02-rls-coverage.test.sql enforces it.

-- Attribution columns default to the calling user.
do $$
declare
  t record;
begin
  for t in
    select c.table_name from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'created_by'
      and c.table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE')
  loop
    execute format('alter table public.%I alter column created_by set default auth.uid()', t.table_name);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.retailers enable row level security;
alter table public.retailer_stores enable row level security;
alter table public.transaction_categories enable row level security;
alter table public.budgets enable row level security;
alter table public.savings_goals enable row level security;
alter table public.savings_goal_contributions enable row level security;
alter table public.transactions enable row level security;
alter table public.products enable row level security;
alter table public.product_barcodes enable row level security;
alter table public.product_prices enable row level security;
alter table public.product_price_history enable row level security;
alter table public.product_purchase_history enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.pantry_items enable row level security;
alter table public.meal_plans enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.budget_reservations enable row level security;
alter table public.price_alerts enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_household_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- households (INSERT only through create_household())
-- ---------------------------------------------------------------------------
create policy households_select on public.households for select to authenticated
  using (public.is_household_member(id));
create policy households_update on public.households for update to authenticated
  using (public.is_household_admin(id)) with check (public.is_household_admin(id));
create policy households_delete on public.households for delete to authenticated
  using (public.is_household_owner(id));

-- ---------------------------------------------------------------------------
-- household_members (INSERT only through invites / create_household())
-- The owner row is immutable here; use transfer_household_ownership().
-- ---------------------------------------------------------------------------
create policy household_members_select on public.household_members for select to authenticated
  using (public.is_household_member(household_id));
create policy household_members_update on public.household_members for update to authenticated
  using (
    public.is_household_admin(household_id) and role <> 'owner'
    and (role <> 'admin' or public.is_household_owner(household_id))
  )
  with check (
    role <> 'owner' and (role <> 'admin' or public.is_household_owner(household_id))
  );
create policy household_members_delete on public.household_members for delete to authenticated
  using (
    role <> 'owner' and (
      user_id = auth.uid()
      or (public.is_household_admin(household_id) and (role <> 'admin' or public.is_household_owner(household_id)))
    )
  );

create or replace function public.guard_member_identity()
returns trigger
language plpgsql
as $$
begin
  if new.household_id is distinct from old.household_id or new.user_id is distinct from old.user_id then
    raise exception 'household_id and user_id of a membership are immutable' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger household_members_guard_identity before update on public.household_members
  for each row execute function public.guard_member_identity();

-- ---------------------------------------------------------------------------
-- household_invites (create via create_household_invite(); admins can list and revoke)
-- ---------------------------------------------------------------------------
create policy household_invites_select on public.household_invites for select to authenticated
  using (public.is_household_admin(household_id));
create policy household_invites_revoke on public.household_invites for update to authenticated
  using (public.is_household_admin(household_id) and status = 'pending')
  with check (public.is_household_admin(household_id) and status = 'revoked');
create policy household_invites_delete on public.household_invites for delete to authenticated
  using (public.is_household_admin(household_id));

-- ---------------------------------------------------------------------------
-- retailers / stores: global reference data
-- ---------------------------------------------------------------------------
create policy retailers_select on public.retailers for select to authenticated using (true);

create policy retailer_stores_select on public.retailer_stores for select to authenticated
  using (household_id is null or public.is_household_member(household_id));
create policy retailer_stores_insert on public.retailer_stores for insert to authenticated
  with check (household_id is not null and public.can_write_household(household_id));
create policy retailer_stores_update on public.retailer_stores for update to authenticated
  using (household_id is not null and public.can_write_household(household_id))
  with check (household_id is not null and public.can_write_household(household_id));
create policy retailer_stores_delete on public.retailer_stores for delete to authenticated
  using (household_id is not null and public.can_write_household(household_id));

-- ---------------------------------------------------------------------------
-- Budgeting
-- ---------------------------------------------------------------------------
create policy transaction_categories_select on public.transaction_categories for select to authenticated
  using (public.is_household_member(household_id));
create policy transaction_categories_insert on public.transaction_categories for insert to authenticated
  with check (public.can_write_household(household_id));
create policy transaction_categories_update on public.transaction_categories for update to authenticated
  using (public.can_write_household(household_id)) with check (public.can_write_household(household_id));
create policy transaction_categories_delete on public.transaction_categories for delete to authenticated
  using (public.can_write_household(household_id) and system_key is null);

create policy budgets_select on public.budgets for select to authenticated
  using (public.is_household_member(household_id));
create policy budgets_insert on public.budgets for insert to authenticated
  with check (public.is_household_admin(household_id));
create policy budgets_update on public.budgets for update to authenticated
  using (public.is_household_admin(household_id)) with check (public.is_household_admin(household_id));
create policy budgets_delete on public.budgets for delete to authenticated
  using (public.is_household_admin(household_id));

-- Savings goals: shared goals are managed by any writer, individual goals by their owner (admins can manage all).
create policy savings_goals_select on public.savings_goals for select to authenticated
  using (public.is_household_member(household_id));
create policy savings_goals_insert on public.savings_goals for insert to authenticated
  with check (
    public.is_household_admin(household_id)
    or (public.can_write_household(household_id) and (scope = 'shared' or owner_id = auth.uid()))
  );
create policy savings_goals_update on public.savings_goals for update to authenticated
  using (
    public.is_household_admin(household_id)
    or (public.can_write_household(household_id) and (scope = 'shared' or owner_id = auth.uid()))
  )
  with check (
    public.is_household_admin(household_id)
    or (public.can_write_household(household_id) and (scope = 'shared' or owner_id = auth.uid()))
  );
create policy savings_goals_delete on public.savings_goals for delete to authenticated
  using (
    public.is_household_admin(household_id)
    or (public.can_write_household(household_id) and (scope = 'shared' or owner_id = auth.uid()))
  );

create policy savings_contributions_select on public.savings_goal_contributions for select to authenticated
  using (public.is_household_member(household_id));
create policy savings_contributions_insert on public.savings_goal_contributions for insert to authenticated
  with check (
    public.is_household_admin(household_id)
    or (public.can_write_household(household_id) and user_id = auth.uid())
  );
create policy savings_contributions_update on public.savings_goal_contributions for update to authenticated
  using (
    public.is_household_admin(household_id)
    or (public.can_write_household(household_id) and user_id = auth.uid())
  )
  with check (
    public.is_household_admin(household_id)
    or (public.can_write_household(household_id) and user_id = auth.uid())
  );
create policy savings_contributions_delete on public.savings_goal_contributions for delete to authenticated
  using (
    public.is_household_admin(household_id)
    or (public.can_write_household(household_id) and user_id = auth.uid())
  );

-- Transactions: members record their own spending (paid_by = themselves, or unattributed shared spending);
-- they edit their own rows; admins can manage and attribute anything.
create policy transactions_select on public.transactions for select to authenticated
  using (public.is_household_member(household_id));
create policy transactions_insert on public.transactions for insert to authenticated
  with check (
    public.is_household_admin(household_id)
    or (public.can_write_household(household_id) and (paid_by is null or paid_by = auth.uid()))
  );
create policy transactions_update on public.transactions for update to authenticated
  using (
    public.is_household_admin(household_id)
    or (public.can_write_household(household_id) and created_by = auth.uid())
  )
  with check (
    public.is_household_admin(household_id)
    or (public.can_write_household(household_id) and (paid_by is null or paid_by = auth.uid()))
  );
create policy transactions_delete on public.transactions for delete to authenticated
  using (
    public.is_household_admin(household_id)
    or (public.can_write_household(household_id) and created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Grocery ecosystem: members read, writers (owner/admin/member) write.
-- product_price_history is append-only via trigger: no client write policies.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'products', 'product_barcodes', 'product_prices', 'product_purchase_history',
    'recipes', 'recipe_ingredients', 'pantry_items', 'meal_plans',
    'shopping_lists', 'shopping_list_items', 'budget_reservations'
  ]
  loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_household_member(household_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_write_household(household_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_write_household(household_id)) with check (public.can_write_household(household_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_write_household(household_id))', t || '_delete', t);
  end loop;
end $$;

create policy product_price_history_select on public.product_price_history for select to authenticated
  using (public.is_household_member(household_id));

-- Price alerts are personal: owners of the alert manage them, admins can manage all.
create policy price_alerts_select on public.price_alerts for select to authenticated
  using (public.is_household_member(household_id));
create policy price_alerts_insert on public.price_alerts for insert to authenticated
  with check (public.can_write_household(household_id) and user_id = auth.uid());
create policy price_alerts_update on public.price_alerts for update to authenticated
  using (public.is_household_admin(household_id) or (public.can_write_household(household_id) and user_id = auth.uid()))
  with check (public.is_household_admin(household_id) or (public.can_write_household(household_id) and user_id = auth.uid()));
create policy price_alerts_delete on public.price_alerts for delete to authenticated
  using (public.is_household_admin(household_id) or (public.can_write_household(household_id) and user_id = auth.uid()));

-- A row can never be moved to another household by an UPDATE.
create or replace function public.guard_household_id_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.household_id is distinct from old.household_id then
    raise exception 'household_id is immutable' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

do $$
declare
  t record;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'household_id' and tb.table_type = 'BASE TABLE'
      and c.table_name <> 'household_members'
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.guard_household_id_immutable()',
      t.table_name || '_guard_household_id', t.table_name);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Privileges: anonymous users never touch application data.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
-- Reference data is read-only for clients; writes go through the service role.
revoke insert, update, delete on public.retailers from authenticated;
revoke insert, update, delete on public.product_price_history from authenticated;
