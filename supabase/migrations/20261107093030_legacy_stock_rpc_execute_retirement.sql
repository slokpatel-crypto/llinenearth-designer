-- TITAN stock security: retire all historical provenance-free v1 mutation RPC grants.
-- Additive permission-only migration: no ledger rows, function bodies or inventories are changed.
-- The preserved v1 definitions remain available for historical schema introspection.
-- Safety: v2 grant contracts stay unchanged; no permission is granted here.
begin;
revoke execute on function public.fabric_stock_record(text,text,numeric,text)
  from public, anon, authenticated, service_role;
revoke execute on function public.fabric_stock_reserve(text,numeric,text,text)
  from public, anon, authenticated, service_role;
revoke execute on function public.fabric_stock_release(uuid,text)
  from public, anon, authenticated, service_role;
revoke execute on function public.fabric_stock_consume_reservation(uuid,numeric,text)
  from public, anon, authenticated, service_role;
commit;
