-- M114: Read-only operator delivery eligibility, computed inside one SQL
-- snapshot from the SAME physical proof fields as the M113 write gate.
-- This is a UI hint, never authorization: M113's locked delivered transition
-- remains authoritative and must independently revalidate everything.
-- Draft-only; owner schema/security/privacy approval before live migration.
create or replace function public.production_delivery_eligibility_list(p_limit integer default 100)
returns table(
  order_id uuid, revision_id text, recipe_hash text,
  status text, updated_at timestamptz, eligible boolean
)
language sql
stable
security definer
set search_path='public','private'
as $$
  with selected_orders as materialized (
    select o.order_id,o.revision_id,o.recipe_hash,o.status,o.created_at,
           o.updated_at,o.qc_latest_sequence
    from private.production_orders o
    order by o.created_at desc
    limit greatest(1,least(coalesce(p_limit,100),100))
  )
  select o.order_id,o.revision_id,o.recipe_hash,o.status,o.updated_at,
    (
      o.status='ready'
      and q.inspection_sequence is not null
      and q.inspection_sequence=o.qc_latest_sequence
      and q.decision='approved'
      and q.revision_id=o.revision_id
      and q.recipe_hash=o.recipe_hash
      and q.created_at is not null
      and q.created_at>=o.created_at
      and q.inspector is not null
      and length(q.inspector)=length(trim(q.inspector))
      and length(q.inspector) between 2 and 120
      and q.inspection_reference is not null
      and length(q.inspection_reference)=length(trim(q.inspection_reference))
      and length(q.inspection_reference) between 3 and 240
      and jsonb_typeof(q.checks)='object'
      and (select count(*) from jsonb_object_keys(q.checks))=6
      and q.checks @> '{"recipe_match":true,"fabric_match":true,"measurement_check":true,"pattern_alignment":true,"stitching_finish":true,"clean_damage_free":true}'::jsonb
      and not exists(
        select 1 from private.finished_garment_qc_inspections ambiguous
        where ambiguous.order_id=o.order_id
          and ambiguous.created_at=q.created_at
          and ambiguous.inspection_id<>q.inspection_id
      )
    ) is true as eligible
  from selected_orders o
  left join lateral (
    select q.inspection_id,q.inspection_sequence,q.created_at,q.decision,
           q.revision_id,q.recipe_hash,q.inspector,q.inspection_reference,q.checks
    from private.finished_garment_qc_inspections q
    where q.order_id=o.order_id
    order by q.inspection_sequence desc nulls last,q.created_at desc
    limit 1
  ) q on true;
$$;

revoke all on function public.production_delivery_eligibility_list(integer)
  from public,anon,authenticated;
grant execute on function public.production_delivery_eligibility_list(integer)
  to service_role;
