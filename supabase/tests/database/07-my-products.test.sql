-- My Products: preference columns, purchase recording through the budget path, draft lists, barcode rules, storage scope.
begin;
select plan(24);
select tests.seed_fixture();

insert into public.products (id, household_id, name) values (tests.id('yogurt'), tests.id('hhA'), 'Yogurt 400g');

-- preference columns -----------------------------------------------------------
select row_eq(
  $$ select is_favorite, is_frequent, preferred_retailer_id, data_source from public.products where id = tests.id('yogurt') $$,
  row(false, false, null::uuid, 'manual'::text), 'new products default to no preferences and manual data');
select tests.as_user('bob');
select lives_ok($$ update public.products set is_favorite = true, is_frequent = true,
  preferred_retailer_id = (select id from public.retailers where slug = 'lidl') where id = tests.id('yogurt') $$,
  'a member can set favorite, frequent and preferred supermarket');
select throws_ok($$ update public.products set data_source = 'scraped' where id = tests.id('yogurt') $$, '23514', null,
  'data_source only accepts known values');
select tests.as_user('carol');
select is_empty($$ update public.products set is_favorite = false where id = tests.id('yogurt') returning id $$,
  'a viewer cannot change preferences');

-- multiple barcodes per product, checksum + per-household uniqueness ------------
select tests.as_user('bob');
select lives_ok($$ insert into public.product_barcodes (household_id, product_id, barcode)
  values (tests.id('hhA'), tests.id('yogurt'), '5901234123457'), (tests.id('hhA'), tests.id('yogurt'), '96385074') $$,
  'a product can carry several valid barcodes');
select throws_ok($$ insert into public.product_barcodes (household_id, product_id, barcode)
  values (tests.id('hhA'), tests.id('yogurt'), '5901234123456') $$, '23514', null, 'a barcode with a wrong check digit is rejected');
select throws_ok($$ insert into public.product_barcodes (household_id, product_id, barcode)
  values (tests.id('hhA'), tests.id('A-product'), '5901234123457') $$, '23505', null, 'a barcode belongs to one product per household');
select tests.as_user('dave');
select lives_ok($$ insert into public.product_barcodes (household_id, product_id, barcode)
  values (tests.id('hhB'), tests.id('B-product'), '5901234123457') $$, 'another household may use the same barcode');

-- record_product_purchase ---------------------------------------------------------
select tests.as_user('bob');
select lives_ok($$ select public.record_product_purchase(tests.id('yogurt'), 3, 4.50, '2026-11-05',
  (select id from public.retailers where slug = 'lidl'), tests.id('bob'), false, 'shared') $$, 'a member records a purchase');
select row_eq(
  $$ select t.amount, t.type::text, t.paid_by, t.created_by, t.occurred_on, c.is_grocery, t.description
     from public.product_purchase_history ph
     join public.transactions t on t.id = ph.transaction_id
     join public.transaction_categories c on c.id = t.category_id
     where ph.product_id = tests.id('yogurt') $$,
  row(13.50::numeric, 'expense'::text, tests.id('bob'), tests.id('bob'), '2026-11-05'::date, true, 'Yogurt 400g × 3'::text),
  'the purchase creates a grocery expense attributed to the buyer');
select row_eq(
  $$ select purchase_count, total_quantity, total_spent, last_price from public.products where id = tests.id('yogurt') $$,
  row(1, 3.000::numeric, 13.50::numeric, 4.50::numeric), 'existing triggers update the product statistics');
select throws_ok($$ select public.record_product_purchase(tests.id('yogurt'), 1, 4, current_date, null, tests.id('alice')) $$,
  '42501', null, 'a member cannot attribute a purchase to someone else');
select throws_ok($$ select public.record_product_purchase(tests.id('yogurt'), 0, 4) $$, '23514', null, 'quantity must be positive');
select throws_ok($$ select public.record_product_purchase(tests.id('B-product'), 1, 4) $$, 'P0002', null,
  'a product of another household is not visible, so it cannot be purchased');
select is((select count(*)::int from public.transactions where description = 'Yogurt 400g × 3'), 1,
  'a failed purchase leaves no transaction behind');

select tests.as_user('carol');
select throws_ok($$ select public.record_product_purchase(tests.id('yogurt'), 1, 4) $$, '42501', null, 'a viewer cannot record purchases');
select tests.as_user('dana');
select lives_ok($$ select public.record_product_purchase(tests.id('yogurt'), 1, 5, current_date, null, tests.id('bob')) $$,
  'an admin can attribute a purchase to a member');

-- create_shopping_list_from_products ----------------------------------------------
select tests.as_user('bob');
select lives_ok($$ select public.create_shopping_list_from_products(tests.id('hhA'), 'Recurring',
  jsonb_build_array(jsonb_build_object('product_id', tests.id('yogurt'), 'quantity', 2), jsonb_build_object('product_id', tests.id('B-product'), 'quantity', 1))) $$,
  'a member creates a draft list from products');
select row_eq(
  $$ select l.status::text, count(i.id)::int, min(i.name), min(i.quantity), min(i.estimated_unit_price)
     from public.shopping_lists l join public.shopping_list_items i on i.list_id = l.id where l.name = 'Recurring' group by l.status $$,
  row('draft'::text, 1, 'Yogurt 400g'::text, 2.000::numeric, 5.00::numeric),
  'foreign products are skipped; names and prices come from the product');
select throws_ok($$ select public.create_shopping_list_from_products(tests.id('hhA'), 'Empty', '[]'::jsonb) $$, '23514', null,
  'an empty list is rejected');
select tests.as_user('carol');
select throws_ok($$ select public.create_shopping_list_from_products(tests.id('hhA'), 'Nope',
  jsonb_build_array(jsonb_build_object('product_id', tests.id('yogurt'), 'quantity', 1))) $$, '42501', null, 'a viewer cannot create lists');

-- anonymous users cannot reach the functions ---------------------------------------
select tests.as_anon();
select throws_ok($$ select public.record_product_purchase(tests.id('yogurt'), 1, 4) $$, '42501', null, 'anon cannot record purchases');

-- product images live in the household-scoped storage folder -----------------------
select tests.as_user('bob');
select lives_ok($$ insert into storage.objects (bucket_id, name, owner) values
  ('household-media', tests.id('hhA')::text || '/products/' || tests.id('yogurt')::text || '/photo.webp', tests.id('bob')) $$,
  'a member can upload a product image into the household folder');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner) values
  ('household-media', tests.id('hhB')::text || '/products/x/photo.webp', tests.id('bob')) $$, '42501', null,
  'a member cannot upload into another household folder');

select * from finish();
rollback;
