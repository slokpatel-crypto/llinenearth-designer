-- M128 disposable PostgreSQL: verify real idempotent RPCs preserve exact
-- quote/order creation and non-delivery status receipts after attempted
-- privileged UPDATE/DELETE/TRUNCATE. Synthetic only, NOT owner acceptance.
do $$
declare
  v_quote uuid;
  v_order uuid;
  v_create_key uuid:='123e4567-e89b-42d3-a456-426614174349'::uuid;
  v_quote_key uuid:='123e4567-e89b-42d3-a456-426614174350'::uuid;
  v_order_key uuid:='123e4567-e89b-42d3-a456-426614174351'::uuid;
  v_saved bytea;
  v_table text;
  v_sql text;
  v_original bigint;
  v_values jsonb:='[{"label":"CI linen and sewing","amount":150}]'::jsonb;
begin
  v_quote:=public.production_quote_create_idempotent(
    v_create_key,'LE-M128-LOCKED-REVISION',repeat('a',64),
    'INR',v_values,0,'Synthetic');
  if v_quote is null then raise exception 'M128 quote creation receipt missing'; end if;
  if public.production_quote_set_status_idempotent(
    v_quote_key,v_quote,'sent','Synthetic') is distinct from true then
    raise exception 'M128 quote status receipt missing'; end if;
  v_order:=public.production_order_create('LE-M128-LOCKED-REVISION',repeat('a',64),null,'');
  if public.production_order_set_status_idempotent(
    v_order_key,v_order,'cloth_reserved','Synthetic') is distinct from true then
    raise exception 'M128 order status receipt missing'; end if;

  for v_table in select unnest(array[
    'production_creation_request_receipts',
    'production_quote_status_request_receipts',
    'production_order_status_request_receipts'
  ]) loop
    execute format('select count(*) from private.%I',v_table) into v_original;
    if v_original<1 then raise exception 'M128 baseline receipt table empty: %',v_table; end if;
    -- A correctly installed BEFORE trigger must reject every privileged edit.
    begin
      execute format('update private.%I set intent_sha256=sha256(convert_to(''forged'',''UTF8''))',
                     v_table);
      raise exception 'M128 receipt UPDATE incorrectly succeeded: %',v_table;
    exception when sqlstate '55000' then null;
    end;
    begin
      execute format('delete from private.%I',v_table);
      raise exception 'M128 receipt DELETE incorrectly succeeded: %',v_table;
    exception when sqlstate '55000' then null;
    end;
    begin
      execute format('truncate private.%I',v_table);
      raise exception 'M128 receipt TRUNCATE incorrectly succeeded: %',v_table;
    exception when sqlstate '55000' then null;
    end;
    execute format('select count(*) from private.%I',v_table) into v_saved;
    if v_saved<>v_original then
      raise exception 'M128 durable receipt table count changed: %',v_table;
    end if;
  end loop;

  if public.production_quote_create_idempotent(
      v_create_key,'LE-M128-LOCKED-REVISION',repeat('a',64),
      'INR',v_values,0,'Synthetic') is distinct from v_quote
    or public.production_quote_set_status_idempotent(
      v_quote_key,v_quote,'sent','Synthetic') is distinct from true
    or public.production_order_set_status_idempotent(
      v_order_key,v_order,'cloth_reserved','Synthetic') is distinct from true then
    raise exception 'M128 unchanged original-key replay failed after mutation attempts'; end if;
  if (select count(*) from private.production_quote_events
      where quote_id=v_quote and event_type='created')<>1
    or (select count(*) from private.production_quote_events
      where quote_id=v_quote and event_type='sent')<>1
    or (select count(*) from private.production_order_events
      where order_id=v_order and status='cloth_reserved')<>1 then
    raise exception 'M128 replay created duplicate events'; end if;
  begin
    perform public.production_quote_set_status_idempotent(
      v_quote_key,v_quote,'accepted','Changed');
    raise exception 'M128 changed quote status instruction was accepted';
  exception when others then
    if sqlerrm<>'quote status request key belongs to different instructions' then raise; end if;
  end;
  begin
    perform public.production_order_set_status_idempotent(
      v_order_key,v_order,'cutting','Changed');
    raise exception 'M128 changed order status instruction was accepted';
  exception when others then
    if sqlerrm<>'order status request key belongs to different instructions' then raise; end if;
  end;
end $$;
