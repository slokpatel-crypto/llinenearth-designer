-- Disposable PostgreSQL only. Synthetic rows are rolled back.
begin;
do $$
declare
  v_legacy text:='SYNTHETIC-TITAN-LEGACY-'||gen_random_uuid()::text;
  v_mixed text:='SYNTHETIC-TITAN-MIXED-'||gen_random_uuid()::text;
  v_verified text:='SYNTHETIC-TITAN-VERIFIED-'||gen_random_uuid()::text;
  v_revision text:='LE-LOCK-SYNTHETIC-20261103-001';
  v_id uuid;
  v_replay uuid;
  v_count integer;
begin
  if current_setting('titan.synthetic_sql_test',true) is distinct from 'enabled' then
    raise exception 'synthetic stock SQL tests require explicit disposable-DB opt-in';
  end if;
  -- Legacy positive metres must NOT count as verified stock.
  insert into private.fabric_stock_ledger(fabric_id,event_type,quantity_metres)
    values(v_legacy,'receipt',5.000);
  begin
    perform public.fabric_stock_reserve_v2(v_legacy,1.000,v_revision,
      'SYNTH-LEGACY-'||gen_random_uuid()::text,'Synthetic checker','Synthetic cut sheet');
    raise exception 'legacy unverified stock unexpectedly reserved';
  exception when sqlstate '22023' then null; end;

  -- One unverified physical event invalidates the whole fabric, even with
  -- a separate positive, properly documented receipt.
  insert into private.fabric_stock_ledger(
    fabric_id,event_type,quantity_metres,recorded_by,source_reference)
    values(v_mixed,'receipt',5.000,'Synthetic checker','Synthetic roll sheet');
  insert into private.fabric_stock_ledger(fabric_id,event_type,quantity_metres)
    values(v_mixed,'adjustment_in',1.000);
  begin
    perform public.fabric_stock_reserve_v2(v_mixed,1.000,v_revision,
      'SYNTH-MIXED-'||gen_random_uuid()::text,'Synthetic checker','Synthetic cut sheet');
    raise exception 'mixed unverified stock unexpectedly reserved';
  exception when sqlstate '22023' then null; end;

  -- Verified synthetic evidence remains reservable; an unchanged retry
  -- returns the original UUID and does not create a second movement.
  insert into private.fabric_stock_ledger(
    fabric_id,event_type,quantity_metres,recorded_by,source_reference)
    values(v_verified,'receipt',5.000,'Synthetic checker','Synthetic roll sheet');
  v_id:=public.fabric_stock_reserve_v2(v_verified,1.125,v_revision,
    'SYNTH-VERIFIED-20261103','Synthetic checker','Synthetic cut sheet');
  v_replay:=public.fabric_stock_reserve_v2(v_verified,1.125,v_revision,
    'SYNTH-VERIFIED-20261103','Synthetic checker','Synthetic cut sheet');
  if v_id is null or v_replay is distinct from v_id then
    raise exception 'verified same-evidence idempotent retry failed';
  end if;
  select count(*) into v_count from private.fabric_stock_ledger
    where fabric_id in (v_legacy,v_mixed) and event_type='reserve';
  if v_count<>0 then raise exception 'unverified stock wrote a reservation'; end if;
  select count(*) into v_count from private.fabric_stock_ledger
    where fabric_id=v_verified and event_type='reserve';
  if v_count<>1 then raise exception 'verified retry wrote duplicate reservation'; end if;
end;
$$;
rollback;
