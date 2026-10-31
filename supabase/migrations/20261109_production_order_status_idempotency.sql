-- M111: original-key replay for NON-DELIVERY order transitions only.
-- Delivery remains separately blocked on atomic physical QC verification.
-- Draft-only: owner schema/security review required before any live migration.
create table if not exists private.production_order_status_request_receipts (
  request_key uuid primary key,
  intent_sha256 bytea not null check (octet_length(intent_sha256)=32),
  order_id uuid not null references private.production_orders(order_id),
  target_status text not null check (target_status in (
    'cloth_reserved','cutting','stitching','fitting','ready','cancelled'
  )),
  created_at timestamptz not null default now()
);
alter table private.production_order_status_request_receipts enable row level security;
revoke all on private.production_order_status_request_receipts from public,anon,authenticated;

create or replace function public.production_order_set_status_idempotent(
  p_request_key uuid,
  p_order_id uuid,
  p_status text,
  p_note text default ''
)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_intent bytea;
  v_saved bytea;
  v_updated boolean;
begin
  if p_request_key is null or p_request_key::text !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then
    raise exception 'invalid order status request key';
  end if;
  -- Do not make a physical delivery look approved via a generic replay receipt.
  if p_status is null or p_status not in (
    'cloth_reserved','cutting','stitching','fitting','ready','cancelled'
  ) then
    raise exception 'delivery requires separate transactional QC verification';
  end if;
  v_intent:=sha256(convert_to(jsonb_build_object(
    'orderId',p_order_id,'status',p_status,'note',coalesce(p_note,'')
  )::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('production-status:order:'||p_request_key::text,0));
  select intent_sha256 into v_saved
    from private.production_order_status_request_receipts where request_key=p_request_key;
  if found then
    if v_saved<>v_intent then
      raise exception 'order status request key belongs to different instructions';
    end if;
    return true;
  end if;
  v_updated:=public.production_order_set_status(p_order_id,p_status,p_note);
  if v_updated is distinct from true then return false; end if;
  insert into private.production_order_status_request_receipts(
    request_key,intent_sha256,order_id,target_status
  ) values(p_request_key,v_intent,p_order_id,p_status);
  return true;
end;
$$;

revoke all on function public.production_order_set_status_idempotent(uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.production_order_set_status_idempotent(uuid,uuid,text,text)
  to service_role;
