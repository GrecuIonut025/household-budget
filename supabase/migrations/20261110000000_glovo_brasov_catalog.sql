-- Glovo Brașov supermarket catalog (local-first price comparison source).
-- Separate from household product_prices / Lidl / Monitorul adapters.

create table public.glovo_markets (
  id uuid primary key default gen_random_uuid(),
  retailer_key text not null unique
    check (retailer_key in ('profi', 'carrefour', 'kaufland', 'mega_image')),
  store_slug text not null unique,
  name text not null,
  city text not null default 'Brașov',
  city_code text not null default 'brv',
  brand_color text check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$'),
  logo_emoji text,
  is_active boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger glovo_markets_set_updated_at before update on public.glovo_markets
  for each row execute function public.set_updated_at();

create table public.glovo_products (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.glovo_markets (id) on delete cascade,
  -- Stable upsert key: retailer_key + identity_key
  retailer_key text not null
    check (retailer_key in ('profi', 'carrefour', 'kaufland', 'mega_image')),
  identity_key text not null,
  glovo_product_id text,
  external_id text,
  store_product_id text,
  name text not null,
  description text,
  price numeric(12, 2) check (price is null or price >= 0),
  currency text not null default 'RON',
  price_display text,
  image_url text,
  image_id text,
  category text,
  eans text[] not null default '{}',
  out_of_stock boolean not null default false,
  is_weighted boolean,
  sale_type text,
  observed_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (retailer_key, identity_key)
);
create index glovo_products_market_idx on public.glovo_products (market_id);
create index glovo_products_name_trgm_idx on public.glovo_products
  using gin (lower(name) extensions.gin_trgm_ops);
create index glovo_products_eans_idx on public.glovo_products using gin (eans);
create index glovo_products_price_idx on public.glovo_products (price) where price is not null;
create trigger glovo_products_set_updated_at before update on public.glovo_products
  for each row execute function public.set_updated_at();

insert into public.glovo_markets (retailer_key, store_slug, name, brand_color, logo_emoji) values
  ('profi', 'profi-brv', 'Profi', '#E30613', 'P'),
  ('carrefour', 'carrefour-supermarket-brv', 'Carrefour', '#0057A8', 'C'),
  ('kaufland', 'kaufland-brv-bo', 'Kaufland', '#E2001A', 'K'),
  ('mega_image', 'mega-image-brv', 'Mega Image', '#00A651', 'M')
on conflict (retailer_key) do update set
  store_slug = excluded.store_slug,
  name = excluded.name,
  brand_color = excluded.brand_color,
  logo_emoji = excluded.logo_emoji,
  is_active = true;

-- Sample Brașov catalog rows so Comparare prețuri works before a live crawl.
with m as (select id, retailer_key from public.glovo_markets)
insert into public.glovo_products (
  market_id, retailer_key, identity_key, glovo_product_id, name, description,
  price, currency, price_display, image_url, category, eans, out_of_stock, observed_at
)
select
  m.id,
  s.retailer_key,
  s.identity_key,
  s.glovo_product_id,
  s.name,
  s.description,
  s.price,
  'RON',
  s.price_display,
  s.image_url,
  s.category,
  s.eans,
  false,
  now()
from m
join (
  values
    ('profi', 'sample-lapte-1l', 'g-profi-lapte', 'Lapte Zuzu 1.5% 1L', 'Lapte consum', 6.49, '6,49 lei', null::text, 'Lactate', array['5941001500123']::text[]),
    ('carrefour', 'sample-lapte-1l', 'g-carrefour-lapte', 'Lapte Zuzu 1.5% 1L', 'Lapte consum', 6.89, '6,89 lei', null::text, 'Lactate', array['5941001500123']::text[]),
    ('kaufland', 'sample-lapte-1l', 'g-kaufland-lapte', 'Lapte Zuzu 1.5% 1L', 'Lapte consum', 6.29, '6,29 lei', null::text, 'Lactate', array['5941001500123']::text[]),
    ('mega_image', 'sample-lapte-1l', 'g-mega-lapte', 'Lapte Zuzu 1.5% 1L', 'Lapte consum', 7.19, '7,19 lei', null::text, 'Lactate', array['5941001500123']::text[]),
    ('profi', 'sample-paine', 'g-profi-paine', 'Pâine albă feliată 500g', 'Panificație', 4.29, '4,29 lei', null::text, 'Panificație', array[]::text[]),
    ('carrefour', 'sample-paine', 'g-carrefour-paine', 'Pâine albă feliată 500g', 'Panificație', 3.99, '3,99 lei', null::text, 'Panificație', array[]::text[]),
    ('kaufland', 'sample-paine', 'g-kaufland-paine', 'Pâine albă feliată 500g', 'Panificație', 4.49, '4,49 lei', null::text, 'Panificație', array[]::text[]),
    ('mega_image', 'sample-paine', 'g-mega-paine', 'Pâine albă feliată 500g', 'Panificație', 4.79, '4,79 lei', null::text, 'Panificație', array[]::text[]),
    ('profi', 'sample-oua', 'g-profi-oua', 'Ouă mărimea M 10 buc', 'Ouă', 14.99, '14,99 lei', null::text, 'Ouă', array['5941001999001']::text[]),
    ('carrefour', 'sample-oua', 'g-carrefour-oua', 'Ouă mărimea M 10 buc', 'Ouă', 13.49, '13,49 lei', null::text, 'Ouă', array['5941001999001']::text[]),
    ('kaufland', 'sample-oua', 'g-kaufland-oua', 'Ouă mărimea M 10 buc', 'Ouă', 12.99, '12,99 lei', null::text, 'Ouă', array['5941001999001']::text[]),
    ('mega_image', 'sample-oua', 'g-mega-oua', 'Ouă mărimea M 10 buc', 'Ouă', 15.49, '15,49 lei', null::text, 'Ouă', array['5941001999001']::text[]),
    ('profi', 'sample-banane', 'g-profi-banane', 'Banane vrac', 'Fructe', 6.99, '6,99 lei/kg', null::text, 'Fructe', array[]::text[]),
    ('carrefour', 'sample-banane', 'g-carrefour-banane', 'Banane vrac', 'Fructe', 7.49, '7,49 lei/kg', null::text, 'Fructe', array[]::text[]),
    ('kaufland', 'sample-banane', 'g-kaufland-banane', 'Banane vrac', 'Fructe', 6.49, '6,49 lei/kg', null::text, 'Fructe', array[]::text[]),
    ('mega_image', 'sample-banane', 'g-mega-banane', 'Banane vrac', 'Fructe', 7.99, '7,99 lei/kg', null::text, 'Fructe', array[]::text[])
) as s(retailer_key, identity_key, glovo_product_id, name, description, price, price_display, image_url, category, eans)
  on m.retailer_key = s.retailer_key
on conflict (retailer_key, identity_key) do nothing;

alter table public.glovo_markets enable row level security;
alter table public.glovo_products enable row level security;

-- Global reference catalog: any signed-in user can read; writes via service_role / importer.
create policy glovo_markets_select on public.glovo_markets for select to authenticated using (true);
create policy glovo_products_select on public.glovo_products for select to authenticated using (true);

revoke insert, update, delete on public.glovo_markets from authenticated, anon;
revoke insert, update, delete on public.glovo_products from authenticated, anon;
grant select on public.glovo_markets to authenticated, anon;
grant select on public.glovo_products to authenticated, anon;
grant all on public.glovo_markets to service_role;
grant all on public.glovo_products to service_role;
