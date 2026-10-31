-- Disposable PostgreSQL 16 ONLY, after the real historical stock migrations.
-- The physical meterage sheet can be shared across different orders, but one
-- actual sheet LINE cannot reserve twice for the SAME fabric and locked design.
do $line_dedupe$
declare
  v_count int;
  v_hold uuid;
begin
  if to_regclass('private.fabric_stock_reserve_source_line_uidx') is null then
    raise exception 'unique meterage line index missing'; end if;

  -- Historical hold has already been consumed and released, but that signed
  -- physical source line must never be silently reserved a second time.
  begin
    perform public.fabric_stock_reserve_v2(
      'fabric-historical',1.000,'locked-revision-20261031',
      'different-key-same-line-0001','Checker One','METERAGE-SHEET-001');
    raise exception 'closed meterage line was reserved a second time';
  exception when others then
    if SQLERRM <> 'meterage source line already reserved for locked design and fabric'
    then raise; end if;
  end;
  -- Case/edge-space variants must NOT bypass the natural identity.
  begin
    perform public.fabric_stock_reserve_v2(
      'fabric-historical',1.000,'locked-revision-20261031',
      'different-key-case-line-0001','Checker One',' meterage-sheet-001 ');
    raise exception 'case/space alias of the same source line was reserved again';
  exception when others then
    if SQLERRM <> 'meterage source line already reserved for locked design and fabric'
    then raise; end if;
  end;

  -- The same paper sheet can legitimately support a DIFFERENT locked order.
  v_hold:=public.fabric_stock_reserve_v2(
    'fabric-historical',1.000,'locked-revision-DIFFERENT',
    'different-order-line-0001','Checker One','METERAGE-SHEET-001');
  if v_hold is null then raise exception 'different locked design could not use same source sheet'; end if;

  -- Separate documented meterage lines for one order are independently valid.
  v_hold:=public.fabric_stock_reserve_v2(
    'fabric-historical',1.000,'locked-revision-20261031',
    'different-line-in-order-0001','Checker One','METERAGE-SHEET-002-LINE-B');
  if v_hold is null then raise exception 'distinct documented source line was blocked'; end if;

  select count(*) into v_count from private.fabric_stock_ledger
    where fabric_id='fabric-historical' and revision_id='locked-revision-20261031'
      and event_type='reserve';
  if v_count<>2 then raise exception 'real stock order has incorrect distinct line count'; end if;
  if exists(
    select 1 from private.fabric_stock_ledger
    where event_type='reserve' and revision_id is not null
      and btrim(source_reference)<>''
    group by fabric_id,revision_id,lower(btrim(source_reference))
    having count(*)>1
  ) then raise exception 'physical meterage line was duplicated in ledger'; end if;

  -- Direct inserts are a regression boundary, even if a future caller
  -- bypasses the RPC's friendly check. Never rely only on API UI validation.
  begin
    insert into private.fabric_stock_ledger(
      fabric_id,event_type,quantity_metres,reservation_id,revision_id,
      request_key,note,recorded_by,source_reference
    ) values (
      'fabric-historical','reserve',0.250,gen_random_uuid(),
      'locked-revision-20261031','direct-insert-duplicate-0001',
      'locked design reservation','Checker One','meterage-sheet-001'
    );
    raise exception 'SQL unique index allowed duplicate meterage line';
  exception when unique_violation then null;
  end;
  if exists(
    select 1 from private.fabric_stock_ledger where request_key='direct-insert-duplicate-0001'
  ) then raise exception 'direct duplicate left physical ledger row'; end if;
end;
$line_dedupe$;
