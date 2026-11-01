-- Disposable PostgreSQL only. All three results are actual committed
-- synthetic transitions from preceding CI assertions, not fabricated rows.
do $$
declare
  v_key uuid;
  v_count integer;
begin
  if (select count(*) from public.production_status_request_receipt_lookup(
      '123e4567-e89b-42d3-a456-426614174220'::uuid)
      where action='quote_status' and target_status='sent'
        and record_id=(select quote_id from private.production_quote_status_request_receipts
          where request_key='123e4567-e89b-42d3-a456-426614174220'::uuid))<>1 then
    raise exception 'committed quote status receipt was not recovered';
  end if;
  if (select count(*) from public.production_status_request_receipt_lookup(
      '123e4567-e89b-42d3-a456-426614174230'::uuid)
      where action='order_status' and target_status='cloth_reserved'
        and record_id=(select order_id from private.production_order_status_request_receipts
          where request_key='123e4567-e89b-42d3-a456-426614174230'::uuid))<>1 then
    raise exception 'committed order status receipt was not recovered';
  end if;
  if (select count(*) from public.production_status_request_receipt_lookup(
      '123e4567-e89b-42d3-a456-426614174342'::uuid)
      where action='order_status' and target_status='delivered'
        and record_id=(select order_id from private.production_delivery_request_receipts
          where request_key='123e4567-e89b-42d3-a456-426614174342'::uuid))<>1 then
    raise exception 'committed physical delivery receipt was not recovered';
  end if;
  if exists(select 1 from public.production_status_request_receipt_lookup(
      '123e4567-e89b-42d3-a456-426614174999'::uuid))
     or exists(select 1 from public.production_status_request_receipt_lookup(null::uuid)) then
    raise exception 'missing/null status request fabricated a receipt';
  end if;
  if has_function_privilege('anon',
      'public.production_status_request_receipt_lookup(uuid)','EXECUTE')
     or has_function_privilege('authenticated',
      'public.production_status_request_receipt_lookup(uuid)','EXECUTE')
     or not has_function_privilege('service_role',
      'public.production_status_request_receipt_lookup(uuid)','EXECUTE') then
    raise exception 'status receipt lookup privilege boundary failed';
  end if;
  select count(*) into v_count from private.production_order_status_request_receipts;
  perform * from public.production_status_request_receipt_lookup(
    '123e4567-e89b-42d3-a456-426614174230'::uuid);
  if (select count(*) from private.production_order_status_request_receipts)<>v_count then
    raise exception 'read-only status lookup modified the durable ledger';
  end if;
end $$;
