-- SOURCE-ONLY forward migration. Staging approval required; never apply to live automatically.
-- SOURCE-ONLY forward migration: no stock rows are created or modified.
-- Requires approved staging verification before any production migration.
-- Preserves exact request-key idempotency, locking and v2 RPC signature.
-- A positive numerical balance without complete named manual-event provenance
-- must not authorize a NEW reservation.
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
  v_physical numeric:=0;
  v_provenance_ready boolean:=false;
  v_reservation uuid:=gen_random_uuid();
  v_existing private.fabric_stock_ledger%rowtype;
  v_key text:=trim(coalesce(p_request_key,''));
  v_fabric text:=trim(coalesce(p_fabric_id,''));
  v_revision text:=trim(coalesce(p_revision_id,''));
  v_requester text:=trim(coalesce(p_requested_by,''));
  v_source text:=trim(coalesce(p_source_reference,''));
begin
  -- Reject lossy identity aliases before looking up a key or taking a stock lock.
  if length(v_fabric)>160 or length(v_key)>180 or length(v_revision)>220
    or length(v_requester)>120 or length(v_source)>240 then
    raise exception 'reservation identity or evidence exceeds supported length'
      using errcode='22023';
  end if;
  if length(v_fabric)=0 then raise exception 'fabric id is required'; end if;
  if length(v_key)<12 then raise exception 'reservation request key is required'; end if;
  if p_quantity_metres is null or p_quantity_metres<=0 or p_quantity_metres>100
    or p_quantity_metres<>round(p_quantity_metres,3) then
    raise exception 'invalid reservation quantity';
  end if;
  if length(v_revision)<12 then raise exception 'locked revision id is required'; end if;
  if length(v_requester)<2 then raise exception 'named reservation checker or requester is required'; end if;
  if length(v_source)<3 then raise exception 'reservation quantity evidence reference is required'; end if;

  -- Serialize first-use and replay of each idempotency key before reading it.
  perform pg_advisory_xact_lock(hashtext('stock-request:'||v_key));
  select * into v_existing
  from private.fabric_stock_ledger where request_key=v_key limit 1;
  if found then
    if v_existing.event_type is distinct from 'reserve'
      or v_existing.reservation_id is null
      or v_existing.fabric_id is distinct from v_fabric
      or v_existing.quantity_metres is distinct from p_quantity_metres
      or v_existing.revision_id is distinct from v_revision
      or v_existing.recorded_by is distinct from v_requester
      or v_existing.source_reference is distinct from v_source then
      raise exception 'reservation request key already belongs to different stock evidence'
        using errcode='22023';
    end if;
    -- A legitimate unchanged retry returns the original reservation without
    -- reserving a second physical metre, even after the first response was lost.
    return v_existing.reservation_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-fabric:'||v_fabric));
  select coalesce(s.available_metres,0), coalesce(s.physical_metres,0),
         coalesce(s.provenance_ready,false)
    into v_available,v_physical,v_provenance_ready
  from public.fabric_stock_snapshot_v2(array[v_fabric]) s limit 1;
  -- A numerical balance alone cannot authorize cutting against legacy,
  -- missing or partially unverified physical receipts/adjustments.
  if not coalesce(v_provenance_ready,false) or coalesce(v_physical,0)<=0 then
    raise exception 'reservation requires verified physical stock provenance'
      using errcode='22023';
  end if;
  if coalesce(v_available,0)<p_quantity_metres then
    raise exception 'insufficient available stock';
  end if;

  insert into private.fabric_stock_ledger(
    fabric_id,event_type,quantity_metres,reservation_id,revision_id,request_key,
    note,recorded_by,source_reference
  ) values(
    v_fabric,'reserve',p_quantity_metres,v_reservation,v_revision,v_key,
    'locked design reservation',v_requester,v_source
  );
  return v_reservation;
end;
$$;

revoke all on function public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.fabric_stock_reserve_v2(text,numeric,text,text,text,text)
  to service_role;
