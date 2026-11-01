-- T5/J5: order-scoped, deterministic latest QC with a transactional fail-closed delivery gate.
-- Draft only: never apply to a live Supabase project without a separately approved rollout.
-- PostgreSQL/owner acceptance and schema-cache refresh remain required.
create or replace function public.finished_garment_qc_latest_for_order(p_order_id uuid)
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
  where q.order_id=p_order_id
  order by q.created_at desc,q.inspection_id desc
  limit 2;
$$;

revoke all on function public.finished_garment_qc_latest_for_order(uuid) from public,anon,authenticated;
grant execute on function public.finished_garment_qc_latest_for_order(uuid) to service_role;

-- Replaces the existing transactional status RPC with the same signature and
-- transition policy; only the latest QC tie handling changes.
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
  v_latest_at timestamptz;
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
    select decision,inspector,inspection_reference,created_at
      into v_latest_qc,v_latest_inspector,v_latest_reference,v_latest_at
    from private.finished_garment_qc_inspections
    where order_id=p_order_id
    order by created_at desc,inspection_id desc limit 1;
    -- A tie at the latest PostgreSQL timestamp is ambiguous, even if UUID
    -- sorting is deterministic. Never let a tied older approval win delivery.
    if exists (
      select 1 from private.finished_garment_qc_inspections
      where order_id=p_order_id and created_at=v_latest_at
      limit 1 offset 1
    ) then
      raise exception 'ambiguous latest finished-garment QC timestamp';
    end if;
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


revoke all on function public.production_order_set_status(uuid,text,text) from public,anon,authenticated;
grant execute on function public.production_order_set_status(uuid,text,text) to service_role;
