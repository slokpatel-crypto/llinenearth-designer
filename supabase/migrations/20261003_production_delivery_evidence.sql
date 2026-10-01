-- Evidence for the Roadmap v2 Phase 8 "first 10 completed orders with zero design-data re-entry" gate.
-- One immutable completion audit is allowed per delivered production order.

create schema if not exists private;

create table if not exists private.production_delivery_evidence (
  evidence_id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references private.production_orders(order_id) on delete cascade,
  revision_id text not null,
  recipe_hash text not null,
  manual_design_reentry boolean not null,
  reentry_fields jsonb not null default '[]'::jsonb check (jsonb_typeof(reentry_fields)='array'),
  note text not null default '',
  operator text not null default '',
  created_at timestamptz not null default now(),
  check (recipe_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists production_delivery_evidence_created_idx
  on private.production_delivery_evidence(created_at desc);

alter table private.production_delivery_evidence enable row level security;
revoke all on private.production_delivery_evidence from public,anon,authenticated;

create or replace function public.production_delivery_evidence_record(
  p_order_id uuid,
  p_manual_design_reentry boolean,
  p_reentry_fields jsonb default '[]'::jsonb,
  p_note text default '',
  p_operator text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_evidence uuid;
  v_revision text;
  v_recipe_hash text;
  v_status text;
begin
  if p_manual_design_reentry is null then raise exception 'manual re-entry confirmation is required'; end if;
  if jsonb_typeof(coalesce(p_reentry_fields,'[]'::jsonb))<>'array' then raise exception 're-entry fields must be an array'; end if;

  select revision_id,recipe_hash,status into v_revision,v_recipe_hash,v_status
  from private.production_orders where order_id=p_order_id;

  if v_status is null then raise exception 'unknown production order'; end if;
  if v_status<>'delivered' then raise exception 'delivery evidence can only be recorded for a delivered order'; end if;
  if p_manual_design_reentry
     and jsonb_array_length(coalesce(p_reentry_fields,'[]'::jsonb))=0
     and length(trim(coalesce(p_note,'')))<3 then
    raise exception 'manual re-entry incident requires fields or note';
  end if;

  insert into private.production_delivery_evidence(
    order_id,revision_id,recipe_hash,manual_design_reentry,reentry_fields,note,operator
  ) values(
    p_order_id,v_revision,v_recipe_hash,p_manual_design_reentry,coalesce(p_reentry_fields,'[]'::jsonb),
    left(coalesce(p_note,''),1200),left(coalesce(p_operator,''),120)
  ) returning evidence_id into v_evidence;

  return v_evidence;
end;
$$;

create or replace function public.production_delivery_evidence_list(p_limit integer default 200)
returns table(
  evidence_id uuid,
  order_id uuid,
  revision_id text,
  recipe_hash text,
  manual_design_reentry boolean,
  reentry_fields jsonb,
  note text,
  operator text,
  created_at timestamptz,
  order_created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select e.evidence_id,e.order_id,e.revision_id,e.recipe_hash,e.manual_design_reentry,
    e.reentry_fields,e.note,e.operator,e.created_at,o.created_at as order_created_at
  from private.production_delivery_evidence e
  join private.production_orders o on o.order_id=e.order_id
  order by o.created_at asc
  limit greatest(1,least(coalesce(p_limit,200),500));
$$;

revoke all on function public.production_delivery_evidence_record(uuid,boolean,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.production_delivery_evidence_list(integer) from public,anon,authenticated;
grant execute on function public.production_delivery_evidence_record(uuid,boolean,jsonb,text,text) to service_role;
grant execute on function public.production_delivery_evidence_list(integer) to service_role;
