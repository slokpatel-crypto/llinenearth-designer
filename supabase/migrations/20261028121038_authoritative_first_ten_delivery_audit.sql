-- Authoritative Phase 8 delivery chronology and operator audit queue.
-- The release gate must use the first actual delivered events, not capped
-- newest-order and oldest-evidence lists that can describe different orders.

create index if not exists production_order_events_delivered_created_idx
  on private.production_order_events(created_at,order_id)
  where status='delivered';

create or replace function public.production_delivery_first_ten_audit()
returns table(
  order_id uuid,
  revision_id text,
  recipe_hash text,
  current_status text,
  order_created_at timestamptz,
  delivered_at timestamptz,
  total_delivered_count integer,
  evidence_id uuid,
  evidence_revision_id text,
  evidence_recipe_hash text,
  manual_design_reentry boolean,
  reentry_fields jsonb,
  note text,
  operator text,
  evidence_reference text,
  evidence_created_at timestamptz
)
language sql
security definer
set search_path=''
as $$
  with delivered as (
    select
      o.order_id,
      o.revision_id,
      o.recipe_hash,
      o.status as current_status,
      o.created_at as order_created_at,
      min(event.created_at) as delivered_at,
      count(*) over ()::integer as total_delivered_count
    from private.production_orders o
    join private.production_order_events event
      on event.order_id=o.order_id and event.status='delivered'
    group by o.order_id,o.revision_id,o.recipe_hash,o.status,o.created_at
  ), first_ten as (
    select *
    from delivered
    order by delivered_at asc,order_id asc
    limit 10
  )
  select
    item.order_id,item.revision_id,item.recipe_hash,item.current_status,
    item.order_created_at,item.delivered_at,item.total_delivered_count,
    evidence.evidence_id,evidence.revision_id as evidence_revision_id,
    evidence.recipe_hash as evidence_recipe_hash,
    evidence.manual_design_reentry,evidence.reentry_fields,
    evidence.note,evidence.operator,evidence.evidence_reference,
    evidence.created_at as evidence_created_at
  from first_ten item
  left join private.production_delivery_evidence evidence on evidence.order_id=item.order_id
  order by item.delivered_at asc,item.order_id asc;
$$;

create or replace function public.production_delivery_evidence_recent(p_limit integer default 200)
returns table(
  evidence_id uuid,
  order_id uuid,
  revision_id text,
  recipe_hash text,
  manual_design_reentry boolean,
  reentry_fields jsonb,
  note text,
  operator text,
  evidence_reference text,
  created_at timestamptz,
  order_created_at timestamptz
)
language sql
security definer
set search_path=''
as $$
  select evidence.evidence_id,evidence.order_id,evidence.revision_id,evidence.recipe_hash,
    evidence.manual_design_reentry,evidence.reentry_fields,evidence.note,evidence.operator,
    evidence.evidence_reference,evidence.created_at,orders.created_at as order_created_at
  from private.production_delivery_evidence evidence
  join private.production_orders orders on orders.order_id=evidence.order_id
  order by evidence.created_at desc,evidence.evidence_id desc
  limit greatest(1,least(coalesce(p_limit,200),500));
$$;

revoke all on function public.production_delivery_first_ten_audit() from public,anon,authenticated;
revoke all on function public.production_delivery_evidence_recent(integer) from public,anon,authenticated;
grant execute on function public.production_delivery_first_ten_audit() to service_role;
grant execute on function public.production_delivery_evidence_recent(integer) to service_role;
