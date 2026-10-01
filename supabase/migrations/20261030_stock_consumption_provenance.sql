-- Require measured provenance for physical cloth consumption.
-- Consume rows reduce physical stock, so their actual metres must be tied to a named
-- checker and a real cutting/usage reference rather than an unexplained operator number.

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

  select max(fabric_id),max(revision_id),
    coalesce(sum(case when event_type='reserve' then quantity_metres else 0 end),0),
    coalesce(sum(case when event_type='release' then quantity_metres else 0 end),0),
    coalesce(sum(case when event_type='consume' then quantity_metres else 0 end),0)
  into v_fabric,v_revision,v_reserved,v_released,v_consumed
  from private.fabric_stock_ledger
  where reservation_id=p_reservation_id;

  v_remaining=v_reserved-v_released-v_consumed;
  if v_fabric is null or v_remaining<=0 then return false; end if;
  if p_actual_metres>v_remaining then raise exception 'actual usage exceeds reserved metres'; end if;

  perform pg_advisory_xact_lock(hashtext(v_fabric));

  select coalesce(s.physical_metres,0) into v_physical
  from public.fabric_stock_snapshot_v2(array[v_fabric]) s limit 1;

  if coalesce(v_physical,0)<p_actual_metres then raise exception 'actual usage exceeds physical stock'; end if;

  insert into private.fabric_stock_ledger(
    fabric_id,event_type,quantity_metres,reservation_id,revision_id,note,recorded_by,source_reference
  ) values(
    v_fabric,'consume',round(p_actual_metres,3),p_reservation_id,v_revision,left(trim(coalesce(p_note,'actual reservation consumption')),600),
    left(trim(p_checked_by),120),left(trim(p_source_reference),240)
  );

  if v_remaining>p_actual_metres then
    insert into private.fabric_stock_ledger(fabric_id,event_type,quantity_metres,reservation_id,revision_id,note,recorded_by,source_reference)
    values(v_fabric,'release',round(v_remaining-p_actual_metres,3),p_reservation_id,v_revision,'unused reserved metres released',
      left(trim(p_checked_by),120),left(trim(p_source_reference),240));
  end if;

  return true;
end;
$$;

revoke all on function public.fabric_stock_consume_reservation_v2(uuid,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.fabric_stock_consume_reservation_v2(uuid,numeric,text,text,text) to service_role;
