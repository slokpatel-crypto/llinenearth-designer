-- Harden finished-garment QC with named inspection provenance.
-- Legacy inspections remain visible but do not unlock delivery unless the latest
-- approved inspection contains a named inspector and a physical inspection reference.

alter table private.finished_garment_qc_inspections
  add column if not exists inspection_reference text not null default '';

create or replace function public.finished_garment_qc_record_v2(
  p_order_id uuid,p_decision text,p_checks jsonb,p_defects jsonb default '[]'::jsonb,
  p_note text default '',p_inspector text default '',p_inspection_reference text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_inspection uuid;
  v_revision text;
  v_recipe_hash text;
  v_status text;
begin
  if p_decision not in ('approved','rework') then raise exception 'unsupported QC decision'; end if;
  if jsonb_typeof(p_checks)<>'object' then raise exception 'QC checks must be an object'; end if;
  if jsonb_typeof(coalesce(p_defects,'[]'::jsonb))<>'array' then raise exception 'QC defects must be an array'; end if;
  if coalesce(length(trim(p_inspector)),0)<2 then raise exception 'named inspector or checker is required'; end if;
  if coalesce(length(trim(p_inspection_reference)),0)<3 then raise exception 'physical inspection reference is required'; end if;

  select revision_id,recipe_hash,status into v_revision,v_recipe_hash,v_status
  from private.production_orders where order_id=p_order_id for update;

  if v_status is null then raise exception 'unknown production order'; end if;
  if v_status<>'ready' then raise exception 'finished-garment QC can only be recorded when the order is ready'; end if;

  if p_decision='approved' and not (
    coalesce(p_checks->'recipe_match','false'::jsonb)='true'::jsonb and
    coalesce(p_checks->'fabric_match','false'::jsonb)='true'::jsonb and
    coalesce(p_checks->'measurement_check','false'::jsonb)='true'::jsonb and
    coalesce(p_checks->'pattern_alignment','false'::jsonb)='true'::jsonb and
    coalesce(p_checks->'stitching_finish','false'::jsonb)='true'::jsonb and
    coalesce(p_checks->'clean_damage_free','false'::jsonb)='true'::jsonb
  ) then raise exception 'all finished-garment QC checks must pass before approval'; end if;

  if p_decision='rework' and jsonb_array_length(coalesce(p_defects,'[]'::jsonb))=0
     and length(trim(coalesce(p_note,'')))<3 then raise exception 'rework requires a defect or note'; end if;

  insert into private.finished_garment_qc_inspections(
    order_id,revision_id,recipe_hash,decision,checks,defects,note,inspector,inspection_reference
  ) values(
    p_order_id,v_revision,v_recipe_hash,p_decision,p_checks,coalesce(p_defects,'[]'::jsonb),
    left(trim(coalesce(p_note,'')),1200),left(trim(p_inspector),120),left(trim(p_inspection_reference),240)
  ) returning inspection_id into v_inspection;

  if p_decision='rework' then
    update private.production_orders set status='stitching',updated_at=now(),
      note=case when trim(coalesce(p_note,''))='' then note else left(p_note,1000) end
    where order_id=p_order_id;
    insert into private.production_order_events(order_id,status,payload)
    values(p_order_id,'stitching',jsonb_build_object('source','finished_garment_qc','inspection_id',v_inspection,'reason','rework'));
  end if;
  return v_inspection;
end;
$$;

drop function if exists public.finished_garment_qc_list(integer);
create function public.finished_garment_qc_list(p_limit integer default 100)
returns table(
  inspection_id uuid,order_id uuid,revision_id text,recipe_hash text,decision text,
  checks jsonb,defects jsonb,note text,inspector text,inspection_reference text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select q.inspection_id,q.order_id,q.revision_id,q.recipe_hash,q.decision,
    q.checks,q.defects,q.note,q.inspector,q.inspection_reference,q.created_at
  from private.finished_garment_qc_inspections q
  order by q.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),500));
$$;

create or replace function public.production_order_set_status(
  p_order_id uuid,p_status text,p_note text default ''
)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_current text;
  v_latest_qc text;
  v_latest_inspector text;
  v_latest_reference text;
begin
  if p_status not in ('cloth_reserved','cutting','stitching','fitting','ready','delivered','cancelled') then
    raise exception 'unsupported order status';
  end if;

  select status into v_current from private.production_orders where order_id=p_order_id for update;
  if v_current is null then return false; end if;

  if not (
    (v_current='created' and p_status in ('cloth_reserved','cancelled')) or
    (v_current='cloth_reserved' and p_status in ('cutting','cancelled')) or
    (v_current='cutting' and p_status in ('stitching','cancelled')) or
    (v_current='stitching' and p_status in ('fitting','ready','cancelled')) or
    (v_current='fitting' and p_status in ('stitching','ready','cancelled')) or
    (v_current='ready' and p_status in ('delivered','cancelled'))
  ) then raise exception 'invalid order transition from % to %',v_current,p_status; end if;

  if p_status='delivered' then
    select decision,inspector,inspection_reference into v_latest_qc,v_latest_inspector,v_latest_reference
    from private.finished_garment_qc_inspections
    where order_id=p_order_id order by created_at desc limit 1;
    if coalesce(v_latest_qc,'')<>'approved' then
      raise exception 'finished-garment QC approval is required before delivery';
    end if;
    if coalesce(length(trim(v_latest_inspector)),0)<2 or coalesce(length(trim(v_latest_reference)),0)<3 then
      raise exception 'provenance-backed finished-garment QC approval is required before delivery';
    end if;
  end if;

  update private.production_orders set status=p_status,updated_at=now(),
    note=case when trim(coalesce(p_note,''))='' then note else left(p_note,1000) end
  where order_id=p_order_id;
  insert into private.production_order_events(order_id,status,payload)
  values(p_order_id,p_status,jsonb_build_object('note',left(coalesce(p_note,''),1000),'from',v_current));
  return true;
end;
$$;

revoke all on function public.finished_garment_qc_record_v2(uuid,text,jsonb,jsonb,text,text,text) from public,anon,authenticated;
revoke all on function public.finished_garment_qc_list(integer) from public,anon,authenticated;
grant execute on function public.finished_garment_qc_record_v2(uuid,text,jsonb,jsonb,text,text,text) to service_role;
grant execute on function public.finished_garment_qc_list(integer) to service_role;
