-- These tests run only in a disposable GitHub Actions PostgreSQL 16
-- database after actual M108 and M109 migrations.
do $$
declare
  v_quote uuid;
  v_order uuid;
  v_count integer;
begin
  select receipt_id into v_quote
  from public.production_creation_request_receipt_lookup('123e4567-e89b-42d3-a456-426614174100'::uuid)
  where action='create_quote';
  if v_quote is null or not exists(select 1 from private.production_quotes where quote_id=v_quote) then
    raise exception 'committed quote request receipt was not recovered';
  end if;

  select receipt_id into v_order
  from public.production_creation_request_receipt_lookup('123e4567-e89b-42d3-a456-426614174101'::uuid)
  where action='create_order';
  if v_order is null or not exists(select 1 from private.production_orders where order_id=v_order) then
    raise exception 'committed order request receipt was not recovered';
  end if;

  select count(*) into v_count
  from public.production_creation_request_receipt_lookup('123e4567-e89b-42d3-a456-426614174190'::uuid);
  if v_count<>0 then raise exception 'nonexistent request returned a fabricated receipt'; end if;
  select count(*) into v_count from public.production_creation_request_receipt_lookup(null::uuid);
  if v_count<>0 then raise exception 'null request returned fabricated receipts'; end if;

  if has_function_privilege('anon',
     'public.production_creation_request_receipt_lookup(uuid)','EXECUTE')
     or has_function_privilege('authenticated',
     'public.production_creation_request_receipt_lookup(uuid)','EXECUTE')
     or not has_function_privilege('service_role',
     'public.production_creation_request_receipt_lookup(uuid)','EXECUTE') then
    raise exception 'private receipt recovery RPC has incorrect grants';
  end if;

  -- No plaintext note or price or customer data should be duplicated in the
  -- committed request-key ledger; only intent fingerprint and UUID metadata.
  if exists(select 1 from information_schema.columns where table_schema='private'
    and table_name='production_creation_request_receipts'
    and column_name in ('note','recovery_token','customer_phone','line_items','context')) then
    raise exception 'creation request ledger contains private payload columns';
  end if;

  -- The public lookup is read-only; calling it does not create or modify a
  -- quote, order, creation event or idempotent request record.
  select count(*) into v_count from private.production_creation_request_receipts;
  perform * from public.production_creation_request_receipt_lookup(
    '123e4567-e89b-42d3-a456-426614174100'::uuid);
  if (select count(*) from private.production_creation_request_receipts)<>v_count then
    raise exception 'read-only recovery lookup modified request ledger';
  end if;
end
$$;
