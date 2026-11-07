-- Household lifecycle RPCs. Direct INSERTs into households / household_members are not allowed
-- for clients (no RLS insert policy); these functions are the supported entry points.

create or replace function public.create_household(
  p_name text,
  p_household_size integer default 1,
  p_currency text default 'RON',
  p_locale text default 'ro',
  p_budget_name text default null,
  p_spending_limit numeric default null,
  p_grocery_limit numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  tz text := 'Europe/Bucharest';
  today date;
  period_start date;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.households (name, household_size, currency, locale, timezone, created_by)
  values (btrim(p_name), p_household_size, upper(p_currency), p_locale, tz, uid)
  returning id into hid;

  today := (now() at time zone tz)::date;
  period_start := date_trunc('month', today)::date;

  insert into public.budgets (household_id, name, period, start_date, end_date, spending_limit, grocery_limit, created_by)
  values (
    hid,
    coalesce(nullif(btrim(p_budget_name), ''), btrim(p_name)),
    'monthly',
    period_start,
    (period_start + interval '1 month - 1 day')::date,
    p_spending_limit,
    p_grocery_limit,
    uid
  );

  return hid;
end;
$$;

create or replace function public.create_household_invite(
  p_household_id uuid,
  p_email text default null,
  p_role public.household_role default 'member'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  caller_role public.household_role;
  raw_token text;
begin
  caller_role := public.household_role_of(p_household_id);
  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'only owners and admins can invite' using errcode = 'insufficient_privilege';
  end if;
  if p_role = 'owner' then
    raise exception 'invites cannot grant the owner role' using errcode = 'check_violation';
  end if;
  if p_role = 'admin' and caller_role <> 'owner' then
    raise exception 'only the owner can invite admins' using errcode = 'insufficient_privilege';
  end if;

  raw_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.household_invites (household_id, email, role, token_hash, invited_by)
  values (
    p_household_id,
    nullif(lower(btrim(p_email)), ''),
    p_role,
    encode(sha256(convert_to(raw_token, 'UTF8')), 'hex'),
    uid
  );
  return raw_token;
end;
$$;

create or replace function public.accept_household_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  caller_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  inv public.household_invites%rowtype;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into inv from public.household_invites
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;

  if not found or inv.status <> 'pending' then
    raise exception 'invite is not valid' using errcode = 'invalid_parameter_value';
  end if;
  if inv.expires_at < now() then
    update public.household_invites set status = 'expired' where id = inv.id;
    raise exception 'invite has expired' using errcode = 'invalid_parameter_value';
  end if;
  if inv.email is not null and inv.email <> caller_email then
    raise exception 'invite was issued for a different email address' using errcode = 'insufficient_privilege';
  end if;

  insert into public.household_members (household_id, user_id, role, invited_by)
  values (inv.household_id, uid, inv.role, inv.invited_by)
  on conflict (household_id, user_id) do nothing;

  update public.household_invites
  set status = 'accepted', accepted_by = uid, accepted_at = now()
  where id = inv.id;

  return inv.household_id;
end;
$$;

create or replace function public.transfer_household_ownership(p_household_id uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_household_owner(p_household_id) then
    raise exception 'only the owner can transfer ownership' using errcode = 'insufficient_privilege';
  end if;
  if p_new_owner = auth.uid() then
    return;
  end if;
  if not exists (
    select 1 from public.household_members where household_id = p_household_id and user_id = p_new_owner
  ) then
    raise exception 'new owner must be a household member' using errcode = 'invalid_parameter_value';
  end if;

  update public.household_members set role = 'admin'
  where household_id = p_household_id and user_id = auth.uid();
  update public.household_members set role = 'owner'
  where household_id = p_household_id and user_id = p_new_owner;
end;
$$;

-- Turns an active reservation into a real expense: inserts the transaction and marks the
-- reservation fulfilled. Runs with the caller's rights, so RLS applies to both writes.
create or replace function public.fulfill_budget_reservation(
  p_reservation_id uuid,
  p_actual_amount numeric,
  p_occurred_on date default current_date,
  p_description text default ''
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  r public.budget_reservations%rowtype;
  cat_id uuid;
  tx_id uuid;
begin
  select * into r from public.budget_reservations where id = p_reservation_id for update;
  if not found or r.status <> 'active' then
    raise exception 'reservation is not active' using errcode = 'invalid_parameter_value';
  end if;

  cat_id := r.category_id;
  if cat_id is null and r.is_grocery then
    select id into cat_id from public.transaction_categories
    where household_id = r.household_id and system_key = 'groceries';
  end if;

  insert into public.transactions (
    household_id, type, amount, occurred_on, description, category_id, scope, paid_by, source, created_by
  ) values (
    r.household_id, 'expense', p_actual_amount, p_occurred_on, coalesce(p_description, ''), cat_id,
    'shared', null,
    case when r.shopping_list_id is not null then 'shopping_list'::public.transaction_source else 'manual' end,
    auth.uid()
  )
  returning id into tx_id;

  update public.budget_reservations
  set status = 'fulfilled', fulfilled_transaction_id = tx_id, fulfilled_at = now()
  where id = r.id;

  return tx_id;
end;
$$;

revoke all on function public.create_household(text, integer, text, text, text, numeric, numeric),
  public.create_household_invite(uuid, text, public.household_role),
  public.accept_household_invite(text),
  public.transfer_household_ownership(uuid, uuid),
  public.fulfill_budget_reservation(uuid, numeric, date, text) from public, anon;
grant execute on function public.create_household(text, integer, text, text, text, numeric, numeric),
  public.create_household_invite(uuid, text, public.household_role),
  public.accept_household_invite(text),
  public.transfer_household_ownership(uuid, uuid),
  public.fulfill_budget_reservation(uuid, numeric, date, text) to authenticated, service_role;
