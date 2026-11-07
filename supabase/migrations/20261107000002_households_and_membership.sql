-- Profiles, households, membership, invites and the RLS helper functions.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_path text,
  locale text not null default 'ro' check (locale in ('ro', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- Number of people the household budgets for (may exceed the number of app accounts).
  household_size smallint not null default 1 check (household_size between 1 and 50),
  currency char(3) not null default 'RON' check (currency ~ '^[A-Z]{3}$'),
  locale text not null default 'ro' check (locale in ('ro', 'en')),
  timezone text not null default 'Europe/Bucharest',
  opening_balance numeric(14, 2) not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger households_set_updated_at before update on public.households
  for each row execute function public.set_updated_at();

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.household_role not null default 'member',
  invited_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);
-- Exactly one owner per household.
create unique index household_members_one_owner_idx on public.household_members (household_id) where role = 'owner';

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text check (email is null or email = lower(email)),
  role public.household_role not null default 'member' check (role <> 'owner'),
  -- sha256 of the invite token; the plaintext token is only returned once by create_household_invite().
  token_hash text not null unique,
  status public.invite_status not null default 'pending',
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index household_invites_household_idx on public.household_invites (household_id, status);

-- ---------------------------------------------------------------------------
-- RLS helper functions. SECURITY DEFINER so they can read household_members
-- without recursing through its own policies.
-- ---------------------------------------------------------------------------

create or replace function public.household_role_of(hid uuid)
returns public.household_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.household_members m
  where m.household_id = hid and m.user_id = auth.uid()
$$;

create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid()
  )
$$;

-- owner or admin
create or replace function public.is_household_admin(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  )
$$;

create or replace function public.is_household_owner(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid() and m.role = 'owner'
  )
$$;

-- owner, admin or member (everything except viewer)
create or replace function public.can_write_household(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid() and m.role in ('owner', 'admin', 'member')
  )
$$;

-- true when `uid` is a member of the household `hid` (used for attribution checks and profile visibility)
create or replace function public.shares_household_with(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid() and theirs.user_id = uid
  )
$$;

-- The creator of a household becomes its owner.
create or replace function public.add_household_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.household_members (household_id, user_id, role)
    values (new.id, new.created_by, 'owner');
  end if;
  return new;
end;
$$;
create trigger households_add_owner after insert on public.households
  for each row execute function public.add_household_owner();

revoke all on function public.household_role_of(uuid), public.is_household_member(uuid),
  public.is_household_admin(uuid), public.is_household_owner(uuid),
  public.can_write_household(uuid), public.shares_household_with(uuid) from public, anon;
grant execute on function public.household_role_of(uuid), public.is_household_member(uuid),
  public.is_household_admin(uuid), public.is_household_owner(uuid),
  public.can_write_household(uuid), public.shares_household_with(uuid) to authenticated, service_role;
