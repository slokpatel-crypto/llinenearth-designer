-- Disposable PostgreSQL fixture: synthetic orders and QC only.
-- Run against a throwaway PostgreSQL 16 database. Never run against live Supabase.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema private;
create table private.production_orders (
  order_id uuid primary key,
  revision_id text not null default 'synthetic-revision',
  recipe_hash text not null default repeat('a',64),
  status text not null default 'ready',
  updated_at timestamptz not null default now(),
  note text not null default ''
);
create table private.production_order_events (
  order_id uuid not null,status text not null,payload jsonb not null
);
create table private.finished_garment_qc_inspections (
  inspection_id uuid primary key default gen_random_uuid(),
  order_id uuid not null references private.production_orders(order_id),
  revision_id text not null default 'synthetic-revision',
  recipe_hash text not null default repeat('a',64),
  decision text not null,
  checks jsonb not null default '{}'::jsonb,
  defects jsonb not null default '[]'::jsonb,
  note text not null default '',
  inspector text not null default 'Synthetic Inspector',
  inspection_reference text not null default 'SYNTH-QC-001',
  created_at timestamptz not null
);
\ir ../../supabase/migrations/20261101_finished_garment_qc_order_scoped.sql

insert into private.production_orders(order_id) values
('00000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000002'),
('00000000-0000-0000-0000-000000000003'),
('00000000-0000-0000-0000-000000000004'),
('00000000-0000-0000-0000-000000000005'),
('00000000-0000-0000-0000-000000000006');

-- 501 newer inspections for another order previously evicted order 1
-- from the global capped 500-row list.
insert into private.finished_garment_qc_inspections(order_id,decision,created_at)
select '00000000-0000-0000-0000-000000000002'::uuid,'rework',
  '2026-11-01T12:00:00Z'::timestamptz+make_interval(secs=>n)
from generate_series(1,501) n;
insert into private.finished_garment_qc_inspections(order_id,decision,created_at) values
('00000000-0000-0000-0000-000000000001','approved','2026-10-01T10:00:00Z'),
('00000000-0000-0000-0000-000000000003','approved','2026-10-01T10:00:00Z'),
('00000000-0000-0000-0000-000000000003','rework','2026-10-01T11:00:00Z'),
('00000000-0000-0000-0000-000000000004','approved','2026-10-01T10:00:00Z'),
('00000000-0000-0000-0000-000000000004','rework','2026-10-01T10:00:00Z'),
('00000000-0000-0000-0000-000000000005','rework','2026-10-01T10:00:00Z'),
('00000000-0000-0000-0000-000000000005','approved','2026-10-01T11:00:00Z');

do $$
declare
  scoped_count integer;
  latest_decision text;
  order_one uuid='00000000-0000-0000-0000-000000000001';
  order_two uuid='00000000-0000-0000-0000-000000000002';
  order_three uuid='00000000-0000-0000-0000-000000000003';
  order_four uuid='00000000-0000-0000-0000-000000000004';
  order_five uuid='00000000-0000-0000-0000-000000000005';
  order_six uuid='00000000-0000-0000-0000-000000000006';
begin
  select count(*) into scoped_count from public.finished_garment_qc_latest_for_order(order_one);
  if scoped_count<>1 then raise exception 'global 500 cap incorrectly hid order 1'; end if;
  select count(*) into scoped_count from public.finished_garment_qc_latest_for_order(order_two);
  if scoped_count<>2 then raise exception 'order-specific two-row cap failed'; end if;
  if exists(select 1 from public.finished_garment_qc_latest_for_order(order_one) where order_id<>order_one) then
    raise exception 'cross-order QC leakage';
  end if;
  select decision into latest_decision from public.finished_garment_qc_latest_for_order(order_five) limit 1;
  if latest_decision<>'approved' then raise exception 'newest approval not selected'; end if;
  if not public.production_order_set_status(order_one,'delivered','') then
    raise exception 'valid older order approval rejected by global cap';
  end if;
  if not public.production_order_set_status(order_five,'delivered','') then
    raise exception 'newest distinct approval rejected';
  end if;
  begin
    perform public.production_order_set_status(order_three,'delivered','');
    raise exception 'stale approval unexpectedly authorized delivery';
  exception when others then
    if position('finished-garment QC approval is required' in SQLERRM)=0 then raise; end if;
  end;
  begin
    perform public.production_order_set_status(order_four,'delivered','');
    raise exception 'tied approval unexpectedly authorized delivery';
  exception when others then
    if position('ambiguous latest finished-garment QC timestamp' in SQLERRM)=0 then raise; end if;
  end;
  begin
    perform public.production_order_set_status(order_six,'delivered','');
    raise exception 'missing approval unexpectedly authorized delivery';
  exception when others then
    if position('finished-garment QC approval is required' in SQLERRM)=0 then raise; end if;
  end;
  if (select status from private.production_orders where order_id=order_three)<>'ready'
    or (select status from private.production_orders where order_id=order_four)<>'ready'
    or (select status from private.production_orders where order_id=order_six)<>'ready'
  then raise exception 'denied delivery mutated an order'; end if;
  if has_function_privilege('anon','public.finished_garment_qc_latest_for_order(uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.finished_garment_qc_latest_for_order(uuid)','EXECUTE')
    or has_function_privilege('anon','public.production_order_set_status(uuid,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.production_order_set_status(uuid,text,text)','EXECUTE')
  then raise exception 'browser role can execute QC/delivery RPC'; end if;
  if not has_function_privilege('service_role','public.finished_garment_qc_latest_for_order(uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.production_order_set_status(uuid,text,text)','EXECUTE')
  then raise exception 'service role cannot execute QC/delivery RPC'; end if;
end $$;

set role service_role;
select count(*) as service_role_order_scoped_qc_rows
from public.finished_garment_qc_latest_for_order('00000000-0000-0000-0000-000000000001');
reset role;
select 'TITAN disposable PostgreSQL QC gate PASS (synthetic records only)' as result;
