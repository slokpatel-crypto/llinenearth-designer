-- Disposable PostgreSQL only. Loaded after the historical stock migrations.
-- Reusing a stock reservation key is NOT permission to substitute order evidence.
do $strict_reservation$
declare
  v_original uuid;
  v_count int;
begin
  select reservation_id into v_original from private.fabric_stock_ledger
   where request_key='historical-reserve-0001' and event_type='reserve';
  if v_original is null then raise exception 'historical reservation setup was not found'; end if;

  if public.fabric_stock_reserve_v2(
    'fabric-historical',2.000,'locked-revision-20261031',
    'historical-reserve-0001','Checker One','METERAGE-SHEET-001')
    is distinct from v_original
  then raise exception 'identical reserve retry did not reuse its original UUID'; end if;

  begin
    perform public.fabric_stock_reserve_v2(
      'fabric-wrong',2.000,'locked-revision-20261031',
      'historical-reserve-0001','Checker One','METERAGE-SHEET-001');
    raise exception 'different fabric improperly reused reservation key';
  exception when others then
    if SQLERRM <> 'stock reservation request key belongs to different evidence' then raise; end if;
  end;
  begin
    perform public.fabric_stock_reserve_v2(
      'fabric-historical',2.001,'locked-revision-20261031',
      'historical-reserve-0001','Checker One','METERAGE-SHEET-001');
    raise exception 'different quantity improperly reused reservation key';
  exception when others then
    if SQLERRM <> 'stock reservation request key belongs to different evidence' then raise; end if;
  end;
  begin
    perform public.fabric_stock_reserve_v2(
      'fabric-historical',2.000,'locked-revision-OTHER-001',
      'historical-reserve-0001','Checker One','METERAGE-SHEET-001');
    raise exception 'different locked revision improperly reused reservation key';
  exception when others then
    if SQLERRM <> 'stock reservation request key belongs to different evidence' then raise; end if;
  end;
  begin
    perform public.fabric_stock_reserve_v2(
      'fabric-historical',2.000,'locked-revision-20261031',
      'historical-reserve-0001','Checker Two','METERAGE-SHEET-001');
    raise exception 'different checker improperly reused reservation key';
  exception when others then
    if SQLERRM <> 'stock reservation request key belongs to different evidence' then raise; end if;
  end;
  begin
    perform public.fabric_stock_reserve_v2(
      'fabric-historical',2.000,'locked-revision-20261031',
      'historical-reserve-0001','Checker One','METERAGE-SHEET-002');
    raise exception 'different source document improperly reused reservation key';
  exception when others then
    if SQLERRM <> 'stock reservation request key belongs to different evidence' then raise; end if;
  end;
  -- The stock event and reserve RPCs must reject each other's request keys.
  begin
    perform public.fabric_stock_reserve_v2(
      'fabric-historical',2.000,'locked-revision-20261031',
      'historical-record-0001','Checker One','METERAGE-SHEET-001');
    raise exception 'existing physical receipt key was adopted by a reservation';
  exception when others then
    if SQLERRM <> 'stock reservation request key belongs to different evidence' then raise; end if;
  end;
  -- No silent truncation of a key or rounding of fabricated fraction-metres.
  begin
    perform public.fabric_stock_reserve_v2(
      'fabric-historical',1.000,'locked-revision-20261031',
      ' historical-new-key-0001','Checker One','METERAGE-SHEET-003');
    raise exception 'padded reservation key was accepted';
  exception when others then
    if SQLERRM <> 'invalid reservation request key' then raise; end if;
  end;
  begin
    perform public.fabric_stock_reserve_v2(
      'fabric-historical',1.0004,'locked-revision-20261031',
      'historical-new-key-0002','Checker One','METERAGE-SHEET-003');
    raise exception 'unmeasured sub-millimetre reservation quantity was rounded';
  exception when others then
    if SQLERRM <> 'invalid exact reservation quantity' then raise; end if;
  end;
  begin
    perform public.fabric_stock_reserve_v2(
      'fabric-historical',1.000,'locked-revision-20261031',
      repeat('z',181),'Checker One','METERAGE-SHEET-003');
    raise exception 'overlong reservation request key was truncated';
  exception when others then
    if SQLERRM <> 'invalid reservation request key' then raise; end if;
  end;
  begin
    perform public.fabric_stock_reserve_v2(
      'fabric-historical',1.000,' locked-revision-20261031',
      'historical-new-key-0003','Checker One','METERAGE-SHEET-003');
    raise exception 'padded locked order revision was accepted';
  exception when others then
    if SQLERRM <> 'invalid locked revision identity' then raise; end if;
  end;
  select count(*) into v_count from private.fabric_stock_ledger
    where request_key='historical-reserve-0001';
  if v_count<>1 then raise exception 'different-evidence retries created extra reservation rows'; end if;
  if exists(select 1 from private.fabric_stock_ledger where request_key like 'historical-new-key-%')
  then raise exception 'invalid reservation evidence committed a ledger row'; end if;
  if has_function_privilege('anon',
       'public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)','EXECUTE')
     or not has_function_privilege('service_role',
       'public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)','EXECUTE')
  then raise exception 'reserve RPC execute privileges widened'; end if;
end;
$strict_reservation$;
