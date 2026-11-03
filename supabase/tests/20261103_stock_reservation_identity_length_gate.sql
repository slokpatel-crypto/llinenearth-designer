-- Disposable PostgreSQL only. All synthetic writes rolled back.
begin;
do $$
declare
  v_fabric text:=left('SYNTHETIC-TITAN-'||repeat('F',160),160);
  v_key text:=repeat('K',180);
  v_revision text:=repeat('R',220);
  v_requester text:=repeat('Q',120);
  v_source text:=repeat('S',240);
  v_good uuid;
  v_retry uuid;
  v_case integer;
  v_count integer;
begin
  if current_setting('titan.synthetic_sql_test',true) is distinct from 'enabled' then
    raise exception 'synthetic stock SQL tests require disposable-DB opt-in';
  end if;
  insert into private.fabric_stock_ledger(
    fabric_id,event_type,quantity_metres,recorded_by,source_reference
  ) values(v_fabric,'receipt',5.000,'Synthetic checker','Synthetic roll sheet');
  v_good:=public.fabric_stock_reserve_v2(
    v_fabric,1.000,v_revision,v_key,v_requester,v_source);
  v_retry:=public.fabric_stock_reserve_v2(
    v_fabric,1.000,v_revision,v_key,v_requester,v_source);
  if v_good is null or v_retry is distinct from v_good then
    raise exception 'maximum-length reservation or exact replay failed';
  end if;
  -- Each extra character would previously be truncated into the same key/evidence.
  for v_case in 1..5 loop
    begin
      perform public.fabric_stock_reserve_v2(
        case when v_case=1 then v_fabric||'X' else v_fabric end,
        1.000,
        case when v_case=3 then v_revision||'X' else v_revision end,
        case when v_case=2 then v_key||'X' else v_key end,
        case when v_case=4 then v_requester||'X' else v_requester end,
        case when v_case=5 then v_source||'X' else v_source end);
      raise exception 'overlong reservation evidence case % was accepted',v_case;
    exception when sqlstate '22023' then null;
    end;
  end loop;
  select count(*) into v_count from private.fabric_stock_ledger
    where fabric_id=v_fabric and event_type='reserve';
  if v_count<>1 then raise exception 'oversize retries changed stock ledger'; end if;
end;
$$;
rollback;
