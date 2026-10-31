-- M112: atomic delivery replay under the canonical SQL QC gate. Draft only.
create table if not exists private.production_delivery_request_receipts (
 request_key uuid primary key,
 intent_sha256 bytea not null check(octet_length(intent_sha256)=32),
 order_id uuid not null references private.production_orders(order_id),
 created_at timestamptz not null default now()
);
alter table private.production_delivery_request_receipts enable row level security;
revoke all on private.production_delivery_request_receipts from public,anon,authenticated;
create or replace function public.production_order_deliver_idempotent(
 p_request_key uuid,p_order_id uuid,p_note text default ''
) returns boolean
language plpgsql security definer set search_path='public','private'
as $$
declare
 v_hash bytea;
 v_saved bytea;
 v_ok boolean;
begin
 if p_request_key is null or p_request_key::text !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then
  raise exception 'invalid delivery request key';
 end if;
 if p_order_id is null or p_note is null or length(p_note)>1000 then
  raise exception 'invalid delivery instruction';
 end if;
 v_hash:=sha256(convert_to(jsonb_build_object('orderId',p_order_id,'status','delivered','note',p_note)::text,'UTF8'));
 perform pg_advisory_xact_lock(hashtextextended('production:delivery:'||p_request_key::text,0));
 select intent_sha256 into v_saved from private.production_delivery_request_receipts where request_key=p_request_key;
 if found then
  if v_saved<>v_hash then raise exception 'delivery key belongs to different instructions'; end if;
  return true;
 end if;
 -- The canonical transition locks the order row, re-reads QC and emits one event.
 v_ok:=public.production_order_set_status(p_order_id,'delivered',p_note);
 if v_ok is distinct from true then return false; end if;
 insert into private.production_delivery_request_receipts(request_key,intent_sha256,order_id)
 values(p_request_key,v_hash,p_order_id);
 return true;
end;
$$;
revoke all on function public.production_order_deliver_idempotent(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.production_order_deliver_idempotent(uuid,uuid,text) to service_role;
