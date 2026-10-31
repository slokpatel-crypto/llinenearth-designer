-- M127 disposable PostgreSQL only: synthetic event and immutable QC truth.
-- Verify delivered/accepted event histories cannot be rewritten, removed or
-- truncated even by direct privileged SQL. Existing RPCs only INSERT events.
do $$
declare
  v_quote uuid;
  v_order uuid;
  v_delivery uuid:='123e4567-e89b-42d3-a456-426614174348'::uuid;
  v_event uuid;
  v_checks jsonb:='{"recipe_match":true,"fabric_match":true,"measurement_check":true,"pattern_alignment":true,"stitching_finish":true,"clean_damage_free":true}'::jsonb;
begin
  if has_function_privilege('anon',
    'private.reject_production_event_mutation()','EXECUTE')
    or has_function_privilege('authenticated',
    'private.reject_production_event_mutation()','EXECUTE') then
    raise exception 'M127 private production event rejection function publicly executable';
  end if;
  v_quote:=public.production_quote_create(
    'LE-M127-LOCKED-REVISION',repeat('f',64),'INR',
    '[{"label":"CI fabric and sewing","amount":125}]'::jsonb,0,'Synthetic only');
  perform public.production_quote_set_status(v_quote,'sent','');
  perform public.production_quote_set_status(v_quote,'accepted','');
  if (select count(*) from private.production_quote_events where quote_id=v_quote)<>3
     or (select count(*) from private.production_quote_events
          where quote_id=v_quote and event_type='accepted')<>1 then
    raise exception 'M127 accepted quote event baseline not written'; end if;

  v_order:=public.production_order_create(
    'LE-M127-LOCKED-REVISION',repeat('f',64),v_quote,'Synthetic only');
  perform public.production_order_set_status(v_order,'cloth_reserved','');
  perform public.production_order_set_status(v_order,'cutting','');
  perform public.production_order_set_status(v_order,'stitching','');
  perform public.production_order_set_status(v_order,'ready','');
  perform public.finished_garment_qc_record_v2(
    v_order,'approved',v_checks,'[]'::jsonb,'',
    'CI checker','CI-M127-SYNTHETIC-APPROVAL');
  if public.production_order_deliver_idempotent(v_delivery,v_order,'Synthetic delivered')
       is distinct from true then
    raise exception 'M127 delivery setup failed'; end if;
  select event_id into v_event from private.production_order_events
    where order_id=v_order and status='delivered';
  if v_event is null then
    raise exception 'M127 delivered event missing'; end if;

  begin
    update private.production_order_events set status='cancelled'
      where event_id=v_event;
    raise exception 'M127 order event UPDATE succeeded';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from private.production_order_events where event_id=v_event;
    raise exception 'M127 order event DELETE succeeded';
  exception when sqlstate '55000' then null;
  end;
  begin
    truncate private.production_order_events;
    raise exception 'M127 order event TRUNCATE succeeded';
  exception when sqlstate '55000' then null;
  end;
  begin
    update private.production_quote_events set event_type='void'
      where quote_id=v_quote and event_type='accepted';
    raise exception 'M127 quote event UPDATE succeeded';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from private.production_quote_events
      where quote_id=v_quote and event_type='accepted';
    raise exception 'M127 quote event DELETE succeeded';
  exception when sqlstate '55000' then null;
  end;
  begin
    truncate private.production_quote_events;
    raise exception 'M127 quote event TRUNCATE succeeded';
  exception when sqlstate '55000' then null;
  end;
  if (select count(*) from private.production_quote_events
      where quote_id=v_quote)<>3
    or (select count(*) from private.production_order_events
      where order_id=v_order and status='delivered')<>1
    or (select count(*) from private.production_delivery_request_receipts
      where order_id=v_order and request_key=v_delivery)<>1 then
    raise exception 'M127 event, quote acceptance or replay receipt tampered'; end if;
  -- Immutable idempotency still replays a previously successful delivery once.
  if public.production_order_deliver_idempotent(v_delivery,v_order,'Synthetic delivered')
     is distinct from true
    or (select count(*) from private.production_order_events
      where order_id=v_order and status='delivered')<>1 then
    raise exception 'M127 historical replay created duplicate delivered event'; end if;
end $$;
