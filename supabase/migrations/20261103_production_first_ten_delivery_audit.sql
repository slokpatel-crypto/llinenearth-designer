-- First-ten real delivery proof must use complete historical orders and all audit rows.
-- The existing 500-row newest-order list is for operator browsing, not certification.
-- This returns at most ten earliest currently delivered orders (by creation order,
-- preserving the current Phase 8 policy), plus every audit for those exact orders.
-- Result is private: callable by service_role only, never browser/anon clients.

create or replace function public.production_first_ten_delivery_audit()
returns jsonb
language sql
security definer
set search_path='public','private'
as $$
  with first_ten as (
    select o.order_id,o.revision_id,o.recipe_hash,o.status,o.note,o.created_at
    from private.production_orders o
    where o.status='delivered'
    order by o.created_at asc,o.order_id asc
    limit 10
  )
  select jsonb_build_object(
    'version','linen-earth-production-first-ten-audit-v1',
    'orders',coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_id',o.order_id,'revision_id',o.revision_id,
        'recipe_hash',o.recipe_hash,'status',o.status,
        'note',o.note,'created_at',o.created_at
      ) order by o.created_at,o.order_id)
      from first_ten o
    ),'[]'::jsonb),
    'evidence',coalesce((
      select jsonb_agg(jsonb_build_object(
        'evidence_id',e.evidence_id,'order_id',e.order_id,
        'revision_id',e.revision_id,'recipe_hash',e.recipe_hash,
        'manual_design_reentry',e.manual_design_reentry,
        'reentry_fields',e.reentry_fields,'note',e.note,
        'operator',e.operator,'evidence_reference',e.evidence_reference,
        'created_at',e.created_at,'order_created_at',o.created_at
      ) order by e.created_at,e.evidence_id)
      from private.production_delivery_evidence e
      join first_ten o on o.order_id=e.order_id
    ),'[]'::jsonb)
  );
$$;

revoke all on function public.production_first_ten_delivery_audit()
  from public,anon,authenticated;
grant execute on function public.production_first_ten_delivery_audit()
  to service_role;
