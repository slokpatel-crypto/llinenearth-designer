-- Phase 8: certify the first ten ACTUALLY delivered orders by completion time.
-- Newest-500 order browsing cannot establish first-ten release evidence.
-- Require an original created event and exactly one terminal delivered event.
-- Missing/backdated or contradictory later status events block approval.
-- All functions and their evidence remain private to service_role.

create index if not exists production_orders_first_delivered_idx
  on private.production_orders(status,created_at,order_id);
create index if not exists production_order_events_delivered_proof_idx
  on private.production_order_events(order_id,created_at)
  where status='delivered';

create or replace function public.production_first_ten_delivery_audit()
returns jsonb
language sql
security definer
set search_path='public','private'
as $$
  with delivered_orders as (
    select o.order_id,o.revision_id,o.recipe_hash,o.status,o.note,o.created_at,
      (select min(ev.created_at)
       from private.production_order_events ev
       where ev.order_id=o.order_id and ev.status='delivered') as delivered_at,
      (select count(*)
       from private.production_order_events ev
       where ev.order_id=o.order_id and ev.status='delivered') as delivered_event_count,
      (select min(ev.created_at)
       from private.production_order_events ev
       where ev.order_id=o.order_id and ev.status='created') as created_event_at,
      (select count(*)
       from private.production_order_events ev
       where ev.order_id=o.order_id and ev.status<>'delivered'
         and ev.created_at >= (
           select min(done.created_at) from private.production_order_events done
           where done.order_id=o.order_id and done.status='delivered'
         )) as after_delivery_transition_count
    from private.production_orders o
    where o.status='delivered'
  ),
  first_ten as (
    select * from delivered_orders
    order by delivered_at asc nulls first,created_at asc,order_id asc
    limit 10
  )
  select jsonb_build_object(
    'version','linen-earth-production-first-ten-audit-v2',
    -- A current delivered order without a matching chronological delivery
    -- event invalidates the entire history, not merely that order's evidence.
    'historyValid',coalesce((
      select bool_and(
        delivered_at is not null
        and delivered_at>=created_at
        and created_event_at is not null
        and created_event_at>=created_at
        and created_event_at<=delivered_at
        and delivered_event_count=1
        and after_delivery_transition_count=0
      )
      from delivered_orders
    ),true),
    'orders',coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_id',o.order_id,'revision_id',o.revision_id,
        'recipe_hash',o.recipe_hash,'status',o.status,
        'note',o.note,'created_at',o.created_at,'delivered_at',o.delivered_at
      ) order by o.delivered_at asc nulls first,o.created_at,o.order_id)
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
