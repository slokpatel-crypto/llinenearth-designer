-- Disposable CI PostgreSQL fixture, NOT a connection to live Supabase.
-- Deliberately mirror only the ledger contracts required by the new v3 RPC.
-- The actual v3 migration is loaded unmodified after this fixture.
create schema private;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create table private.fabric_stock_ledger(
  event_id uuid primary key default gen_random_uuid(),
  fabric_id text not null,
  event_type text not null check (
    event_type in ('receipt','adjustment_in','adjustment_out','reserve','release','consume')
  ),
  quantity_metres numeric(10,3) not null check (quantity_metres>0 and quantity_metres<=100000),
  reservation_id uuid,
  revision_id text,
  request_key text,
  note text not null default '',
  recorded_by text not null default '',
  source_reference text not null default '',
  created_at timestamptz not null default now()
);
-- The original production migration creates this unique partial index.
create unique index fabric_stock_ledger_request_key_uidx
  on private.fabric_stock_ledger(request_key)
  where request_key is not null;

create or replace function public.fabric_stock_snapshot_v2(p_fabric_ids text[] default null)
returns table(fabric_id text, available_metres numeric)
language sql
as $$
  select l.fabric_id,
    coalesce(sum(case
      when l.event_type in ('receipt','adjustment_in','release') then l.quantity_metres
      when l.event_type in ('adjustment_out','reserve') then -l.quantity_metres
      else 0
    end),0) as available_metres
  from private.fabric_stock_ledger l
  where p_fabric_ids is null or l.fabric_id=any(p_fabric_ids)
  group by l.fabric_id
$$;
