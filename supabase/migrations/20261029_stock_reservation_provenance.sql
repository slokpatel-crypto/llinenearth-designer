-- Tie reservation quantities to a named human/source reference.
-- The reservation remains revision-linked and idempotent, while the metres requested
-- must come from an approved meterage sheet, tailor request or other real production source.

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
begin
  if coalesce(length(trim(p_fabric_id)),0)=0 then raise exception 'fabric id is required'; end if;
  if coalesce(length(trim(p_request_key)),0)<12 then raise exception 'reservation request key is required'; end if;

  select reservation_id into v_existing
  from private.fabric_stock_ledger
  where request_key=left(trim(p_request_key),180)
  limit 1;
  if v_existing is not null then return v_existing; end if;
  if p_quantity_metres is null or p_quantity_metres<=0 or p_quantity_metres>100 then raise exception 'invalid reservation quantity'; end if;
  if coalesce(length(trim(p_revision_id)),0)<12 then raise exception 'locked revision id is required'; end if;
  if coalesce(length(trim(p_requested_by)),0)<2 then raise exception 'named reservation checker or requester is required'; end if;
  if coalesce(length(trim(p_source_reference)),0)<3 then raise exception 'reservation quantity evidence reference is required'; end if;

  perform pg_advisory_xact_lock(hashtext(left(trim(p_fabric_id),160)));

  select coalesce(s.available_metres,0) into v_available
  from public.fabric_stock_snapshot_v2(array[left(trim(p_fabric_id),160)]) s
  limit 1;

  if coalesce(v_available,0)<p_quantity_metres then raise exception 'insufficient available stock'; end if;

  insert into private.fabric_stock_ledger(
    fabric_id,event_type,quantity_metres,reservation_id,revision_id,request_key,note,recorded_by,source_reference
  ) values(
    left(trim(p_fabric_id),160),'reserve',round(p_quantity_metres,3),v_reservation,left(trim(p_revision_id),220),
    left(trim(p_request_key),180),'locked design reservation',left(trim(p_requested_by),120),left(trim(p_source_reference),240)
  );

  return v_reservation;
end;
$$;

revoke all on function public.fabric_stock_reserve_v2(text,numeric,text,text,text,text) from public,anon,authenticated;
grant execute on function public.fabric_stock_reserve_v2(text,numeric,text,text,text,text) to service_role;
