-- Retailers are global reference data (read-only for clients).
-- Stores are global (household_id is null) or custom per household.

create table public.retailers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  country char(2) not null default 'RO',
  website text,
  brand_color text check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger retailers_set_updated_at before update on public.retailers
  for each row execute function public.set_updated_at();

create table public.retailer_stores (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  name text not null,
  address text,
  city text,
  county text,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  -- identifier used by a price adapter for this store
  external_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (retailer_id, household_id, external_id)
);
create index retailer_stores_retailer_idx on public.retailer_stores (retailer_id);
create index retailer_stores_household_idx on public.retailer_stores (household_id) where household_id is not null;
create trigger retailer_stores_set_updated_at before update on public.retailer_stores
  for each row execute function public.set_updated_at();

insert into public.retailers (slug, name, website) values
  ('lidl', 'Lidl', 'https://www.lidl.ro'),
  ('kaufland', 'Kaufland', 'https://www.kaufland.ro'),
  ('carrefour', 'Carrefour', 'https://carrefour.ro'),
  ('auchan', 'Auchan', 'https://www.auchan.ro'),
  ('penny', 'Penny', 'https://www.penny.ro'),
  ('profi', 'Profi', 'https://www.profi.ro'),
  ('mega-image', 'Mega Image', 'https://www.mega-image.ro')
on conflict (slug) do nothing;
