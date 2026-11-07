-- Recipe extensions: substitutions, product unit specs, save_recipe(), image path scoping and
-- household-scoped recipe photos in storage.
begin;
select plan(31);
select tests.seed_fixture();

-- Seed one row of each new table for both households (as superuser).
select tests.as_superuser();
insert into public.recipe_ingredients (id, household_id, recipe_id, product_id, name, quantity, unit, is_at_home)
values (tests.id('A-ing'), tests.id('hhA'), tests.id('A-recipe'), tests.id('A-product'), 'extra', 3, 'g', true),
       (tests.id('B-ing'), tests.id('hhB'), tests.id('B-recipe'), tests.id('B-product'), 'extra', 3, 'g', false);
insert into public.recipe_ingredient_substitutions (household_id, ingredient_id, product_id, name, quantity, unit)
values (tests.id('hhA'), tests.id('A-ing'), tests.id('A-product'), 'A substitute', 5, 'g'),
       (tests.id('hhB'), tests.id('B-ing'), tests.id('B-product'), 'B substitute', 5, 'g');
insert into public.products (id, household_id, name) values (tests.id('B-product2'), tests.id('hhB'), 'B spare product');
insert into public.product_unit_specs (household_id, product_id, unit_weight_g)
values (tests.id('hhA'), tests.id('A-product'), 60),
       (tests.id('hhB'), tests.id('B-product'), 60);

select ok((select relrowsecurity from pg_class where oid = 'public.recipe_ingredient_substitutions'::regclass),
  'substitutions table has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.product_unit_specs'::regclass),
  'product_unit_specs table has RLS enabled');
select is((select count(*)::int from pg_policies where schemaname = 'public'
           and tablename in ('recipe_ingredient_substitutions', 'product_unit_specs')), 8,
  'each new table has select/insert/update/delete policies');

-- isolation: alice (owner of A) -----------------------------------------------
select tests.as_user('alice');
select is((select count(*)::int from public.recipe_ingredient_substitutions), 1, 'alice sees only her household substitutions');
select is((select count(*)::int from public.product_unit_specs), 1, 'alice sees only her household unit specs');
select throws_ok(
  $$ insert into public.recipe_ingredient_substitutions (household_id, ingredient_id, name)
     values (tests.id('hhA'), tests.id('B-ing'), 'cross') $$,
  '23503', null, 'composite FK stops a substitution pointing at a B ingredient');
select throws_ok(
  $$ insert into public.recipe_ingredient_substitutions (household_id, ingredient_id, product_id, name)
     values (tests.id('hhA'), tests.id('A-ing'), tests.id('B-product'), 'cross') $$,
  '23503', null, 'composite FK stops a substitution linking a B product');
select throws_ok(
  $$ insert into public.product_unit_specs (household_id, product_id, unit_weight_g)
     values (tests.id('hhA'), tests.id('B-product2'), 10) $$,
  '23503', null, 'composite FK stops unit specs on a B product');
select throws_ok(
  $$ insert into public.recipe_ingredient_substitutions (household_id, ingredient_id, name)
     values (tests.id('hhB'), tests.id('B-ing'), 'cross') $$,
  '42501', null, 'alice cannot write substitutions into household B');
select throws_ok(
  $$ update public.product_unit_specs set household_id = tests.id('hhB') where product_id = tests.id('A-product') $$,
  '42501', null, 'unit specs cannot be moved to another household');
select throws_ok(
  $$ insert into public.product_unit_specs (household_id, product_id) values (tests.id('hhA'), tests.id('A-product')) $$,
  '23514', null, 'a unit spec must define at least one value');
select throws_ok(
  $$ insert into public.recipe_ingredients (household_id, recipe_id, name, quantity, unit)
     values (tests.id('hhA'), tests.id('A-recipe'), 'bad unit', 1, 'cups') $$,
  '23514', null, 'ingredients only accept supported units');
select throws_ok(
  $$ update public.recipes set image_path = tests.id('hhB')::text || '/recipes/x.jpg' where id = tests.id('A-recipe') $$,
  '23514', null, 'a recipe photo cannot point into another household folder');
select lives_ok(
  $$ update public.recipes set image_path = tests.id('hhA')::text || '/recipes/x.jpg', category = 'main' where id = tests.id('A-recipe') $$,
  'a recipe photo inside the own household folder is accepted');

-- save_recipe ----------------------------------------------------------------
select is(
  public.save_recipe(
    tests.id('hhA'),
    jsonb_build_object('id', tests.id('new-recipe'), 'title', 'Carbonara', 'servings', 2, 'category', 'main',
                       'tags', jsonb_build_array('quick', 'italian'), 'instructions', 'Cook.'),
    jsonb_build_array(
      jsonb_build_object('product_id', tests.id('A-product'), 'name', 'Pasta', 'quantity', 200, 'unit', 'g',
        'substitutions', jsonb_build_array(jsonb_build_object('name', 'Spaghetti', 'quantity', 200, 'unit', 'g'))),
      jsonb_build_object('name', 'Salt', 'is_at_home', true))
  ),
  tests.id('new-recipe'),
  'member-level writer can create a recipe through save_recipe()');
select is((select count(*)::int from public.recipe_ingredients where recipe_id = tests.id('new-recipe')), 2, 'both ingredients saved');
select is((select count(*)::int from public.recipe_ingredient_substitutions s
           join public.recipe_ingredients i on i.id = s.ingredient_id where i.recipe_id = tests.id('new-recipe')), 1,
  'substitution saved');
select is((select array_agg(tags[1] order by title) from public.recipes where id = tests.id('new-recipe')), array['quick'],
  'tags saved as an array');
select is((select created_by from public.recipes where id = tests.id('new-recipe')), tests.id('alice'), 'creator is recorded');

select public.save_recipe(
  tests.id('hhA'),
  jsonb_build_object('id', tests.id('new-recipe'), 'title', 'Carbonara v2', 'servings', 4),
  jsonb_build_array(jsonb_build_object('name', 'Eggs', 'quantity', 4, 'unit', 'pcs')));
select is((select title from public.recipes where id = tests.id('new-recipe')), 'Carbonara v2', 'save_recipe updates an existing recipe');
select is((select array_agg(name) from public.recipe_ingredients where recipe_id = tests.id('new-recipe')), array['Eggs'],
  'save_recipe replaces the ingredient list');
select is((select count(*)::int from public.recipe_ingredient_substitutions s
           join public.recipe_ingredients i on i.id = s.ingredient_id where i.recipe_id = tests.id('new-recipe')), 0,
  'replaced ingredients take their substitutions with them');
select throws_ok(
  $$ select public.save_recipe(tests.id('hhB'), jsonb_build_object('title', 'x', 'servings', 1), '[]'::jsonb) $$,
  '42501', null, 'save_recipe rejects another household');

-- viewer ---------------------------------------------------------------------
select tests.as_user('carol');
select is((select count(*)::int from public.recipe_ingredient_substitutions), 1, 'viewer can read substitutions');
select throws_ok(
  $$ select public.save_recipe(tests.id('hhA'), jsonb_build_object('title', 'x', 'servings', 1), '[]'::jsonb) $$,
  '42501', null, 'viewer cannot save recipes');
select throws_ok(
  $$ insert into public.product_unit_specs (household_id, product_id, density_g_per_ml)
     values (tests.id('hhA'), tests.id('A-product'), 0.9) $$,
  '42501', null, 'viewer cannot write unit specs');

-- member --------------------------------------------------------------------
select tests.as_user('bob');
select lives_ok(
  $$ update public.product_unit_specs set unit_weight_g = 55 where product_id = tests.id('A-product') $$,
  'member can edit unit specs');

-- storage: recipe photos -------------------------------------------------------
select tests.as_user('carol');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('household-media', tests.id('hhA')::text || '/recipes/r/v.webp') $$,
  '42501', null, 'viewer cannot upload recipe photos');
select tests.as_user('bob');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('household-media', tests.id('hhA')::text || '/recipes/r/m.webp') $$,
  'member can upload a recipe photo to the household folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('household-media', tests.id('hhB')::text || '/recipes/r/m.webp') $$,
  '42501', null, 'member cannot upload a recipe photo to another household');

select tests.as_anon();
select throws_ok(
  $$ select public.save_recipe(tests.id('hhA'), jsonb_build_object('title', 'x', 'servings', 1), '[]'::jsonb) $$,
  '42501', null, 'anonymous users cannot call save_recipe');

select * from finish();
rollback;
