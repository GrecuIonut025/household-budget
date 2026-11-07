-- Product catalogue, barcodes, retailer prices, price history and purchase history
-- (with trigger-maintained product statistics).

create table public.products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  brand text,
  category text,
  -- unit a single purchasable item is counted in
  unit text not null default 'pcs' check (unit in ('pcs', 'g', 'kg', 'ml', 'l', 'pack')),
  -- content of one item, e.g. 500 g
  package_size numeric(12, 3) check (package_size is null or package_size > 0),
  package_unit text check (package_unit is null or package_unit in ('g', 'kg', 'ml', 'l', 'pcs')),
  image_path text,
  notes text,
  is_archived boolean not null default false,

  -- Statistics maintained by triggers on product_purchase_history. Clients cannot write them.
  purchase_count integer not null default 0,
  total_quantity numeric(14, 3) not null default 0,
  total_spent numeric(14, 2) not null default 0,
  avg_price numeric(12, 4),
  min_price numeric(12, 2),
  max_price numeric(12, 2),
  last_price numeric(12, 2),
  last_purchase_date date,
  last_retailer_id uuid references public.retailers (id) on delete set null,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);
create unique index products_identity_idx on public.products (household_id, lower(name), lower(coalesce(brand, '')));
create index products_household_idx on public.products (household_id) where not is_archived;
create index products_name_trgm_idx on public.products using gin (lower(name) extensions.gin_trgm_ops);
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_barcodes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid not null,
  barcode text not null check (public.is_valid_gtin(barcode)),
  created_at timestamptz not null default now(),
  foreign key (product_id, household_id) references public.products (id, household_id) on delete cascade,
  unique (household_id, barcode)
);
create index product_barcodes_product_idx on public.product_barcodes (product_id);

-- Current known price per product / retailer / store.
create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid not null,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  store_id uuid references public.retailer_stores (id) on delete cascade,
  price numeric(12, 2) not null check (price >= 0),
  currency char(3) not null default 'RON' check (currency ~ '^[A-Z]{3}$'),
  -- price per `unit_label` (e.g. per kg / per l), when known
  unit_price numeric(12, 4) check (unit_price is null or unit_price >= 0),
  unit_label text,
  is_promo boolean not null default false,
  promo_ends_on date,
  source public.price_source not null,
  -- How the price was linked to the product. match_confidence is 0..1; required for adapter prices.
  match_method public.match_method,
  match_confidence numeric(4, 3) check (match_confidence is null or match_confidence between 0 and 1),
  is_verified boolean not null default false,
  external_ref text,
  source_url text,
  observed_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, household_id) references public.products (id, household_id) on delete cascade,
  check (source = 'manual' or match_confidence is not null),
  unique nulls not distinct (product_id, retailer_id, store_id)
);
create index product_prices_household_product_idx on public.product_prices (household_id, product_id);
create index product_prices_retailer_idx on public.product_prices (retailer_id);
create trigger product_prices_set_updated_at before update on public.product_prices
  for each row execute function public.set_updated_at();

-- Append-only log of every price observation recorded in product_prices.
create table public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid not null,
  retailer_id uuid not null references public.retailers (id) on delete cascade,
  store_id uuid references public.retailer_stores (id) on delete set null,
  price numeric(12, 2) not null check (price >= 0),
  currency char(3) not null default 'RON',
  unit_price numeric(12, 4),
  is_promo boolean not null default false,
  source public.price_source not null,
  match_confidence numeric(4, 3),
  observed_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  foreign key (product_id, household_id) references public.products (id, household_id) on delete cascade
);
create index product_price_history_product_idx on public.product_price_history (product_id, observed_at desc);
create index product_price_history_retailer_idx on public.product_price_history (product_id, retailer_id, observed_at desc);

create or replace function public.record_product_price_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.price is distinct from old.price
     or new.is_promo is distinct from old.is_promo
     or new.observed_at is distinct from old.observed_at then
    insert into public.product_price_history (
      household_id, product_id, retailer_id, store_id, price, currency, unit_price,
      is_promo, source, match_confidence, observed_at
    ) values (
      new.household_id, new.product_id, new.retailer_id, new.store_id, new.price, new.currency, new.unit_price,
      new.is_promo, new.source, new.match_confidence, new.observed_at
    );
  end if;
  return new;
end;
$$;
create trigger product_prices_record_history after insert or update on public.product_prices
  for each row execute function public.record_product_price_history();

create table public.product_purchase_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid not null,
  retailer_id uuid references public.retailers (id) on delete set null,
  store_id uuid references public.retailer_stores (id) on delete set null,
  -- the budget transaction this purchase belongs to, when there is one
  transaction_id uuid,
  purchased_on date not null default current_date,
  -- number of units bought, priced at unit_price each
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  total_price numeric(14, 2) generated always as (round(quantity * unit_price, 2)) stored,
  is_promo boolean not null default false,
  purchased_by uuid,
  created_at timestamptz not null default now(),
  foreign key (product_id, household_id) references public.products (id, household_id) on delete cascade,
  foreign key (transaction_id, household_id) references public.transactions (id, household_id) on delete set null (transaction_id),
  foreign key (household_id, purchased_by) references public.household_members (household_id, user_id) on delete set null (purchased_by)
);
create index purchase_history_product_idx on public.product_purchase_history (product_id, purchased_on desc);
create index purchase_history_household_date_idx on public.product_purchase_history (household_id, purchased_on desc);
create index purchase_history_transaction_idx on public.product_purchase_history (transaction_id) where transaction_id is not null;

-- ---------------------------------------------------------------------------
-- Product statistics
-- ---------------------------------------------------------------------------

-- Full recomputation, used after updates and deletes of purchase rows.
create or replace function public.recompute_product_stats(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  last_row record;
begin
  select ph.unit_price, ph.purchased_on, ph.retailer_id into last_row
  from public.product_purchase_history ph
  where ph.product_id = p_product_id
  order by ph.purchased_on desc, ph.created_at desc, ph.id desc
  limit 1;

  update public.products p set
    purchase_count = agg.cnt,
    total_quantity = agg.qty,
    total_spent = agg.spent,
    avg_price = case when agg.qty > 0 then agg.spent / agg.qty end,
    min_price = agg.min_p,
    max_price = agg.max_p,
    last_price = last_row.unit_price,
    last_purchase_date = last_row.purchased_on,
    last_retailer_id = last_row.retailer_id
  from (
    select count(*)::int as cnt,
           coalesce(sum(quantity), 0) as qty,
           coalesce(sum(total_price), 0) as spent,
           min(unit_price) as min_p,
           max(unit_price) as max_p
    from public.product_purchase_history where product_id = p_product_id
  ) agg
  where p.id = p_product_id;
end;
$$;

create or replace function public.on_purchase_inserted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.products p set
    purchase_count = p.purchase_count + 1,
    total_quantity = p.total_quantity + new.quantity,
    total_spent = p.total_spent + new.total_price,
    avg_price = (p.total_spent + new.total_price) / (p.total_quantity + new.quantity),
    min_price = least(coalesce(p.min_price, new.unit_price), new.unit_price),
    max_price = greatest(coalesce(p.max_price, new.unit_price), new.unit_price),
    last_price = case when p.last_purchase_date is null or new.purchased_on >= p.last_purchase_date
                      then new.unit_price else p.last_price end,
    last_retailer_id = case when p.last_purchase_date is null or new.purchased_on >= p.last_purchase_date
                            then new.retailer_id else p.last_retailer_id end,
    last_purchase_date = greatest(coalesce(p.last_purchase_date, new.purchased_on), new.purchased_on)
  where p.id = new.product_id;
  return new;
end;
$$;
create trigger purchase_history_stats_insert after insert on public.product_purchase_history
  for each row execute function public.on_purchase_inserted();

create or replace function public.on_purchase_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recompute_product_stats(old.product_id);
  end if;
  if tg_op = 'UPDATE' and new.product_id is distinct from old.product_id then
    perform public.recompute_product_stats(new.product_id);
  end if;
  return null;
end;
$$;
create trigger purchase_history_stats_change after update or delete on public.product_purchase_history
  for each row execute function public.on_purchase_changed();

-- Statistics are derived data: only trigger-driven updates (nested trigger depth) may change them.
create or replace function public.guard_product_stats()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() < 2 and (
       new.purchase_count is distinct from old.purchase_count
    or new.total_quantity is distinct from old.total_quantity
    or new.total_spent is distinct from old.total_spent
    or new.avg_price is distinct from old.avg_price
    or new.min_price is distinct from old.min_price
    or new.max_price is distinct from old.max_price
    or new.last_price is distinct from old.last_price
    or new.last_purchase_date is distinct from old.last_purchase_date
    or new.last_retailer_id is distinct from old.last_retailer_id
  ) then
    raise exception 'product statistics are maintained automatically and cannot be edited'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger products_guard_stats before update on public.products
  for each row execute function public.guard_product_stats();
