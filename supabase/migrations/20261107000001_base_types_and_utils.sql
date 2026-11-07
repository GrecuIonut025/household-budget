-- Base: extensions, enums and shared utility functions.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists btree_gist with schema extensions;

create type public.household_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.spending_scope as enum ('shared', 'individual');
create type public.transaction_type as enum ('income', 'expense');
create type public.transaction_source as enum ('manual', 'shopping_list', 'import');
create type public.budget_period as enum ('monthly', 'weekly', 'custom');
create type public.goal_status as enum ('active', 'completed', 'archived');
create type public.reservation_status as enum ('active', 'fulfilled', 'released');
create type public.invite_status as enum ('pending', 'accepted', 'revoked', 'expired');
-- Where a price came from. New sources are added with ALTER TYPE ... ADD VALUE.
create type public.price_source as enum ('adapter', 'manual');
create type public.match_method as enum ('barcode', 'name', 'manual', 'adapter_ref');
create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.meal_status as enum ('planned', 'cooked', 'skipped');
create type public.shopping_list_status as enum ('active', 'completed', 'archived');
create type public.alert_direction as enum ('below', 'above');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- GTIN-8/12/13/14 (EAN/UPC) validation including the mod-10 check digit.
create or replace function public.is_valid_gtin(code text)
returns boolean
language plpgsql
immutable
as $$
declare
  len int;
  total int := 0;
  weight int := 3;
  i int;
begin
  if code is null or code !~ '^[0-9]+$' then
    return false;
  end if;
  len := length(code);
  if len not in (8, 12, 13, 14) then
    return false;
  end if;
  for i in reverse (len - 1)..1 loop
    total := total + (substr(code, i, 1))::int * weight;
    weight := 4 - weight;
  end loop;
  return ((10 - (total % 10)) % 10) = (substr(code, len, 1))::int;
end;
$$;
