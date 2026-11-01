-- Run ONLY against a disposable PostgreSQL database.
-- Replay historical QC migrations (not a hand-built QC table) before testing
-- the order-scoped migration and original record/status functions.
do $$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;

create schema private;
-- Minimal existing-order dependencies; the QC table, functions, indexes,
-- grants, constraints and RLS below all come from the REAL tracked migrations.
create table private.production_orders (
  order_id uuid primary key,
  revision_id text not null default 'synthetic-locked-revision',
  recipe_hash text not null default repeat('a',64),
  status text not null default 'ready',
  updated_at timestamptz not null default now(),
  note text not null default ''
);
create table private.production_order_events (
  order_id uuid not null,
  status text not null,
  payload jsonb not null
);
\ir ../../supabase/migrations/20261002_finished_garment_qc.sql
\ir ../../supabase/migrations/20261027_finished_garment_qc_provenance.sql
\ir ../../supabase/migrations/20261101_finished_garment_qc_order_scoped.sql

insert into private.production_orders(order_id) values
('10000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000003'),
('10000000-0000-0000-0000-000000000004'),
('10000000-0000-0000-0000-000000000005'),
('10000000-0000-0000-0000-000000000006'),
('10000000-0000-0000-0000-000000000007');

do $$
declare
  a uuid='10000000-0000-0000-0000-000000000001';
  b uuid='10000000-0000-0000-0000-000000000002';
  c uuid='10000000-0000-0000-0000-000000000003';
  d uuid='10000000-0000-0000-0000-000000000004';
  e uuid='10000000-0000-0000-0000-000000000005';
  f uuid='10000000-0000-0000-0000-000000000006';
  g uuid='10000000-0000-0000-0000-000000000007';
  checks_pass jsonb='{"recipe_match":true,"fabric_match":true,"measurement_check":true,"pattern_alignment":true,"stitching_finish":true,"clean_damage_free":true}'::jsonb;
  inspection uuid;
  scoped integer;
begin
  -- Historical provenance function must enforce actual QC checks and human
  -- reference before the new delivery gate can possibly accept a record.
  begin
    perform public.finished_garment_qc_record_v2(c,'approved','{}'::jsonb,'[]'::jsonb,'',
      'Synthetic Inspector','SYNTH-CHECKS');
    raise exception 'incomplete QC checks unexpectedly accepted';
  exception when others then
    if position('all finished-garment QC checks must pass' in SQLERRM)=0 then raise; end if;
  end;
  begin
    perform public.finished_garment_qc_record_v2(c,'approved',checks_pass,'[]'::jsonb,'',
      'Synthetic Inspector','');
    raise exception 'missing physical reference unexpectedly accepted';
  exception when others then
    if position('physical inspection reference is required' in SQLERRM)=0 then raise; end if;
  end;
  if exists(select 1 from private.finished_garment_qc_inspections where order_id=c) then
    raise exception 'rejected provenance wrote a QC record';
  end if;

  -- Approved historical RPC -> order-scoped read -> delivery transaction.
  inspection:=public.finished_garment_qc_record_v2(a,'approved',checks_pass,'[]'::jsonb,'',
    'Synthetic Inspector','SYNTH-APPROVED-A');
  if inspection is null then raise exception 'historical QC record did not return ID'; end if;
  select count(*) into scoped from public.finished_garment_qc_latest_for_order(a);
  if scoped<>1 then raise exception 'historical approval not in order-scoped read'; end if;
  if not public.production_order_set_status(a,'delivered','') then
    raise exception 'valid historical approval did not deliver';
  end if;

  -- A newer rework revokes an older approval. Simulate a completed restitch
  -- by resetting ONLY this disposable fixture's order to ready.
  inspection:=public.finished_garment_qc_record_v2(b,'approved',checks_pass,'[]'::jsonb,'',
    'Synthetic Inspector','SYNTH-APPROVED-B');
  update private.finished_garment_qc_inspections
    set created_at='2026-10-01T10:00:00Z' where inspection_id=inspection;
  inspection:=public.finished_garment_qc_record_v2(b,'rework','{}'::jsonb,'[]'::jsonb,
    'Synthetic seam defect','Synthetic Inspector','SYNTH-REWORK-B');
  update private.finished_garment_qc_inspections
    set created_at='2026-10-02T10:00:00Z' where inspection_id=inspection;
  update private.production_orders set status='ready' where order_id=b;
  begin
    perform public.production_order_set_status(b,'delivered','');
    raise exception 'stale approval unexpectedly delivered';
  exception when others then
    if position('finished-garment QC approval is required' in SQLERRM)=0 then raise; end if;
  end;

  -- Conflicting inspections at the same latest timestamp always block delivery.
  inspection:=public.finished_garment_qc_record_v2(d,'approved',checks_pass,'[]'::jsonb,'',
    'Synthetic Inspector','SYNTH-APPROVED-D');
  update private.finished_garment_qc_inspections
    set created_at='2026-10-03T10:00:00Z' where inspection_id=inspection;
  inspection:=public.finished_garment_qc_record_v2(d,'rework','{}'::jsonb,'[]'::jsonb,
    'Synthetic seam defect','Synthetic Inspector','SYNTH-REWORK-D');
  update private.finished_garment_qc_inspections
    set created_at='2026-10-03T10:00:00Z' where inspection_id=inspection;
  update private.production_orders set status='ready' where order_id=d;
  begin
    perform public.production_order_set_status(d,'delivered','');
    raise exception 'same-time conflict unexpectedly delivered';
  exception when others then
    if position('ambiguous latest finished-garment QC timestamp' in SQLERRM)=0 then raise; end if;
  end;

  -- Missing QC and approval only from a legacy, unreferenced function are denied.
  begin
    perform public.production_order_set_status(e,'delivered','');
    raise exception 'missing QC unexpectedly delivered';
  exception when others then
    if position('finished-garment QC approval is required' in SQLERRM)=0 then raise; end if;
  end;
  perform public.finished_garment_qc_record(g,'approved',checks_pass,'[]'::jsonb,'',
    'Synthetic Inspector');
  begin
    perform public.production_order_set_status(g,'delivered','');
    raise exception 'legacy QC lacking reference unexpectedly delivered';
  exception when others then
    if position('provenance-backed finished-garment QC approval' in SQLERRM)=0 then raise; end if;
  end;

  -- A later, distinct complete approval restores delivery authorization.
  inspection:=public.finished_garment_qc_record_v2(f,'rework','{}'::jsonb,'[]'::jsonb,
    'Synthetic seam defect','Synthetic Inspector','SYNTH-REWORK-F');
  update private.finished_garment_qc_inspections
    set created_at='2026-10-01T10:00:00Z' where inspection_id=inspection;
  update private.production_orders set status='ready' where order_id=f;
  inspection:=public.finished_garment_qc_record_v2(f,'approved',checks_pass,'[]'::jsonb,'',
    'Synthetic Inspector','SYNTH-APPROVED-F');
  update private.finished_garment_qc_inspections
    set created_at='2026-10-02T10:00:00Z' where inspection_id=inspection;
  if not public.production_order_set_status(f,'delivered','') then
    raise exception 'latest complete approval did not deliver';
  end if;

  if (select count(*) from private.production_orders where status='delivered')<>2
    or (select count(*) from private.production_order_events where status='delivered')<>2
  then raise exception 'only two delivery transitions should have committed'; end if;
  if exists(select 1 from public.finished_garment_qc_latest_for_order(a) where order_id<>a) then
    raise exception 'scoped QC leaked another order'; end if;
  if has_function_privilege('anon','public.finished_garment_qc_latest_for_order(uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.finished_garment_qc_latest_for_order(uuid)','EXECUTE')
    or has_function_privilege('anon','public.production_order_set_status(uuid,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.production_order_set_status(uuid,text,text)','EXECUTE')
  then raise exception 'browser roles could execute protected QC/delivery functions'; end if;
  if not has_function_privilege('service_role','public.finished_garment_qc_latest_for_order(uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.finished_garment_qc_record_v2(uuid,text,jsonb,jsonb,text,text,text)','EXECUTE')
    or not has_function_privilege('service_role','public.production_order_set_status(uuid,text,text)','EXECUTE')
  then raise exception 'service-role authorization missing after migration replay'; end if;
end $$;

-- Actual service role executes security-definer scoped read; private tables
-- remain inaccessible to untrusted browser roles.
set role service_role;
select count(*) as migrated_scoped_qc_count
from public.finished_garment_qc_latest_for_order('10000000-0000-0000-0000-000000000001');
reset role;
select 'TITAN historical QC migration compatibility PASS (disposable synthetic only)' as result;
