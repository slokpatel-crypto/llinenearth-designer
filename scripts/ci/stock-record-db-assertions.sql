-- These assertions RUN the real migration against disposable PostgreSQL.
-- A thrown exception fails the GitHub Actions job; no mocks for the v3 RPC.
do $stock$
declare
  first_id uuid;
  retry_id uuid;
  ledger_rows integer;
begin
  first_id:=public.fabric_stock_record_v3(
    'fabric-a','receipt',10.125,'','Checker One','ROLL-001','manual-key-00001');
  retry_id:=public.fabric_stock_record_v3(
    'fabric-a','receipt',10.125,'','Checker One','ROLL-001','manual-key-00001');
  if retry_id is distinct from first_id then
    raise exception 'same-key same-evidence retry returned a different physical event';
  end if;
  select count(*) into ledger_rows from private.fabric_stock_ledger
    where request_key='manual-key-00001';
  if ledger_rows<>1 then
    raise exception 'same-key repeat inserted % physical receipts',ledger_rows;
  end if;

  -- A conflicting physical quantity, checker, source, note or garment fabric
  -- cannot use a previously accepted event's identity.
  begin
    perform public.fabric_stock_record_v3(
      'fabric-a','receipt',10.126,'','Checker One','ROLL-001','manual-key-00001');
    raise exception 'conflicting quantity unexpectedly accepted';
  exception when others then
    if SQLERRM <> 'stock request key already belongs to different evidence' then raise; end if;
  end;
  begin
    perform public.fabric_stock_record_v3(
      'fabric-b','receipt',10.125,'','Checker One','ROLL-001','manual-key-00001');
    raise exception 'conflicting SKU unexpectedly accepted';
  exception when others then
    if SQLERRM <> 'stock request key already belongs to different evidence' then raise; end if;
  end;
  begin
    perform public.fabric_stock_record_v3(
      'fabric-a','receipt',10.125,'','Checker Two','ROLL-001','manual-key-00001');
    raise exception 'conflicting checker unexpectedly accepted';
  exception when others then
    if SQLERRM <> 'stock request key already belongs to different evidence' then raise; end if;
  end;
  begin
    perform public.fabric_stock_record_v3(
      'fabric-a','receipt',10.125,'','Checker One','ROLL-002','manual-key-00001');
    raise exception 'conflicting source unexpectedly accepted';
  exception when others then
    if SQLERRM <> 'stock request key already belongs to different evidence' then raise; end if;
  end;
  begin
    perform public.fabric_stock_record_v3(
      'fabric-a','receipt',10.125,'changed note','Checker One','ROLL-001','manual-key-00001');
    raise exception 'conflicting note unexpectedly accepted';
  exception when others then
    if SQLERRM <> 'stock request key already belongs to different evidence' then raise; end if;
  end;

  -- Reservation keys and manual event keys share the same unique index.
  insert into private.fabric_stock_ledger(
    fabric_id,event_type,quantity_metres,reservation_id,request_key,note
  ) values (
    'fabric-a','reserve',8,gen_random_uuid(),'reserve-key-0001','locked design reservation'
  );
  begin
    perform public.fabric_stock_record_v3(
      'fabric-a','receipt',10.125,'','Checker One','ROLL-001','reserve-key-0001');
    raise exception 'reserve key was wrongly adopted by a physical receipt';
  exception when others then
    if SQLERRM <> 'stock request key already belongs to different evidence' then raise; end if;
  end;

  -- Only the genuinely available 2.125 m may be removed, not the 8 m
  -- reserved by an existing tailor order.
  begin
    perform public.fabric_stock_record_v3(
      'fabric-a','adjustment_out',3.000,'','Checker One','CORRECTION-1','manual-key-00002');
    raise exception 'reserved fabric was incorrectly removed';
  exception when others then
    if SQLERRM <> 'adjustment exceeds available unreserved fabric' then raise; end if;
  end;
  first_id:=public.fabric_stock_record_v3(
    'fabric-a','adjustment_out',2.000,'','Checker One','CORRECTION-1','manual-key-00002');
  retry_id:=public.fabric_stock_record_v3(
    'fabric-a','adjustment_out',2.000,'','Checker One','CORRECTION-1','manual-key-00002');
  if first_id is distinct from retry_id then raise exception 'adjustment retry created a new event'; end if;
  if (select available_metres from public.fabric_stock_snapshot_v2(array['fabric-a']))<>0.125
  then raise exception 'available metres disagree after reserve and adjustment'; end if;

  -- Never round an unmeasured extra 0.0004 m into inventory.
  begin
    perform public.fabric_stock_record_v3(
      'fabric-a','receipt',1.0004,'','Checker One','ROLL-003','manual-key-00003');
    raise exception 'imprecise physical quantity was accepted';
  exception when others then
    if SQLERRM <> 'invalid physical stock quantity precision' then raise; end if;
  end;
  begin
    perform public.fabric_stock_record_v3(
      'fabric-a','receipt',1.000,'','Checker One','ROLL-003',' manual-key-00003');
    raise exception 'padded request identity was accepted';
  exception when others then
    if SQLERRM <> 'invalid stock request key' then raise; end if;
  end;

  if has_function_privilege('anon',
       'public.fabric_stock_record_v3(text,text,numeric,text,text,text,text)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.fabric_stock_record_v3(text,text,numeric,text,text,text,text)','EXECUTE')
     or not has_function_privilege('service_role',
       'public.fabric_stock_record_v3(text,text,numeric,text,text,text,text)','EXECUTE')
  then raise exception 'privileged stock RPC role grants are not restricted'; end if;
end;
$stock$;
