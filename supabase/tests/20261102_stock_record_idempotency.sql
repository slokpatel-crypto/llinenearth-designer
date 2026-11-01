-- Synthetic-only disposable PostgreSQL 16 acceptance for M36.
-- Must run with titan.synthetic_sql_test=enabled; all ledger changes rollback.
begin;
do $$
declare
  v_fabric text:='SYNTHETIC-TITAN-'||gen_random_uuid()::text;
  v_key text:='SYNTH-MANUAL-'||gen_random_uuid()::text;
  v_second_key text:='SYNTH-MANUAL-'||gen_random_uuid()::text;
  v_id uuid;
  v_retry uuid;
  v_second uuid;
  v_count integer;
  v_physical numeric;
begin
  if current_setting('titan.synthetic_sql_test',true) is distinct from 'enabled' then
    raise exception 'disposable SQL test opt-in required';
  end if;
  if has_function_privilege('anon',
    'public.fabric_stock_record_v3(text,text,numeric,text,text,text,text)','EXECUTE')
    or has_function_privilege('authenticated',
    'public.fabric_stock_record_v3(text,text,numeric,text,text,text,text)','EXECUTE')
    or not has_function_privilege('service_role',
    'public.fabric_stock_record_v3(text,text,numeric,text,text,text,text)','EXECUTE') then
    raise exception 'physical stock RPC role grants incorrect';
  end if;
  v_id:=public.fabric_stock_record_v3(
    v_fabric,'receipt',10.125,'synthetic only','Synthetic checker','Synthetic roll A',v_key);
  v_retry:=public.fabric_stock_record_v3(
    v_fabric,'receipt',10.125,'synthetic only','Synthetic checker','Synthetic roll A',v_key);
  if v_id is null or v_retry is distinct from v_id then
    raise exception 'identical physical stock replay did not return original event UUID';
  end if;
  select count(*) into v_count from private.fabric_stock_ledger where request_key=v_key;
  if v_count<>1 then raise exception 'duplicate physical stock event inserted'; end if;
  begin
    perform public.fabric_stock_record_v3(
      'SYNTHETIC-DIFFERENT', 'receipt',10.125,'synthetic only','Synthetic checker','Synthetic roll A',v_key);
    raise exception 'changed fabric reused key';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.fabric_stock_record_v3(
      v_fabric,'receipt',10.126,'synthetic only','Synthetic checker','Synthetic roll A',v_key);
    raise exception 'changed quantity reused key';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.fabric_stock_record_v3(
      v_fabric,'adjustment_in',10.125,'synthetic only','Synthetic checker','Synthetic roll A',v_key);
    raise exception 'changed action reused key';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.fabric_stock_record_v3(
      v_fabric,'receipt',10.125,'different note','Synthetic checker','Synthetic roll A',v_key);
    raise exception 'changed note reused key';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.fabric_stock_record_v3(
      v_fabric,'receipt',10.125,'synthetic only','Different checker','Synthetic roll A',v_key);
    raise exception 'changed checker reused key';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.fabric_stock_record_v3(
      v_fabric,'receipt',10.125,'synthetic only','Synthetic checker','Different source',v_key);
    raise exception 'changed physical source reused key';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.fabric_stock_record_v3(
      v_fabric,'receipt',10.1255,'synthetic only','Synthetic checker','Synthetic roll A',v_second_key);
    raise exception 'excess precision accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.fabric_stock_reserve_v2(
      v_fabric,1.000,'LE-LOCK-SYNTHETIC-20261102',v_key,'Synthetic checker','Synthetic cut sheet');
    raise exception 'manual key incorrectly reused as reservation';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.fabric_stock_record_v3(
      v_fabric,'adjustment_out',11.000,'synthetic only','Synthetic checker','Synthetic roll A',v_second_key);
    raise exception 'overdraw was accepted';
  exception when sqlstate '22023' then null; end;
  v_second:=public.fabric_stock_record_v3(
    v_fabric,'adjustment_out',1.125,'synthetic only','Synthetic checker','Synthetic count sheet',v_second_key);
  if v_second is null or v_second=v_id then raise exception 'distinct event was not inserted'; end if;
  select physical_metres into v_physical from public.fabric_stock_snapshot_v2(array[v_fabric]);
  if v_physical is distinct from 9.000 then
    raise exception 'physical ledger quantity wrong after two intents: %',v_physical;
  end if;
  select count(*) into v_count from private.fabric_stock_ledger where fabric_id=v_fabric;
  if v_count<>2 then raise exception 'physical event replay changed ledger count'; end if;
end;
$$;
rollback;
