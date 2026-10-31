-- M111: real PostgreSQL non-delivery order-status replay and privacy gates.
do $$
declare
  v_order uuid;
  v_key uuid:='123e4567-e89b-42d3-a456-426614174230';
  v_failed uuid:='123e4567-e89b-42d3-a456-426614174231';
begin
  v_order:=public.production_order_create('LE-M111-STATUS-20261031',repeat('a',64),null,'');
  if public.production_order_set_status_idempotent(v_key,v_order,'cloth_reserved','Roll reserved') is distinct from true
    or public.production_order_set_status_idempotent(v_key,v_order,'cloth_reserved','Roll reserved') is distinct from true then
    raise exception 'same-key order status retry did not confirm';
  end if;
  if (select count(*) from private.production_order_events where order_id=v_order and status='cloth_reserved')<>1
    or (select count(*) from private.production_order_status_request_receipts where request_key=v_key)<>1 then
    raise exception 'order status replay duplicated event or receipt';
  end if;
  begin
    perform public.production_order_set_status_idempotent(v_key,v_order,'cutting','Changed');
    raise exception 'changed-intent order status key unexpectedly accepted';
  exception when others then
    if sqlerrm<>'order status request key belongs to different instructions' then raise; end if;
  end;
  begin
    perform public.production_order_set_status_idempotent(v_failed,v_order,'ready','');
    raise exception 'invalid order transition unexpectedly succeeded';
  exception when others then
    if sqlerrm='invalid order transition unexpectedly succeeded' then raise; end if;
  end;
  if exists(select 1 from private.production_order_status_request_receipts where request_key=v_failed) then
    raise exception 'failed transition consumed the status request key';
  end if;
  if public.production_order_set_status_idempotent(v_failed,v_order,'cutting','') is distinct from true then
    raise exception 'valid retry after failed order transition was rejected';
  end if;
  begin
    perform public.production_order_set_status_idempotent(
      '123e4567-e89b-42d3-a456-426614174232',v_order,'delivered','');
    raise exception 'delivery unexpectedly accepted by generic status wrapper';
  exception when others then
    if sqlerrm<>'delivery requires separate transactional QC verification' then raise; end if;
  end;
  if has_function_privilege('anon','public.production_order_set_status_idempotent(uuid,uuid,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.production_order_set_status_idempotent(uuid,uuid,text,text)','EXECUTE')
    or not has_function_privilege('service_role','public.production_order_set_status_idempotent(uuid,uuid,text,text)','EXECUTE') then
    raise exception 'incorrect order status RPC privileges';
  end if;
  if not (select relrowsecurity from pg_class where oid='private.production_order_status_request_receipts'::regclass) then
    raise exception 'order status request ledger RLS disabled';
  end if;
end
$$;
