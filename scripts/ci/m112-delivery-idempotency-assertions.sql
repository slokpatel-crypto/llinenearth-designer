-- M112: disposable PostgreSQL only. These are synthetic CI records, never physical QC.
do $$
declare
  v_order uuid;
  v_other uuid;
  v_inspection uuid;
  v_key uuid:='123e4567-e89b-42d3-a456-426614174341';
  v_missing uuid:='123e4567-e89b-42d3-a456-426614174342';
  v_checks jsonb:='{"recipe_match":true,"fabric_match":true,"measurement_check":true,"pattern_alignment":true,"stitching_finish":true,"clean_damage_free":true}'::jsonb;
begin
  v_order:=public.production_order_create('LE-M112-REPLAY-REVISION',repeat('a',64),null,'');
  perform public.production_order_set_status(v_order,'cloth_reserved','');
  perform public.production_order_set_status(v_order,'cutting','');
  perform public.production_order_set_status(v_order,'stitching','');
  perform public.production_order_set_status(v_order,'ready','');

  -- Invalid delivery must leave no request receipt and permit a future valid attempt.
  begin
    perform public.production_order_deliver_idempotent(v_missing,v_order,'');
    raise exception 'missing QC wrongly delivered';
  exception when others then
    if sqlerrm<>'current matching QC approval required before delivery' then raise; end if;
  end;
  if exists(select 1 from private.production_delivery_request_receipts where request_key=v_missing) then
    raise exception 'invalid delivery consumed original request key';
  end if;
  v_inspection:=public.finished_garment_qc_record_v2(
    v_order,'approved',v_checks,'[]'::jsonb,'','Test inspector','CI-M112-REPLAY');
  if public.production_order_deliver_idempotent(v_missing,v_order,'') is distinct from true
    or public.production_order_deliver_idempotent(v_missing,v_order,'') is distinct from true then
    raise exception 'same-key delivery replay did not confirm';
  end if;
  if (select count(*) from private.production_order_events
      where order_id=v_order and status='delivered')<>1
     or (select count(*) from private.production_delivery_request_receipts
      where request_key=v_missing and order_id=v_order)<>1 then
    raise exception 'delivery replay duplicated event or receipt';
  end if;
  begin
    perform public.production_order_deliver_idempotent(v_missing,v_order,'different note');
    raise exception 'changed delivery intent wrongly succeeded';
  exception when others then
    if sqlerrm<>'delivery key belongs to different instructions' then raise; end if;
  end;
  v_other:=public.production_order_create('LE-M112-OTHER-REVISION',repeat('a',64),null,'');
  begin
    perform public.production_order_deliver_idempotent(v_missing,v_other,'');
    raise exception 'changed delivery order wrongly succeeded';
  exception when others then
    if sqlerrm<>'delivery key belongs to different instructions' then raise; end if;
  end;
  begin
    perform public.production_order_deliver_idempotent(v_key,v_order,'');
    raise exception 'distinct-key duplicate delivery wrongly succeeded';
  exception when others then
    if sqlerrm not like 'invalid order transition from delivered to delivered%' then raise; end if;
  end;
  if exists(select 1 from private.production_delivery_request_receipts where request_key=v_key) then
    raise exception 'second delivery request consumed a key on failed transition';
  end if;
  if has_function_privilege('anon','public.production_order_deliver_idempotent(uuid,uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','public.production_order_deliver_idempotent(uuid,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role','public.production_order_deliver_idempotent(uuid,uuid,text)','EXECUTE') then
    raise exception 'delivery RPC privilege boundary is incorrect';
  end if;
  if not (select relrowsecurity from pg_class where oid='private.production_delivery_request_receipts'::regclass) then
    raise exception 'delivery receipt RLS is disabled';
  end if;
  if (select count(*) from information_schema.columns
      where table_schema='private' and table_name='production_delivery_request_receipts'
        and column_name in ('inspector','note','checks','recipe_hash','inspection_reference','recovery_token'))<>0 then
    raise exception 'delivery receipt unnecessarily retains private physical/customer data';
  end if;
end $$;
