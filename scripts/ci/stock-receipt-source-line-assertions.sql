-- Disposable historical PostgreSQL ONLY. Requires real stock migrations,
-- including the draft physical-receipt source-line unique index.
do $receipt$
declare
  v_existing uuid;
  v_retry uuid;
  v_new uuid;
  v_rows integer;
begin
  if to_regclass('private.fabric_stock_receipt_source_line_uidx') is null
  then raise exception 'physical receipt natural-key index missing'; end if;

  select event_id into v_existing from private.fabric_stock_ledger
   where request_key='historical-record-0001';
  v_retry:=public.fabric_stock_record_v3(
    'fabric-historical','receipt',5.000,'','Checker One',
    'ROLL-HISTORY-001','historical-record-0001');
  if v_retry is distinct from v_existing
  then raise exception 'identical-key physical receipt retry changed UUID'; end if;

  -- A second random request key cannot re-count the SAME documented line.
  -- Case and edge whitespace are not distinct source identities.
  begin
    perform public.fabric_stock_record_v3(
      'fabric-historical','receipt',5.000,'','Checker Two',
      ' roll-history-001 ','receipt-other-key-0001');
    raise exception 'different-key duplicate receipt unexpectedly succeeded';
  exception when others then
    if SQLERRM<>'physical receipt source line already recorded for fabric'
    then raise; end if;
  end;

  -- A second genuine line can be received for the same SKU; one invoice
  -- can also legitimately document separate SKUs.
  v_new:=public.fabric_stock_record_v3(
    'fabric-historical','receipt',1.000,'','Checker One',
    'ROLL-HISTORY-002','receipt-real-line-0002');
  if v_new is null then raise exception 'distinct receipt line rejected'; end if;
  v_new:=public.fabric_stock_record_v3(
    'fabric-other-sku','receipt',1.000,'','Checker One',
    'ROLL-HISTORY-001','receipt-other-sku-0003');
  if v_new is null then raise exception 'distinct fabric receipt rejected'; end if;

  -- Corrections are not physical receipt events and do not consume the
  -- receipt natural key; they remain separately idempotent by request key.
  v_new:=public.fabric_stock_record_v3(
    'fabric-historical','adjustment_in',0.100,'count correction',
    'Checker One','ROLL-HISTORY-001','receipt-adjustment-0004');
  if v_new is null then raise exception 'valid correction rejected'; end if;

  -- Direct privileged ledger writes cannot bypass the source-line index.
  begin
    insert into private.fabric_stock_ledger(
      fabric_id,event_type,quantity_metres,note,recorded_by,
      source_reference,request_key
    ) values (
      'fabric-historical','receipt',5.000,'','Checker One',
      ' ROLL-HISTORY-001 ','receipt-direct-bypass-0005');
    raise exception 'direct duplicate receipt bypassed natural-key index';
  exception when unique_violation then null;
  end;

  select count(*) into v_rows from private.fabric_stock_ledger
   where fabric_id='fabric-historical' and event_type='receipt'
     and lower(btrim(source_reference))='roll-history-001';
  if v_rows<>1 then raise exception 'same physical line counted more than once'; end if;

  if has_function_privilege('anon',
      'public.fabric_stock_record_v3(text,text,numeric,text,text,text,text)','EXECUTE')
     or has_function_privilege('authenticated',
      'public.fabric_stock_record_v3(text,text,numeric,text,text,text,text)','EXECUTE')
     or not has_function_privilege('service_role',
      'public.fabric_stock_record_v3(text,text,numeric,text,text,text,text)','EXECUTE')
  then raise exception 'receipt dedupe weakened privileged RPC grants'; end if;
end;
$receipt$;
