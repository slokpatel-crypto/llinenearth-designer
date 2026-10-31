-- Real SQL functions on isolated PostgreSQL only: no production credentials.
do $$
declare
  v_rev text:='LE-LOCK-IDEMPOTENCY-20261031';
  v_hash text:=repeat('a',64);
  v_lines jsonb:='[{"label":"Linen fabric","amount":1200.50},{"label":"Tailoring","amount":350}]'::jsonb;
  v_quote_key uuid:='123e4567-e89b-42d3-a456-426614174100';
  v_order_key uuid:='123e4567-e89b-42d3-a456-426614174101';
  v_failed_key uuid:='123e4567-e89b-42d3-a456-426614174102';
  v_quote uuid;
  v_quote_replay uuid;
  v_order uuid;
  v_order_replay uuid;
  v_context jsonb;
begin
  v_quote:=public.production_quote_create_idempotent(v_quote_key,v_rev,v_hash,'INR',v_lines,0,'Hem 26 inches');
  v_quote_replay:=public.production_quote_create_idempotent(v_quote_key,v_rev,v_hash,'INR',v_lines,0,'Hem 26 inches');
  if v_quote is distinct from v_quote_replay then raise exception 'same quote key produced different receipt'; end if;
  if (select count(*) from private.production_quotes where quote_id=v_quote)<>1 then raise exception 'quote row is not unique'; end if;
  if (select count(*) from private.production_quote_events where quote_id=v_quote)<>1 then raise exception 'duplicate quote creation event'; end if;
  if (select count(*) from private.production_creation_request_receipts where action='create_quote' and request_key=v_quote_key)<>1 then
    raise exception 'quote retry key generated multiple idempotency receipts';
  end if;
  begin
    perform public.production_quote_create_idempotent(v_quote_key,v_rev,v_hash,'INR',v_lines,0,'Changed tailor note');
    raise exception 'reused key accepted conflicting quote intent';
  exception when others then
    if sqlerrm<>'production creation request key belongs to different quote instructions' then raise; end if;
  end;

  if public.production_quote_set_status(v_quote,'sent','') is distinct from true
    or public.production_quote_set_status(v_quote,'accepted','') is distinct from true then
    raise exception 'canonical quote acceptance failed';
  end if;
  v_context:=jsonb_build_object('version','linen-earth-production-learning-context-v1',
    'revisionId',v_rev,'recipeHash',v_hash,'fabrics',jsonb_build_object('shirtId','CI-LINEN'));
  v_order:=public.production_order_create_with_context_idempotent(v_order_key,v_rev,v_hash,v_quote,'Cut to size',v_context);
  v_order_replay:=public.production_order_create_with_context_idempotent(v_order_key,v_rev,v_hash,v_quote,'Cut to size',v_context);
  if v_order is distinct from v_order_replay then raise exception 'same order key produced different receipt'; end if;
  if (select count(*) from private.production_orders where order_id=v_order)<>1 then raise exception 'order row is not unique'; end if;
  if (select count(*) from private.production_order_events where order_id=v_order)<>1 then raise exception 'duplicate order event'; end if;
  if (select count(*) from private.production_order_learning_context where order_id=v_order)<>1 then raise exception 'duplicate learning context'; end if;
  begin
    perform public.production_order_create_with_context_idempotent(v_order_key,v_rev,v_hash,v_quote,'Different note',v_context);
    raise exception 'reused key accepted conflicting order intent';
  exception when others then
    if sqlerrm<>'production creation request key belongs to different order instructions' then raise; end if;
  end;
  -- Failed validation must roll back before recording any idempotency key.
  begin
    perform public.production_quote_create_idempotent(v_failed_key,v_rev,'short','INR',v_lines,0,'');
    raise exception 'invalid initial create unexpectedly succeeded';
  exception when others then
    if sqlerrm='invalid initial create unexpectedly succeeded' then raise; end if;
  end;
  if exists(select 1 from private.production_creation_request_receipts where request_key=v_failed_key) then
    raise exception 'failed quote creation consumed its retry key';
  end if;
  perform public.production_quote_create_idempotent(v_failed_key,v_rev,v_hash,'INR',v_lines,0,'');
  if (select count(*) from private.production_creation_request_receipts where request_key=v_failed_key)<>1 then
    raise exception 'retry after failed validation did not produce one receipt';
  end if;
  if has_function_privilege('authenticated','public.production_quote_create_idempotent(uuid,text,text,text,jsonb,numeric,text)','EXECUTE')
    or has_function_privilege('anon','public.production_order_create_with_context_idempotent(uuid,text,text,uuid,text,jsonb)','EXECUTE')
    or not has_function_privilege('service_role','public.production_quote_create_idempotent(uuid,text,text,text,jsonb,numeric,text)','EXECUTE')
    or not has_function_privilege('service_role','public.production_order_create_with_context_idempotent(uuid,text,text,uuid,text,jsonb)','EXECUTE') then
      raise exception 'incorrect private production idempotency RPC grants';
  end if;
  if not (select relrowsecurity from pg_class where oid='private.production_creation_request_receipts'::regclass) then
    raise exception 'production creation request RLS is disabled';
  end if;
end
$$;
