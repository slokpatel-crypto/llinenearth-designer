-- Align manual physical stock changes with reserve/consume fabric advisory locks.
-- Source-only migration; no stock rows are created or modified by applying it.
create or replace function public.fabric_stock_record_v2(
  p_fabric_id text,
  p_event_type text,
  p_quantity_metres numeric,
  p_note text default '',
  p_recorded_by text default '',
  p_source_reference text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_id uuid;
  v_available numeric:=0;
begin
  if coalesce(length(trim(p_fabric_id)),0)=0 then raise exception 'fabric id is required'; end if;
  if p_event_type not in ('receipt','adjustment_in','adjustment_out') then raise exception 'unsupported manual stock event'; end if;
  if p_quantity_metres is null or p_quantity_metres<=0 or p_quantity_metres>100000 then raise exception 'invalid quantity'; end if;
  if coalesce(length(trim(p_recorded_by)),0)<2 then raise exception 'named stock checker or recorder is required'; end if;
  if coalesce(length(trim(p_source_reference)),0)<3 then raise exception 'physical stock source reference is required'; end if;

  perform pg_advisory_xact_lock(hashtext('stock-fabric:'||left(trim(p_fabric_id),160)));

  if p_event_type='adjustment_out' then
    select coalesce(s.available_metres,0) into v_available
    from public.fabric_stock_snapshot(array[left(trim(p_fabric_id),160)]) s
    limit 1;
    if coalesce(v_available,0)<p_quantity_metres then raise exception 'adjustment exceeds available stock'; end if;
  end if;

  insert into private.fabric_stock_ledger(
    fabric_id,event_type,quantity_metres,note,recorded_by,source_reference
  ) values(
    left(trim(p_fabric_id),160),p_event_type,round(p_quantity_metres,3),left(trim(coalesce(p_note,'')),600),
    left(trim(p_recorded_by),120),left(trim(p_source_reference),240)
  ) returning event_id into v_id;
  return v_id;
end;
$$;


revoke all on function public.fabric_stock_record_v2(text,text,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.fabric_stock_record_v2(text,text,numeric,text,text,text) to service_role;
