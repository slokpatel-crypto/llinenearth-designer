-- TITAN M36: source-only, durable idempotency for physical stock receipt/adjustment.
-- Requires controlled staging/live migration approval; never apply to production from CI.
-- Existing v2 remains available until the API and operator UI adopt v3.
-- Depends on 20261001_fabric_stock_ledger.sql and 20261028_fabric_stock_provenance.sql.
create or replace function public.fabric_stock_record_v3(
  p_fabric_id text,
  p_event_type text,
  p_quantity_metres numeric,
  p_note text default '',
  p_recorded_by text default '',
  p_source_reference text default '',
  p_request_key text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_id uuid;
  v_existing private.fabric_stock_ledger%rowtype;
  v_fabric text:=left(trim(coalesce(p_fabric_id,'')),160);
  v_key text:=left(trim(coalesce(p_request_key,'')),180);
  v_note text:=left(trim(coalesce(p_note,'')),600);
  v_checker text:=left(trim(coalesce(p_recorded_by,'')),120);
  v_source text:=left(trim(coalesce(p_source_reference,'')),240);
  v_available numeric:=0;
begin
  if length(v_fabric)=0 then raise exception 'fabric id is required' using errcode='22023'; end if;
  if p_event_type is null or p_event_type not in ('receipt','adjustment_in','adjustment_out') then
    raise exception 'unsupported manual stock event' using errcode='22023';
  end if;
  if p_quantity_metres is null or p_quantity_metres<=0 or p_quantity_metres>100000
     or p_quantity_metres<>round(p_quantity_metres,3) then
    raise exception 'invalid stock quantity' using errcode='22023';
  end if;
  if length(v_checker)<2 then raise exception 'named stock checker is required' using errcode='22023'; end if;
  if length(v_source)<3 then raise exception 'physical stock source is required' using errcode='22023'; end if;
  if length(v_key)<12 then raise exception 'stock request key is required' using errcode='22023'; end if;

  -- The existing request_key unique index also covers reservations. Reuse the
  -- reservation lock namespace so cross-action key collisions fail atomically.
  perform pg_advisory_xact_lock(hashtext('stock-request:'||v_key));
  select * into v_existing from private.fabric_stock_ledger where request_key=v_key limit 1;
  if found then
    if v_existing.event_type is distinct from p_event_type
       or v_existing.fabric_id is distinct from v_fabric
       or v_existing.quantity_metres is distinct from p_quantity_metres
       or v_existing.note is distinct from v_note
       or v_existing.recorded_by is distinct from v_checker
       or v_existing.source_reference is distinct from v_source
       or v_existing.reservation_id is not null
       or v_existing.revision_id is not null then
      raise exception 'stock request key belongs to different physical evidence' using errcode='22023';
    end if;
    return v_existing.event_id;
  end if;

  -- Cooperate with both the legacy manual recorder and the newer reservation
  -- locks until migration of every caller is separately verified.
  perform pg_advisory_xact_lock(hashtext(v_fabric));
  perform pg_advisory_xact_lock(hashtext('stock-fabric:'||v_fabric));
  if p_event_type='adjustment_out' then
    select coalesce(s.available_metres,0) into v_available
      from public.fabric_stock_snapshot_v2(array[v_fabric]) s limit 1;
    if coalesce(v_available,0)<p_quantity_metres then
      raise exception 'adjustment exceeds available stock' using errcode='22023';
    end if;
  end if;

  insert into private.fabric_stock_ledger(
    fabric_id,event_type,quantity_metres,request_key,note,recorded_by,source_reference
  ) values(v_fabric,p_event_type,p_quantity_metres,v_key,v_note,v_checker,v_source)
  returning event_id into v_id;
  return v_id;
end;
$$;

revoke all on function public.fabric_stock_record_v3(text,text,numeric,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.fabric_stock_record_v3(text,text,numeric,text,text,text,text)
  to service_role;
