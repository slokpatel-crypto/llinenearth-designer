-- DRAFT ONLY. Replaces the existing reserve_v2 function in place after
-- 20261031_stock_reservation_concurrency_provenance.sql and the idempotent
-- manual stock-record v3 migration. Never apply without schema owner approval.
--
-- A request key is the immutable identity of ONE exact, physically sourced
-- reservation. A repeat with a different SKU, quantity, locked design revision
-- or human/provenance evidence must fail, not return the original reservation.
-- Advisory locks and the existing partial unique ledger index still serialize
-- concurrent requests. Do not silently truncate or round immutable evidence.

create or replace function public.fabric_stock_reserve_v2(
  p_fabric_id text,
  p_quantity_metres numeric,
  p_revision_id text,
  p_request_key text,
  p_requested_by text default '',
  p_source_reference text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_available numeric:=0;
  v_reservation uuid:=gen_random_uuid();
  v_existing record;
begin
  if p_fabric_id is null or length(p_fabric_id)<1 or length(p_fabric_id)>160
     or p_fabric_id<>btrim(p_fabric_id) then
    raise exception 'invalid reservation fabric identity';
  end if;
  if p_request_key is null or length(p_request_key)<12 or length(p_request_key)>180
     or p_request_key<>btrim(p_request_key) then
    raise exception 'invalid reservation request key';
  end if;
  if p_revision_id is null or length(p_revision_id)<12 or length(p_revision_id)>220
     or p_revision_id<>btrim(p_revision_id) then
    raise exception 'invalid locked revision identity';
  end if;
  if p_quantity_metres is null or p_quantity_metres<0.001 or p_quantity_metres>100
     or p_quantity_metres<>round(p_quantity_metres,3) then
    raise exception 'invalid exact reservation quantity';
  end if;
  if p_requested_by is null or length(btrim(p_requested_by))<2
     or length(p_requested_by)>120 then
    raise exception 'invalid reservation checker';
  end if;
  if p_source_reference is null or length(btrim(p_source_reference))<3
     or length(p_source_reference)>240 then
    raise exception 'invalid reservation physical source reference';
  end if;

  -- Shared with fabric_stock_record_v3. A reserve key cannot impersonate
  -- a previously committed stock receipt or belong to a different hold.
  perform pg_advisory_xact_lock(hashtext('stock-request:'||p_request_key));

  select l.event_type,l.reservation_id,l.fabric_id,l.quantity_metres,
         l.revision_id,l.recorded_by,l.source_reference,l.note
    into v_existing
    from private.fabric_stock_ledger l
   where l.request_key=p_request_key
   limit 1;
  if found then
    if v_existing.event_type<>'reserve'
       or v_existing.reservation_id is null
       or v_existing.fabric_id<>p_fabric_id
       or v_existing.quantity_metres<>p_quantity_metres
       or v_existing.revision_id is distinct from p_revision_id
       or v_existing.recorded_by is distinct from p_requested_by
       or v_existing.source_reference is distinct from p_source_reference
       or v_existing.note<>'locked design reservation' then
      raise exception 'stock reservation request key belongs to different evidence';
    end if;
    return v_existing.reservation_id;
  end if;

  -- Lock namespace and acquisition order exactly match record_v3 and
  -- consumption_v2; preserve no-oversell behavior across stock actions.
  perform pg_advisory_xact_lock(hashtext('stock-fabric:'||p_fabric_id));
  select coalesce(s.available_metres,0) into v_available
    from public.fabric_stock_snapshot_v2(array[p_fabric_id]) s limit 1;
  if coalesce(v_available,0)<p_quantity_metres then
    raise exception 'insufficient available stock';
  end if;

  insert into private.fabric_stock_ledger(
    fabric_id,event_type,quantity_metres,reservation_id,revision_id,
    request_key,note,recorded_by,source_reference
  ) values (
    p_fabric_id,'reserve',p_quantity_metres,v_reservation,p_revision_id,
    p_request_key,'locked design reservation',p_requested_by,p_source_reference
  );
  return v_reservation;
end;
$$;

revoke all on function public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)
  to service_role;
