-- M126 disposable PostgreSQL: synthetic order/QC cannot prove real delivery.
-- Test a committed-looking receipt via the genuine atomic SQL RPC, then
-- attempt direct privileged edits and verify that replay/events stay intact.
do $$
declare
  v_order uuid;
  v_key uuid:='123e4567-e89b-42d3-a456-426614174347'::uuid;
  v_saved bytea;
  v_checks jsonb:='{"recipe_match":true,"fabric_match":true,"measurement_check":true,"pattern_alignment":true,"stitching_finish":true,"clean_damage_free":true}'::jsonb;
begin
  if (select count(*) from pg_trigger
      where tgrelid='private.production_delivery_request_receipts'::regclass
        and tgname='production_delivery_receipt_append_only'
        and tgenabled='O')<>1
    or (select count(*) from pg_trigger
      where tgrelid='private.production_delivery_request_receipts'::regclass
        and tgname='production_delivery_receipt_no_truncate'
        and tgenabled='O')<>1 then
    raise exception 'M126 immutable delivery receipts: enabled triggers missing';
  end if;
  if has_function_privilege('anon',
      'private.reject_production_delivery_receipt_mutation()','EXECUTE')
    or has_function_privilege('authenticated',
      'private.reject_production_delivery_receipt_mutation()','EXECUTE') then
    raise exception 'M126 delivery receipt trigger function exposed to client roles';
  end if;

  v_order:=public.production_order_create('LE-M126-REPLAY-RECEIPT',repeat('e',64),null,'');
  perform public.production_order_set_status(v_order,'cloth_reserved','');
  perform public.production_order_set_status(v_order,'cutting','');
  perform public.production_order_set_status(v_order,'stitching','');
  perform public.production_order_set_status(v_order,'ready','');
  perform public.finished_garment_qc_record_v2(
    v_order,'approved',v_checks,'[]'::jsonb,'',
    'CI checker','CI-M126-PHYSICAL-SYNTHETIC'
  );
  if public.production_order_deliver_idempotent(v_key,v_order,'CI delivery') is distinct from true
  then raise exception 'M126 initial delivery receipt creation failed'; end if;
  select intent_sha256 into v_saved from private.production_delivery_request_receipts
    where request_key=v_key and order_id=v_order;
  if v_saved is null or octet_length(v_saved)<>32 then
    raise exception 'M126 durable replay receipt not written'; end if;

  -- Privileged direct SQL must not rewrite the receipt hash, order or key.
  begin
    update private.production_delivery_request_receipts
      set intent_sha256=sha256(convert_to('forged delivery','UTF8')) where request_key=v_key;
    raise exception 'M126 forged delivery receipt UPDATE succeeded';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from private.production_delivery_request_receipts where request_key=v_key;
    raise exception 'M126 delivery receipt DELETE succeeded';
  exception when sqlstate '55000' then null;
  end;
  begin
    truncate private.production_delivery_request_receipts;
    raise exception 'M126 delivery receipt TRUNCATE succeeded';
  exception when sqlstate '55000' then null;
  end;

  if (select intent_sha256 from private.production_delivery_request_receipts
       where request_key=v_key and order_id=v_order) is distinct from v_saved
    or (select count(*) from private.production_order_events
       where order_id=v_order and status='delivered')<>1 then
    raise exception 'M126 delivery receipt or event changed after rejected mutation'; end if;
  if public.production_order_deliver_idempotent(v_key,v_order,'CI delivery') is distinct from true
    or (select count(*) from private.production_order_events
       where order_id=v_order and status='delivered')<>1
    or (select count(*) from private.production_delivery_request_receipts
       where request_key=v_key and order_id=v_order)<>1 then
    raise exception 'M126 same-request replay not stable after attempted mutation'; end if;
  begin
    perform public.production_order_deliver_idempotent(v_key,v_order,'Changed instruction');
    raise exception 'M126 changed-instruction replay incorrectly succeeded';
  exception when others then
    if sqlerrm<>'delivery key belongs to different instructions' then raise; end if;
  end;
end $$;
