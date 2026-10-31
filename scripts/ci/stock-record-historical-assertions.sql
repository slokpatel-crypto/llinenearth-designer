-- Run ONLY after every real historical stock migration is applied to the
-- disposable titan_stock_historical database. This checks real RPC-to-RPC
-- interaction rather than the minimal schema used in isolated unit tests.
do $history$
declare
  v_event uuid;
  v_retry uuid;
  v_reservation uuid;
  v_actual numeric;
  v_available numeric;
  v_reserved numeric;
  v_physical numeric;
  v_count integer;
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='private' and c.relname='fabric_stock_ledger'
      and c.relrowsecurity=true
  ) then raise exception 'historic physical ledger RLS was not enabled'; end if;
  if to_regprocedure('public.fabric_stock_record(text,text,numeric,text)') is null
     or to_regprocedure('public.fabric_stock_record_v2(text,text,numeric,text,text,text)') is null
     or to_regprocedure('public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)') is null
     or to_regprocedure('public.fabric_stock_release_v2(uuid,text,text,text)') is null
     or to_regprocedure('public.fabric_stock_consume_reservation_v2(uuid,numeric,text,text,text)') is null
  then raise exception 'historic stock RPC lineage is incomplete'; end if;

  v_event:=public.fabric_stock_record_v3(
    'fabric-historical','receipt',5.000,'','Checker One','ROLL-HISTORY-001',
    'historical-record-0001');
  v_retry:=public.fabric_stock_record_v3(
    'fabric-historical','receipt',5.000,'','Checker One','ROLL-HISTORY-001',
    'historical-record-0001');
  if v_event is distinct from v_retry then raise exception 'historic stock receipt retry did not preserve event UUID'; end if;

  v_reservation:=public.fabric_stock_reserve_v2(
    'fabric-historical',2.000,'locked-revision-20261031',
    'historical-reserve-0001','Checker One','METERAGE-SHEET-001');
  if v_reservation is null then raise exception 'historic reservation failed to return an ID'; end if;
  if public.fabric_stock_reserve_v2(
    'fabric-historical',2.000,'locked-revision-20261031',
    'historical-reserve-0001','Checker One','METERAGE-SHEET-001')<>v_reservation
  then raise exception 'historic reservation retry minted another hold'; end if;

  select physical_metres,reserved_metres,available_metres
    into v_physical,v_reserved,v_available
    from public.fabric_stock_snapshot_v2(array['fabric-historical']);
  if v_physical<>5.000 or v_reserved<>2.000 or v_available<>3.000
  then raise exception 'historic stock snapshot disagrees after reservation'; end if;

  -- A manual record must not impersonate an already-accepted reservation ID.
  begin
    perform public.fabric_stock_record_v3(
      'fabric-historical','receipt',2.000,'','Checker One','ROLL-HISTORY-002',
      'historical-reserve-0001');
    raise exception 'reservation request key was adopted by a manual event';
  exception when others then
    if SQLERRM <> 'stock request key already belongs to different evidence' then raise; end if;
  end;

  -- A manual adjustment cannot remove 4m when 2m are physically reserved.
  begin
    perform public.fabric_stock_record_v3(
      'fabric-historical','adjustment_out',4.000,'','Checker One','ADJUSTMENT-001',
      'historical-adjust-0001');
    raise exception 'historical reservation was oversold by manual adjustment';
  exception when others then
    if SQLERRM <> 'adjustment exceeds available unreserved fabric' then raise; end if;
  end;

  -- The real consumption RPC must deduct exactly measured cloth, and release
  -- the unused 0.750m of reserved fabric atomically without phantom metres.
  if public.fabric_stock_consume_reservation_v2(
    v_reservation,1.250,'Cut measured','Cutting Checker','CUT-CARD-001') is distinct from true
  then raise exception 'historic consumption did not close the reservation'; end if;
  if public.fabric_stock_consume_reservation_v2(
    v_reservation,1.250,'Cut measured','Cutting Checker','CUT-CARD-001') is distinct from false
  then raise exception 'historic closed reservation was consumed twice'; end if;
  if public.fabric_stock_release_v2(
    v_reservation,'No cloth remains','Checker One','RELEASE-001') is distinct from false
  then raise exception 'historic closed reservation was released twice'; end if;

  select physical_metres,reserved_metres,available_metres
    into v_physical,v_reserved,v_available
    from public.fabric_stock_snapshot_v2(array['fabric-historical']);
  if v_physical<>3.750 or v_reserved<>0.000 or v_available<>3.750
  then raise exception 'historic real consumption/release changed physical or reserved metres incorrectly'; end if;

  select count(*) into v_count from private.fabric_stock_ledger
    where request_key='historical-record-0001';
  if v_count<>1 then raise exception 'historic manual source was counted more than once'; end if;
  select count(*) into v_count from private.fabric_stock_ledger
    where reservation_id=v_reservation;
  if v_count<>3 then
    raise exception 'historic reservation/consume/unused-release should create exactly 3 ledger rows';
  end if;
end;
$history$;
