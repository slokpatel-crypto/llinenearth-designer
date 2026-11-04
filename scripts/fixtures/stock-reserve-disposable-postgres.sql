-- Disposable PostgreSQL fixture only. Never apply to staging or production.
begin;
create schema private;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create extension if not exists pgcrypto;
create table private.fabric_stock_ledger (
  fabric_id text not null, event_type text not null, quantity_metres numeric not null,
  reservation_id uuid, revision_id text, request_key text unique, note text,
  recorded_by text, source_reference text
);
create function public.fabric_stock_snapshot_v2(ids text[])
returns table(available_metres numeric, physical_metres numeric, provenance_ready boolean)
language sql stable as $$
  select 5::numeric, 5::numeric, true
  where ids = array['disposable-test-fabric']::text[]
$$;
commit;
