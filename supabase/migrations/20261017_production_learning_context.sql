-- Durable privacy-safe design lineage for production outcome learning.
-- Stores garment/style/fabric context only. Measurements and body-profile data are intentionally excluded.

create table if not exists private.production_order_learning_context (
  order_id uuid primary key references private.production_orders(order_id) on delete cascade,
  revision_id text not null,
  recipe_hash text not null,
  context jsonb not null,
  created_at timestamptz not null default now(),
  check (recipe_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists production_order_learning_context_revision_idx
  on private.production_order_learning_context(revision_id,created_at desc);

alter table private.production_order_learning_context enable row level security;
revoke all on private.production_order_learning_context from public,anon,authenticated;

create or replace function public.production_order_create_with_context(
  p_revision_id text,
  p_recipe_hash text,
  p_quote_id uuid,
  p_note text,
  p_context jsonb
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare v_order uuid;
begin
  if jsonb_typeof(p_context)<>'object' then raise exception 'production learning context must be an object'; end if;
  if p_context->>'version'<>'linen-earth-production-learning-context-v1' then raise exception 'unsupported production learning context'; end if;
  if p_context->>'revisionId'<>trim(p_revision_id) then raise exception 'learning context revision mismatch'; end if;
  if lower(coalesce(p_context->>'recipeHash',''))<>lower(p_recipe_hash) then raise exception 'learning context recipe mismatch'; end if;
  if pg_column_size(p_context)>65536 then raise exception 'production learning context is too large'; end if;
  if p_context ? 'bodyProfile' or p_context ? 'measurements' or p_context ? 'finishedTargets' then
    raise exception 'production learning context contains prohibited personal measurement data';
  end if;

  v_order:=public.production_order_create(p_revision_id,p_recipe_hash,p_quote_id,p_note);

  insert into private.production_order_learning_context(order_id,revision_id,recipe_hash,context)
  values(v_order,left(trim(p_revision_id),220),lower(p_recipe_hash),p_context);

  return v_order;
end;
$$;

create or replace function public.production_order_learning_context_list(p_limit integer default 500)
returns table(
  order_id uuid,revision_id text,recipe_hash text,context jsonb,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select c.order_id,c.revision_id,c.recipe_hash,c.context,c.created_at
  from private.production_order_learning_context c
  order by c.created_at desc
  limit greatest(1,least(coalesce(p_limit,500),5000));
$$;

create or replace function public.production_customer_outcome_learning_list(p_limit integer default 1000)
returns table(
  outcome_id uuid,
  order_id uuid,
  revision_id text,
  overall_rating text,
  fit_result text,
  worn_confirmed boolean,
  note text,
  created_at timestamptz,
  learning_context jsonb
)
language sql
security definer
set search_path='public','private'
as $$
  select latest.outcome_id,latest.order_id,latest.revision_id,latest.overall_rating,latest.fit_result,
    latest.worn_confirmed,latest.note,latest.created_at,latest.learning_context
  from (
    select distinct on (o.order_id)
      o.outcome_id,o.order_id,p.revision_id,o.overall_rating,o.fit_result,o.worn_confirmed,o.note,o.created_at,
      c.context as learning_context
    from private.production_customer_outcomes o
    join private.production_orders p on p.order_id=o.order_id
    left join private.production_order_learning_context c on c.order_id=o.order_id
    order by o.order_id,o.created_at desc
  ) latest
  order by latest.created_at desc
  limit greatest(1,least(coalesce(p_limit,1000),5000));
$$;

create or replace function public.production_customer_outcome_review_record(
  p_outcome_id uuid,
  p_decision text,
  p_reviewer text,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_review uuid;
  v_order uuid;
begin
  if p_decision not in ('approved','rejected') then raise exception 'invalid customer outcome review decision'; end if;
  if length(trim(coalesce(p_reviewer,'')))<2 then raise exception 'named reviewer is required'; end if;
  if p_decision='rejected' and length(trim(coalesce(p_note,'')))<3 then raise exception 'rejection note is required'; end if;

  select order_id into v_order
  from private.production_customer_outcomes
  where outcome_id=p_outcome_id;

  if v_order is null then raise exception 'unknown customer outcome'; end if;
  if p_decision='approved' and not exists(
    select 1 from private.production_order_learning_context where order_id=v_order
  ) then
    raise exception 'durable production design context is required before evidence approval';
  end if;

  insert into private.production_customer_outcome_reviews(outcome_id,decision,reviewer,note)
  values(p_outcome_id,p_decision,left(trim(p_reviewer),120),left(trim(coalesce(p_note,'')),1200))
  returning review_id into v_review;
  return v_review;
end;
$$;

revoke all on function public.production_order_create_with_context(text,text,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.production_order_learning_context_list(integer) from public,anon,authenticated;
revoke all on function public.production_customer_outcome_learning_list(integer) from public,anon,authenticated;
revoke all on function public.production_customer_outcome_review_record(uuid,text,text,text) from public,anon,authenticated;

grant execute on function public.production_order_create_with_context(text,text,uuid,text,jsonb) to service_role;
grant execute on function public.production_order_learning_context_list(integer) to service_role;
grant execute on function public.production_customer_outcome_learning_list(integer) to service_role;
grant execute on function public.production_customer_outcome_review_record(uuid,text,text,text) to service_role;
