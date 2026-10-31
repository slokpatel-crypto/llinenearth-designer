-- M112 draft: enforce full physical QC checks at the canonical SQL delivery boundary.
-- Complements the existing order-row FOR UPDATE locking in both QC record RPCs.
-- Owner schema/security approval required before live migration. No fake physical evidence.
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
  v_latest_checks jsonb;
  v_latest_revision text;
  v_latest_recipe text;
  v_latest_created timestamptz;
  v_order_created timestamptz;
  v_order_revision text;
  v_order_recipe text;
  v_ties bigint;
begin
  if p_status not in ('cloth_reserved','cutting','stitching','fitting','ready','delivered','cancelled') then
    raise exception 'unsupported order status';
  end if;

  select status,revision_id,recipe_hash,created_at into v_current,v_order_revision,v_order_recipe,v_order_created from private.production_orders where order_id=p_order_id for update;
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
    select decision,inspector,inspection_reference,checks,revision_id,recipe_hash,created_at
      into v_latest_qc,v_latest_inspector,v_latest_reference,v_latest_checks,
           v_latest_revision,v_latest_recipe,v_latest_created
    from private.finished_garment_qc_inspections
    where order_id=p_order_id order by created_at desc limit 1;
    if coalesce(v_latest_qc,'')<>'approved'
       or v_latest_revision is distinct from v_order_revision
       or v_latest_recipe is distinct from v_order_recipe
       or v_latest_created<v_order_created
       or v_latest_created is null then
      raise exception 'current matching QC approval required before delivery';
    end if;
    select count(*) into v_ties from private.finished_garment_qc_inspections
      where order_id=p_order_id and created_at=v_latest_created;
    if v_ties<>1 then raise exception 'ambiguous latest QC inspection'; end if;
    if v_latest_inspector is null or length(v_latest_inspector)<>length(trim(v_latest_inspector))
       or length(v_latest_inspector) not between 2 and 120
       or v_latest_reference is null or length(v_latest_reference)<>length(trim(v_latest_reference))
       or length(v_latest_reference) not between 3 and 240 then
      raise exception 'provenance-backed QC approval required before delivery';
    end if;
    if jsonb_typeof(v_latest_checks)<>'object'
       or (select count(*) from jsonb_object_keys(v_latest_checks))<>6
       or not (v_latest_checks @> '{"recipe_match":true,"fabric_match":true,"measurement_check":true,"pattern_alignment":true,"stitching_finish":true,"clean_damage_free":true}'::jsonb) then
      raise exception 'six exact passing physical QC checks required before delivery';
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

-- Preserve service-role-only RPC access after replacement.
revoke all on function public.production_order_set_status(uuid,text,text) from public,anon,authenticated;
grant execute on function public.production_order_set_status(uuid,text,text) to service_role;
