-- Price adapters support: monitor network ids, loyalty flag, alert evaluation RPC.
begin;
select plan(12);
select tests.seed_fixture();

select tests.as_superuser();

select ok(
  (select monitor_network_id is not null from public.retailers where slug = 'lidl'),
  'lidl has a Monitor network id'
);
select is(
  (select count(*)::int from public.retailers where monitor_network_id is not null),
  7,
  'all seven retailers have Monitor network ids'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_prices' and column_name = 'loyalty_required'
  ),
  'product_prices.loyalty_required exists'
);

-- alice can write a loyalty-flagged manual price and trigger an alert
select tests.as_user('alice');
insert into public.product_prices (
  household_id, product_id, retailer_id, price, source, match_method, match_confidence, loyalty_required, is_verified
) values (
  tests.id('hhA'), tests.id('A-product'),
  (select id from public.retailers where slug = 'kaufland'),
  4.50, 'manual', 'manual', 1, true, true
);

select is(
  public.evaluate_price_alerts(
    tests.id('hhA'), tests.id('A-product'),
    (select id from public.retailers where slug = 'kaufland'),
    4.50
  ),
  1,
  'below-target alert fires once for alice'
);

select ok(
  (select last_triggered_price = 4.50 from public.price_alerts
   where household_id = tests.id('hhA') and product_id = tests.id('A-product')),
  'alert last_triggered_price recorded'
);

-- zero / missing adapter confidence still rejected
select throws_ok(
  $$ insert into public.product_prices (household_id, product_id, retailer_id, price, source)
     values (tests.id('hhA'), tests.id('A-product'), (select id from public.retailers where slug = 'penny'), 3, 'adapter') $$,
  '23514', null, 'adapter prices still require match_confidence'
);

-- bob (member) can evaluate; carol (viewer) cannot write prices
select tests.as_user('bob');
select is(
  public.evaluate_price_alerts(
    tests.id('hhA'), tests.id('A-product'),
    (select id from public.retailers where slug = 'kaufland'),
    3.99
  ) >= 0,
  true,
  'member can call evaluate_price_alerts'
);

select tests.as_user('carol');
select throws_ok(
  $$ insert into public.product_prices (household_id, product_id, retailer_id, price, source, match_method, match_confidence)
     values (tests.id('hhA'), tests.id('A-product'), (select id from public.retailers where slug = 'profi'), 2, 'manual', 'manual', 1) $$,
  '42501', null, 'viewer cannot insert product prices'
);

-- isolation: alice cannot evaluate alerts in household B
select tests.as_user('alice');
select throws_ok(
  $$ select public.evaluate_price_alerts(
       tests.id('hhB'), tests.id('B-product'),
       (select id from public.retailers where slug = 'lidl'), 1) $$,
  '42501', null, 'cannot evaluate alerts for another household'
);

select tests.as_superuser();
select ok(
  (select loyalty_required from public.product_prices
   where household_id = tests.id('hhA') and retailer_id = (select id from public.retailers where slug = 'kaufland')),
  'loyalty_required persisted on manual quote'
);

select ok(
  (select count(*)::int from public.product_price_history
   where household_id = tests.id('hhA') and product_id = tests.id('A-product')) >= 2,
  'price history trigger still records observations'
);

select has_function('public', 'evaluate_price_alerts', array['uuid','uuid','uuid','numeric'],
  'evaluate_price_alerts(uuid,uuid,uuid,numeric) exists');

select * from finish();
rollback;
