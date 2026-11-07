-- Recipe management extensions: categories, "already at home" flag, ingredient substitutions,
-- product-specific unit weights/volumes (for unit conversion) and an atomic save_recipe() function.

-- ---------------------------------------------------------------------------
-- recipes: category and tenant-safe image path
-- ---------------------------------------------------------------------------
alter table public.recipes
  add column category text
    check (category is null or category in (
      'breakfast', 'main', 'soup', 'salad', 'side', 'snack', 'dessert', 'baking', 'drink', 'other'
    ));
create index recipes_category_idx on public.recipes (household_id, category) where category is not null;
create index recipes_favorite_idx on public.recipes (household_id) where is_favorite;

-- Photos live in the private household-media bucket under <household_id>/recipes/...; a recipe can never point at
-- another household's folder.
alter table public.recipes
  add constraint recipes_image_path_scoped
    check (image_path is null or image_path like household_id::text || '/%');

-- ---------------------------------------------------------------------------
-- recipe_ingredients: supported units, "already at home" flag, referenceable by substitutions
-- ---------------------------------------------------------------------------
alter table public.recipe_ingredients
  add column is_at_home boolean not null default false,
  add constraint recipe_ingredients_unit_supported check (unit is null or unit in ('g', 'kg', 'ml', 'l', 'pcs')),
  add constraint recipe_ingredients_id_household_key unique (id, household_id);

create table public.recipe_ingredient_substitutions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  ingredient_id uuid not null,
  product_id uuid,
  name text not null check (char_length(btrim(name)) > 0),
  -- null quantity/unit = same amount as the ingredient it replaces
  quantity numeric(12, 3) check (quantity is null or quantity > 0),
  unit text check (unit is null or unit in ('g', 'kg', 'ml', 'l', 'pcs')),
  note text,
  sort_order integer not null default 0,
  foreign key (ingredient_id, household_id) references public.recipe_ingredients (id, household_id) on delete cascade,
  foreign key (product_id, household_id) references public.products (id, household_id) on delete set null (product_id),
  check ((quantity is null) = (unit is null))
);
create index recipe_ingredient_substitutions_ingredient_idx
  on public.recipe_ingredient_substitutions (ingredient_id, sort_order);
create index recipe_ingredient_substitutions_product_idx
  on public.recipe_ingredient_substitutions (product_id) where product_id is not null;
create index recipe_ingredient_substitutions_household_idx on public.recipe_ingredient_substitutions (household_id);

-- ---------------------------------------------------------------------------
-- product_unit_specs: what one piece weighs / holds, and density, when the product defines it.
-- Unit conversion only crosses mass / volume / count when the matching value exists here.
-- ---------------------------------------------------------------------------
create table public.product_unit_specs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid not null,
  -- grams in one piece (e.g. egg ~ 60 g)
  unit_weight_g numeric(12, 3) check (unit_weight_g is null or unit_weight_g > 0),
  -- millilitres in one piece (e.g. a 330 ml can)
  unit_volume_ml numeric(12, 3) check (unit_volume_ml is null or unit_volume_ml > 0),
  -- grams per millilitre (e.g. olive oil ~ 0.91)
  density_g_per_ml numeric(8, 4) check (density_g_per_ml is null or density_g_per_ml > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, household_id) references public.products (id, household_id) on delete cascade,
  unique (product_id),
  check (unit_weight_g is not null or unit_volume_ml is not null or density_g_per_ml is not null)
);
create index product_unit_specs_household_idx on public.product_unit_specs (household_id);
create trigger product_unit_specs_set_updated_at before update on public.product_unit_specs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: members read, writers (owner/admin/member) write; household_id is immutable.
-- ---------------------------------------------------------------------------
alter table public.recipe_ingredient_substitutions enable row level security;
alter table public.product_unit_specs enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['recipe_ingredient_substitutions', 'product_unit_specs']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_household_member(household_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_write_household(household_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_write_household(household_id)) with check (public.can_write_household(household_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_write_household(household_id))', t || '_delete', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.guard_household_id_immutable()', t || '_guard_household_id', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- save_recipe(): create or update a recipe with all ingredients and substitutions atomically.
-- SECURITY INVOKER: every statement runs under the caller's RLS, so viewers and non-members are rejected
-- by the same policies that guard direct writes.
-- ---------------------------------------------------------------------------
create or replace function public.save_recipe(p_household_id uuid, p_recipe jsonb, p_ingredients jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rid uuid := nullif(p_recipe ->> 'id', '')::uuid;
  ing jsonb;
  sub jsonb;
  ing_id uuid;
  ing_pos integer := 0;
  sub_pos integer;
begin
  if p_household_id is null or not public.can_write_household(p_household_id) then
    raise exception 'not allowed to edit recipes of this household' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(coalesce(p_ingredients, '[]'::jsonb)) <> 'array' then
    raise exception 'ingredients must be an array' using errcode = 'invalid_parameter_value';
  end if;

  if rid is not null and exists (select 1 from public.recipes where id = rid and household_id = p_household_id) then
    update public.recipes set
      title = p_recipe ->> 'title',
      description = nullif(btrim(p_recipe ->> 'description'), ''),
      servings = (p_recipe ->> 'servings')::numeric,
      prep_minutes = nullif(p_recipe ->> 'prep_minutes', '')::integer,
      cook_minutes = nullif(p_recipe ->> 'cook_minutes', '')::integer,
      instructions = nullif(btrim(p_recipe ->> 'instructions'), ''),
      category = nullif(p_recipe ->> 'category', ''),
      tags = coalesce(array(select jsonb_array_elements_text(coalesce(p_recipe -> 'tags', '[]'::jsonb))), '{}'),
      image_path = nullif(p_recipe ->> 'image_path', ''),
      source_url = nullif(btrim(p_recipe ->> 'source_url'), '')
    where id = rid and household_id = p_household_id;
    if not found then
      raise exception 'not allowed to edit this recipe' using errcode = 'insufficient_privilege';
    end if;
    delete from public.recipe_ingredients where recipe_id = rid and household_id = p_household_id;
  else
    insert into public.recipes (
      id, household_id, title, description, servings, prep_minutes, cook_minutes, instructions,
      category, tags, image_path, source_url, created_by
    ) values (
      coalesce(rid, gen_random_uuid()), p_household_id,
      p_recipe ->> 'title',
      nullif(btrim(p_recipe ->> 'description'), ''),
      (p_recipe ->> 'servings')::numeric,
      nullif(p_recipe ->> 'prep_minutes', '')::integer,
      nullif(p_recipe ->> 'cook_minutes', '')::integer,
      nullif(btrim(p_recipe ->> 'instructions'), ''),
      nullif(p_recipe ->> 'category', ''),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_recipe -> 'tags', '[]'::jsonb))), '{}'),
      nullif(p_recipe ->> 'image_path', ''),
      nullif(btrim(p_recipe ->> 'source_url'), ''),
      auth.uid()
    ) returning id into rid;
  end if;

  for ing in select * from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
  loop
    insert into public.recipe_ingredients (
      household_id, recipe_id, product_id, name, quantity, unit, is_optional, is_at_home, note, sort_order
    ) values (
      p_household_id, rid,
      nullif(ing ->> 'product_id', '')::uuid,
      ing ->> 'name',
      nullif(ing ->> 'quantity', '')::numeric,
      nullif(ing ->> 'unit', ''),
      coalesce((ing ->> 'is_optional')::boolean, false),
      coalesce((ing ->> 'is_at_home')::boolean, false),
      nullif(btrim(ing ->> 'note'), ''),
      ing_pos
    ) returning id into ing_id;
    ing_pos := ing_pos + 1;

    sub_pos := 0;
    for sub in select * from jsonb_array_elements(coalesce(ing -> 'substitutions', '[]'::jsonb))
    loop
      insert into public.recipe_ingredient_substitutions (
        household_id, ingredient_id, product_id, name, quantity, unit, note, sort_order
      ) values (
        p_household_id, ing_id,
        nullif(sub ->> 'product_id', '')::uuid,
        sub ->> 'name',
        nullif(sub ->> 'quantity', '')::numeric,
        nullif(sub ->> 'unit', ''),
        nullif(btrim(sub ->> 'note'), ''),
        sub_pos
      );
      sub_pos := sub_pos + 1;
    end loop;
  end loop;

  return rid;
end;
$$;
revoke all on function public.save_recipe(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_recipe(uuid, jsonb, jsonb) to authenticated;
