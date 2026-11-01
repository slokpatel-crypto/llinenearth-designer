-- Run ONLY against a disposable/staging PostgreSQL database AFTER required
-- stock migrations. Never run against live Supabase. The explicit session
-- opt-in is required and all synthetic rows are rolled back.
-- Example: psql -v ON_ERROR_STOP=1 -c "set titan.synthetic_sql_test='enabled'" ...
-- In psql -c a separate session will not work; use a single -f wrapper.
begin;
do $$
declare
  v_fabric text:='SYNTHETIC-TITAN-'+gen_random_uuid()::text;
  v_key text:='SYNTH-KEY-'+gen_random_uuid()::text;
  v_second_key text:='SYNTH-KEY-'+gen_random_uuid()::text;
  v_revision text:='LE-LOCK-SYNTHETIC-20261102-001';
  v_first uuid;
  v_replayed uuid;
  v_new uuid;
  v_count integer;
  v_reserved numeric;
begin
  if current_setting('titan.synthetic_sql_test',true) is distinct from 'enabled' then
    raise exception 'synthetic stock SQL tests require explicit disposable-DB opt-in';
  end if;
  insert into private.fabric_stock_ledger(
    fabric_id,event_type,quantity_metres,note,recorded_by,source_reference
  ) values (
    v_fabric,'receipt',10.000,'synthetic receipt only','Synthetic checker','Synthetic cloth roll'
  );
  v_first:=public.fabric_stock_reserve_v2(
    v_fabric,2.125,v_revision,v_key,'Synthetic checker','Synthetic cut sheet A');
  v_replayed:=public.fabric_stock_reserve_v2(
    v_fabric,2.125,v_revision,v_key,'Synthetic checker','Synthetic cut sheet A');
  if v_first is null or v_replayed is distinct from v_first then
    raise exception 'same-evidence retry must return same nonnull UUID';
  end if;
  select count(*) into v_count from private.fabric_stock_ledger
    where request_key=v_key and event_type='reserve';
  if v_count<>1 then raise exception 'idempotency replay inserted duplicate stock reservation'; end if;

  begin
    perform public.fabric_stock_reserve_v2(
      'SYNTHETIC-DIFFERENT-FABRIC',2.125,v_revision,v_key,'Synthetic checker','Synthetic cut sheet A');
    raise exception 'different fabric unexpectedly reused reservation key';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.fabric_stock_reserve_v2(
      v_fabric,2.126,v_revision,v_key,'Synthetic checker','Synthetic cut sheet A');
    raise exception 'different quantity unexpectedly reused reservation key';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.fabric_stock_reserve_v2(
      v_fabric,2.125,'LE-LOCK-SYNTHETIC-DIFFERENT',v_key,'Synthetic checker','Synthetic cut sheet A');
    raise exception 'different locked revision unexpectedly reused reservation key';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.fabric_stock_reserve_v2(
      v_fabric,2.125,v_revision,v_key,'Different checker','Synthetic cut sheet A');
    raise exception 'different checker unexpectedly reused reservation key';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.fabric_stock_reserve_v2(
      v_fabric,2.125,v_revision,v_key,'Synthetic checker','Different source document');
    raise exception 'different evidence unexpectedly reused reservation key';
  exception when sqlstate '22023' then null; end;
  select count(*) into v_count from private.fabric_stock_ledger
    where request_key=v_key;
  if v_count<>1 then raise exception 'mismatched key replay modified stock ledger'; end if;

  v_new:=public.fabric_stock_reserve_v2(
    v_fabric,1.000,v_revision,v_second_key,'Synthetic checker','Synthetic cut sheet B');
  if v_new is null or v_new=v_first then
    raise exception 'distinct intent must have a new reservation UUID';
  end if;
  select reserved_metres into v_reserved from
    public.fabric_stock_snapshot_v2(array[v_fabric]);
  if v_reserved is distinct from 3.125 then
    raise exception 'incorrect reserved stock after valid intents: %',v_reserved;
  end if;
end;
$$;
rollback;
