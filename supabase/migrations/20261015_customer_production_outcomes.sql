-- Post-delivery customer outcome evidence for Roadmap v2 Phase 11.
-- Customer evidence is tied to an authenticated, delivered production order.
-- It is deliberately not fed directly into Designer ranking without a later human review layer.

create table if not exists private.production_customer_outcomes (
  outcome_id uuid primary key default gen_random_uuid(),
  order_id uuid not null references private.production_orders(order_id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  overall_rating text not null check (overall_rating in ('love','good','needs_work')),
  fit_result text not null check (fit_result in ('clean_first_fit','minor_alteration','major_alteration','not_checked')),
  worn_confirmed boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists production_customer_outcomes_order_idx
  on private.production_customer_outcomes(order_id,created_at desc);
create index if not exists production_customer_outcomes_owner_idx
  on private.production_customer_outcomes(owner_user_id,created_at desc);

alter table private.production_customer_outcomes enable row level security;
revoke all on private.production_customer_outcomes from public,anon,authenticated;

create or replace function public.production_customer_outcome_record(
  p_order_id uuid,
  p_owner_user_id uuid,
  p_overall_rating text,
  p_fit_result text,
  p_worn_confirmed boolean,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_status text;
  v_owner uuid;
  v_outcome uuid;
begin
  if p_overall_rating not in ('love','good','needs_work') then
    raise exception 'invalid customer outcome rating';
  end if;
  if p_fit_result not in ('clean_first_fit','minor_alteration','major_alteration','not_checked') then
    raise exception 'invalid customer fit result';
  end if;
  if coalesce(p_worn_confirmed,false)=false and p_fit_result<>'not_checked' then
    raise exception 'fit result requires confirmed wear';
  end if;
  if (p_overall_rating='needs_work' or p_fit_result='major_alteration')
     and length(trim(coalesce(p_note,'')))<3 then
    raise exception 'a short note is required for a problem outcome';
  end if;

  select status,owner_user_id
  into v_status,v_owner
  from private.production_orders
  where order_id=p_order_id;

  if v_status is null then raise exception 'unknown production order'; end if;
  if v_owner is distinct from p_owner_user_id then raise exception 'production order is not owned by this customer'; end if;
  if v_status<>'delivered' then raise exception 'customer outcome requires a delivered order'; end if;

  insert into private.production_customer_outcomes(
    order_id,owner_user_id,overall_rating,fit_result,worn_confirmed,note
  ) values(
    p_order_id,p_owner_user_id,p_overall_rating,p_fit_result,coalesce(p_worn_confirmed,false),
    left(trim(coalesce(p_note,'')),1000)
  )
  returning outcome_id into v_outcome;

  return v_outcome;
end;
$$;

create or replace function public.production_customer_outcome_list_owned(
  p_owner_user_id uuid,
  p_limit integer default 100
)
returns table(
  outcome_id uuid,
  order_id uuid,
  overall_rating text,
  fit_result text,
  worn_confirmed boolean,
  note text,
  created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select distinct on (o.order_id)
    o.outcome_id,o.order_id,o.overall_rating,o.fit_result,o.worn_confirmed,o.note,o.created_at
  from private.production_customer_outcomes o
  where o.owner_user_id=p_owner_user_id
  order by o.order_id,o.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),200));
$$;

create or replace function public.production_customer_outcome_list(
  p_limit integer default 250
)
returns table(
  outcome_id uuid,
  order_id uuid,
  revision_id text,
  overall_rating text,
  fit_result text,
  worn_confirmed boolean,
  note text,
  created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select distinct on (o.order_id)
    o.outcome_id,o.order_id,p.revision_id,o.overall_rating,o.fit_result,o.worn_confirmed,o.note,o.created_at
  from private.production_customer_outcomes o
  join private.production_orders p on p.order_id=o.order_id
  order by o.order_id,o.created_at desc
  limit greatest(1,least(coalesce(p_limit,250),1000));
$$;

revoke all on function public.production_customer_outcome_record(uuid,uuid,text,text,boolean,text) from public,anon,authenticated;
revoke all on function public.production_customer_outcome_list_owned(uuid,integer) from public,anon,authenticated;
revoke all on function public.production_customer_outcome_list(integer) from public,anon,authenticated;

grant execute on function public.production_customer_outcome_record(uuid,uuid,text,text,boolean,text) to service_role;
grant execute on function public.production_customer_outcome_list_owned(uuid,integer) to service_role;
grant execute on function public.production_customer_outcome_list(integer) to service_role;
