-- "My Products": per-household preferences stored on the product itself.
-- Statistics columns stay protected by guard_product_stats; these are plain user-editable fields.

alter table public.products
  add column is_favorite boolean not null default false,
  add column is_frequent boolean not null default false,
  add column preferred_retailer_id uuid references public.retailers (id) on delete set null,
  -- where the descriptive data came from; never anything the user did not confirm
  add column data_source text not null default 'manual' check (data_source in ('manual', 'open_food_facts'));

create index products_favorites_idx on public.products (household_id) where is_favorite and not is_archived;
create index products_preferred_retailer_idx on public.products (preferred_retailer_id) where preferred_retailer_id is not null;
