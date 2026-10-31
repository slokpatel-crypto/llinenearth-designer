-- Actual disposable PostgreSQL: same-key status replay and changed-intent safety.
do $$
declare
  v_quote uuid;
  v_key uuid:='123e4567-e89b-42d3-a456-426614174220';
  v_failed uuid:='123e4567-e89b-42d3-a456-426614174221';
begin
  v_quote:=public.production_quote_create('LE-M110-STATUS-20261031',repeat('a',64),'INR',
    '[{"label":"Tailoring","amount":100}]'::jsonb,0,'');
  if public.production_quote_set_status_idempotent(v_key,v_quote,'sent','Customer informed') is distinct from true
    or public.production_quote_set_status_idempotent(v_key,v_quote,'sent','Customer informed') is distinct from true then
    raise exception 'same-key quote status retry did not confirm';
  end if;
  if (select count(*) from private.production_quote_events where quote_id=v_quote and event_type='sent')<>1
    or (select count(*) from private.production_quote_status_request_receipts where request_key=v_key)<>1 then
    raise exception 'quote status replay duplicated an event or receipt';
  end if;
  begin
    perform public.production_quote_set_status_idempotent(v_key,v_quote,'void','Customer informed');
    raise exception 'changed-intent quote status key unexpectedly accepted';
  exception when others then
    if sqlerrm<>'quote status request key belongs to different instructions' then raise; end if;
  end;
  begin
    perform public.production_quote_set_status_idempotent(v_failed,v_quote,'sent','');
    raise exception 'invalid status transition unexpectedly succeeded';
  exception when others then
    if sqlerrm='invalid status transition unexpectedly succeeded' then raise; end if;
  end;
  if exists(select 1 from private.production_quote_status_request_receipts where request_key=v_failed) then
    raise exception 'failed transition consumed the status request key';
  end if;
  if public.production_quote_set_status_idempotent(v_failed,v_quote,'accepted','') is distinct from true then
    raise exception 'valid retry after failed transition was rejected';
  end if;
  if has_function_privilege('anon','public.production_quote_set_status_idempotent(uuid,uuid,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.production_quote_set_status_idempotent(uuid,uuid,text,text)','EXECUTE')
    or not has_function_privilege('service_role','public.production_quote_set_status_idempotent(uuid,uuid,text,text)','EXECUTE') then
    raise exception 'incorrect quote status RPC privileges';
  end if;
  if not (select relrowsecurity from pg_class where oid='private.production_quote_status_request_receipts'::regclass) then
    raise exception 'quote status request ledger RLS disabled';
  end if;
end
$$;
