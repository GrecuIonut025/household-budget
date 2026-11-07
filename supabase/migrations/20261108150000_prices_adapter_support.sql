-- Price adapters support: Monitorul Prețurilor network ids, loyalty-flagged quotes,
-- and alert evaluation when a product price lands at or past a watch target.

alter table public.retailers
  add column if not exists monitor_network_id text;

update public.retailers set monitor_network_id = '4055329000008' where slug = 'lidl' and monitor_network_id is null;
update public.retailers set monitor_network_id = 'KAUFLAND' where slug = 'kaufland' and monitor_network_id is null;
update public.retailers set monitor_network_id = '5940475006709' where slug = 'carrefour' and monitor_network_id is null;
update public.retailers set monitor_network_id = 'AUCHAN' where slug = 'auchan' and monitor_network_id is null;
update public.retailers set monitor_network_id = 'PENNY' where slug = 'penny' and monitor_network_id is null;
update public.retailers set monitor_network_id = 'PROFI' where slug = 'profi' and monitor_network_id is null;
update public.retailers set monitor_network_id = '5940475870003' where slug = 'mega-image' and monitor_network_id is null;

alter table public.product_prices
  add column if not exists loyalty_required boolean not null default false;

comment on column public.retailers.monitor_network_id is
  'Network id used by Monitorul Prețurilor pmonsvc (csvnetworkids).';
comment on column public.product_prices.loyalty_required is
  'True when the quoted price requires a loyalty card (manual entry only; adapters do not supply these).';

-- Mark matching active price alerts as triggered. Called after a verified / accepted quote is written.
create or replace function public.evaluate_price_alerts(
  p_household_id uuid,
  p_product_id uuid,
  p_retailer_id uuid,
  p_price numeric
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated integer := 0;
begin
  if p_price is null or p_price <= 0 then
    return 0;
  end if;
  if not public.is_household_member(p_household_id) then
    raise exception 'not a household member' using errcode = 'insufficient_privilege';
  end if;

  update public.price_alerts a
  set last_triggered_at = now(),
      last_triggered_price = p_price
  where a.household_id = p_household_id
    and a.product_id = p_product_id
    and a.is_active
    and (a.retailer_id is null or a.retailer_id = p_retailer_id)
    and (
      (a.direction = 'below' and p_price <= a.target_price)
      or (a.direction = 'above' and p_price >= a.target_price)
    )
    and (
      a.last_triggered_at is null
      or a.last_triggered_price is distinct from p_price
      or a.last_triggered_at < now() - interval '1 day'
    );

  get diagnostics updated = row_count;
  return updated;
end;
$$;

revoke all on function public.evaluate_price_alerts(uuid, uuid, uuid, numeric) from public, anon;
grant execute on function public.evaluate_price_alerts(uuid, uuid, uuid, numeric) to authenticated;
