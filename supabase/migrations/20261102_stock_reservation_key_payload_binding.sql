-- TITAN: bind reservation idempotency keys to the original physical evidence.
-- SOURCE ONLY: requires a controlled PostgreSQL/staging migration and explicit
-- production approval. Never run against live Supabase as part of source CI.
-- Depends on 20261028_fabric_stock_provenance.sql and
-- 20261031_stock_reservation_concurrency_provenance.sql.
--
-- Before this patch a repeated request_key returned its prior reservation_id
-- without checking whether fabric, metres, locked revision, requester or source
-- evidence had changed. Mismatched retries must fail closed, while the same
-- canonical request remains safely idempotent under the existing advisory lock.
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
  v_existing private.fabric_stock_ledger%rowtype;
  v_key text:=left(trim(coalesce(p_request_key,'')),180);
  v_fabric text:=left(trim(coalesce(p_fabric_id,'')),160);
  v_revision text:=left(trim(coalesce(p_revision_id,'')),220);
  v_requester text:=left(trim(coalesce(p_requested_by,'')),120);
  v_source text:=left(trim(coalesce(p_source_reference,'')),240);
begin
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
  select coalesce(s.available_metres,0) into v_available
  from public.fabric_stock_snapshot_v2(array[v_fabric]) s limit 1;
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
