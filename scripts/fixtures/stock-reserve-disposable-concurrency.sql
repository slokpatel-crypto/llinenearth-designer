-- Disposable-only replacement: derive availability from the reservation ledger.
-- Never apply this synthetic five-metre fixture to any shared database.
create or replace function public.fabric_stock_snapshot_v2(ids text[])
returns table(available_metres numeric, physical_metres numeric, provenance_ready boolean)
language sql stable as $$
  select greatest(0::numeric, 5::numeric - coalesce(sum(quantity_metres) filter
    (where event_type='reserve' and fabric_id='disposable-test-fabric'),0)),
    5::numeric, true
  from private.fabric_stock_ledger
  where ids = array['disposable-test-fabric']::text[]
$$;
