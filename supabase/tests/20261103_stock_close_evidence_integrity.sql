-- Disposable PostgreSQL only: all synthetic stock mutations roll back.
begin;
do $$
declare
  v_fabric text:='SYNTHETIC-TITAN-CLOSE-EVIDENCE';
  v_revision text:=repeat('R',220);
  v_checker text:=repeat('Q',120);
  v_source text:=repeat('S',240);
  v_release_id uuid;
  v_consume_id uuid;
  v_case integer;
  v_count integer;
  v_ok boolean;
begin
  if current_setting('titan.synthetic_sql_test',true) is distinct from 'enabled' then
    raise exception 'synthetic stock SQL tests require disposable-DB opt-in';
  end if;
  insert into private.fabric_stock_ledger(
    fabric_id,event_type,quantity_metres,recorded_by,source_reference
  ) values(v_fabric,'receipt',10.000,'Synthetic checker','Synthetic roll sheet');
  v_release_id:=public.fabric_stock_reserve_v2(
    v_fabric,2.000,v_revision,repeat('L',180),v_checker,v_source);
  v_consume_id:=public.fabric_stock_reserve_v2(
    v_fabric,2.000,v_revision,repeat('M',180),v_checker,v_source);

  -- Four distinct overlong evidence aliases must fail without ledger writes.
  for v_case in 1..4 loop
    begin
      if v_case<=2 then
        perform public.fabric_stock_release_v2(
          v_release_id,'release evidence boundary',
          case when v_case=1 then v_checker||'X' else v_checker end,
          case when v_case=2 then v_source||'X' else v_source end);
      else
        perform public.fabric_stock_consume_reservation_v2(
          v_consume_id,1.000,'usage evidence boundary',
          case when v_case=3 then v_checker||'X' else v_checker end,
          case when v_case=4 then v_source||'X' else v_source end);
      end if;
      raise exception 'overlong stock close evidence case % was accepted',v_case;
    exception when sqlstate '22023' then null;
    end;
  end loop;

  -- Fractional metre usage cannot be rounded into a different physical fact.
  begin
    perform public.fabric_stock_consume_reservation_v2(
      v_consume_id,1.0004,'usage precision',v_checker,v_source);
    raise exception 'unrepresentable actual metre usage was accepted';
  exception when sqlstate '22023' then null;
  end;

  select count(*) into v_count from private.fabric_stock_ledger
  where event_type in ('release','consume')
    and reservation_id in (v_release_id,v_consume_id);
  if v_count<>0 then raise exception 'rejected stock close mutated the ledger'; end if;

  v_ok:=public.fabric_stock_release_v2(v_release_id,'valid release',v_checker,v_source);
  if v_ok is distinct from true then raise exception 'maximum-length release failed'; end if;
  v_ok:=public.fabric_stock_release_v2(v_release_id,'retry',v_checker,v_source);
  if v_ok is distinct from false then raise exception 'release was not idempotent'; end if;

  v_ok:=public.fabric_stock_consume_reservation_v2(
    v_consume_id,1.000,'valid consumption',v_checker,v_source);
  if v_ok is distinct from true then raise exception 'maximum-length consumption failed'; end if;
  v_ok:=public.fabric_stock_consume_reservation_v2(
    v_consume_id,1.000,'retry',v_checker,v_source);
  if v_ok is distinct from false then raise exception 'consumption was not idempotent'; end if;

  select count(*) into v_count from private.fabric_stock_ledger
  where reservation_id in (v_release_id,v_consume_id)
    and event_type in ('release','consume')
    and recorded_by=v_checker and source_reference=v_source;
  if v_count<>3 then raise exception 'valid release/consume evidence was altered'; end if;
  select count(*) into v_count from private.fabric_stock_ledger
  where reservation_id in (v_release_id,v_consume_id)
    and event_type in ('release','consume');
  if v_count<>3 then raise exception 'stock close created duplicate or unexpected events'; end if;
end;
$$;
rollback;
