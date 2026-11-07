-- Allow products seeded from the Lidl daily XLSB adapter.

alter table public.products
  drop constraint if exists products_data_source_check;

alter table public.products
  add constraint products_data_source_check
  check (data_source in ('manual', 'open_food_facts', 'lidl_xlsb'));
