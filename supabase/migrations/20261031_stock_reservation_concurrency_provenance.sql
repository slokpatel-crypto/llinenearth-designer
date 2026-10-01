-- Harden the full stock reservation lifecycle against duplicate/concurrent close actions.
-- Request-key locks preserve idempotent reserve semantics. Reservation locks serialize
-- release/consume operations, and manual releases require named provenance.

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
  v_existing uuid;
  v_key text:=left(trim(coalesce(p_request_key,'')),180);
  v_fabric text:=left(trim(coalesce(p_fabric_id,'')),160);
begin
  if length(v_fabric)=0 then raise exception 'fabric id is required'; end if;
  if length(v_key)<12 then raise exception 'reservation request key is required'; end if;
  perform pg_advisory_xact_lock(hashtext('stock-request:'||v_key));

  select reservation_id into v_existing
  from private.fabric_stock_ledger where request_key=v_key limit 1;
  if v_existing is not null then return v_existing; end if;
  if p_quantity_metres is null or p_quantity_metres<=0 or p_quantity_metres>100 then raise exception 'invalid reservation quantity'; end if;
  if coalesce(length(trim(p_revision_id)),0)<12 then raise exception 'locked revision id is required'; end if;
  if coalesce(length(trim(p_requested_by)),0)<2 then raise exception 'named reservation checker or requester is required'; end if;
  if coalesce(length(trim(p_source_reference)),0)<3 then raise exception 'reservation quantity evidence reference is required'; end if;

  perform pg_advisory_xact_lock(hashtext('stock-fabric:'||v_fabric));
  select coalesce(s.available_metres,0) into v_available
  from public.fabric_stock_snapshot_v2(array[v_fabric]) s limit 1;
  if coalesce(v_available,0)<p_quantity_metres then raise exception 'insufficient available stock'; end if;

  insert into private.fabric_stock_ledger(
    fabric_id,event_type,quantity_metres,reservation_id,revision_id,request_key,note,recorded_by,source_reference
  ) values(
    v_fabric,'reserve',round(p_quantity_metres,3),v_reservation,left(trim(p_revision_id),220),v_key,
    'locked design reservation',left(trim(p_requested_by),120),left(trim(p_source_reference),240)
  );
  return v_reservation;
end;
$$;

create or replace function public.fabric_stock_release_v2(
  p_reservation_id uuid,
  p_note text default '',
  p_released_by text default '',
  p_source_reference text default ''
)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_fabric text;
  v_revision text;
  v_reserved numeric:=0;
  v_released numeric:=0;
  v_consumed numeric:=0;
  v_remaining numeric:=0;
begin
  if coalesce(length(trim(p_released_by)),0)<2 then raise exception 'named reservation release checker is required'; end if;
  if coalesce(length(trim(p_source_reference)),0)<3 then raise exception 'reservation release reference is required'; end if;
  perform pg_advisory_xact_lock(hashtext('stock-reservation:'||p_reservation_id::text));

  select max(fabric_id),max(revision_id),
    coalesce(sum(case when event_type='reserve' then quantity_metres else 0 end),0),
    coalesce(sum(case when event_type='release' then quantity_metres else 0 end),0),
    coalesce(sum(case when event_type='consume' then quantity_metres else 0 end),0)
  into v_fabric,v_revision,v_reserved,v_released,v_consumed
  from private.fabric_stock_ledger where reservation_id=p_reservation_id;

  v_remaining=v_reserved-v_released-v_consumed;
  if v_fabric is null or v_remaining<=0 then return false; end if;

  insert into private.fabric_stock_ledger(
    fabric_id,event_type,quantity_metres,reservation_id,revision_id,note,recorded_by,source_reference
  ) values(
    v_fabric,'release',round(v_remaining,3),p_reservation_id,v_revision,
    left(trim(coalesce(p_note,'reservation released')),600),left(trim(p_released_by),120),left(trim(p_source_reference),240)
  );
  return true;
end;
$$;

create or replace function public.fabric_stock_consume_reservation_v2(
  p_reservation_id uuid,
  p_actual_metres numeric,
  p_note text default '',
  p_checked_by text default '',
  p_source_reference text default ''
)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_fabric text;
  v_revision text;
  v_reserved numeric:=0;
  v_released numeric:=0;
  v_consumed numeric:=0;
  v_remaining numeric:=0;
  v_physical numeric:=0;
begin
  if p_actual_metres is null or p_actual_metres<=0 or p_actual_metres>100 then raise exception 'invalid actual usage'; end if;
  if coalesce(length(trim(p_checked_by)),0)<2 then raise exception 'named consumption checker is required'; end if;
  if coalesce(length(trim(p_source_reference)),0)<3 then raise exception 'actual cloth-usage evidence reference is required'; end if;
  perform pg_advisory_xact_lock(hashtext('stock-reservation:'||p_reservation_id::text));

  select max(fabric_id),max(revision_id),
    coalesce(sum(case when event_type='reserve' then quantity_metres else 0 end),0),
    coalesce(sum(case when event_type='release' then quantity_metres else 0 end),0),
    coalesce(sum(case when event_type='consume' then quantity_metres else 0 end),0)
  into v_fabric,v_revision,v_reserved,v_released,v_consumed
  from private.fabric_stock_ledger where reservation_id=p_reservation_id;

  v_remaining=v_reserved-v_released-v_consumed;
  if v_fabric is null or v_remaining<=0 then return false; end if;
  if p_actual_metres>v_remaining then raise exception 'actual usage exceeds reserved metres'; end if;

  perform pg_advisory_xact_lock(hashtext('stock-fabric:'||v_fabric));
  select coalesce(s.physical_metres,0) into v_physical
  from public.fabric_stock_snapshot_v2(array[v_fabric]) s limit 1;
  if coalesce(v_physical,0)<p_actual_metres then raise exception 'actual usage exceeds physical stock'; end if;

  insert into private.fabric_stock_ledger(
    fabric_id,event_type,quantity_metres,reservation_id,revision_id,note,recorded_by,source_reference
  ) values(
    v_fabric,'consume',round(p_actual_metres,3),p_reservation_id,v_revision,
    left(trim(coalesce(p_note,'reservation consumed')),600),left(trim(p_checked_by),120),left(trim(p_source_reference),240)
  );

  if v_remaining>p_actual_metres then
    insert into private.fabric_stock_ledger(
      fabric_id,event_type,quantity_metres,reservation_id,revision_id,note,recorded_by,source_reference
    ) values(
      v_fabric,'release',round(v_remaining-p_actual_metres,3),p_reservation_id,v_revision,
      'unused reserved metres released',left(trim(p_checked_by),120),left(trim(p_source_reference),240)
    );
  end if;
  return true;
end;
$$;

revoke all on function public.fabric_stock_release_v2(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.fabric_stock_reserve_v2(text,numeric,text,text,text,text) from public,anon,authenticated;
revoke all on function public.fabric_stock_consume_reservation_v2(uuid,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.fabric_stock_release_v2(uuid,text,text,text) to service_role;
grant execute on function public.fabric_stock_reserve_v2(text,numeric,text,text,text,text) to service_role;
grant execute on function public.fabric_stock_consume_reservation_v2(uuid,numeric,text,text,text) to service_role;
