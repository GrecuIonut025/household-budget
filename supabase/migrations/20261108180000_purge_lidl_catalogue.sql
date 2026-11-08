-- HGI-35: remove Lidl catalogue imports from household products.
-- Cascades to barcodes, prices, purchase history, recipe links (on delete cascade / set null).

delete from public.products
where data_source = 'lidl_xlsb'
   or preferred_retailer_id = (select id from public.retailers where slug = 'lidl' limit 1);

-- Keep the retailer row for historical FK tests, but hide it from active pickers.
update public.retailers
set is_active = false
where slug = 'lidl';
