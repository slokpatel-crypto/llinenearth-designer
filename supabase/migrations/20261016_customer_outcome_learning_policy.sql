-- Human review and evidence-threshold policy for Phase 11 customer outcomes.
-- Customer outcomes remain evidence only until a named human policy and enough reviewed cases exist.

create table if not exists private.production_customer_outcome_reviews (
  review_id uuid primary key default gen_random_uuid(),
  outcome_id uuid not null references private.production_customer_outcomes(outcome_id) on delete cascade,
  decision text not null check (decision in ('approved','rejected')),
  reviewer text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists private.production_customer_outcome_policies (
  policy_id uuid primary key default gen_random_uuid(),
  minimum_approved_cases integer not null check (minimum_approved_cases between 1 and 10000),
  approved_by text not null,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists production_customer_outcome_reviews_idx
  on private.production_customer_outcome_reviews(outcome_id,created_at desc);
create index if not exists production_customer_outcome_policies_created_idx
  on private.production_customer_outcome_policies(created_at desc);

alter table private.production_customer_outcome_reviews enable row level security;
alter table private.production_customer_outcome_policies enable row level security;
revoke all on private.production_customer_outcome_reviews from public,anon,authenticated;
revoke all on private.production_customer_outcome_policies from public,anon,authenticated;

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
declare v_review uuid;
begin
  if p_decision not in ('approved','rejected') then raise exception 'invalid customer outcome review decision'; end if;
  if length(trim(coalesce(p_reviewer,'')))<2 then raise exception 'named reviewer is required'; end if;
  if p_decision='rejected' and length(trim(coalesce(p_note,'')))<3 then raise exception 'rejection note is required'; end if;
  if not exists(select 1 from private.production_customer_outcomes where outcome_id=p_outcome_id) then
    raise exception 'unknown customer outcome';
  end if;

  insert into private.production_customer_outcome_reviews(outcome_id,decision,reviewer,note)
  values(p_outcome_id,p_decision,left(trim(p_reviewer),120),left(trim(coalesce(p_note,'')),1200))
  returning review_id into v_review;
  return v_review;
end;
$$;

create or replace function public.production_customer_outcome_review_list(p_limit integer default 1000)
returns table(
  review_id uuid,outcome_id uuid,decision text,reviewer text,note text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select r.review_id,r.outcome_id,r.decision,r.reviewer,r.note,r.created_at
  from private.production_customer_outcome_reviews r
  order by r.created_at desc
  limit greatest(1,least(coalesce(p_limit,1000),5000));
$$;

create or replace function public.production_customer_outcome_policy_record(
  p_minimum_approved_cases integer,
  p_approved_by text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare v_policy uuid;
begin
  if p_minimum_approved_cases is null or p_minimum_approved_cases<1 or p_minimum_approved_cases>10000 then
    raise exception 'invalid minimum approved case threshold';
  end if;
  if length(trim(coalesce(p_approved_by,'')))<2 then raise exception 'named policy approver is required'; end if;
  if length(trim(coalesce(p_note,'')))<3 then raise exception 'policy source note is required'; end if;

  insert into private.production_customer_outcome_policies(minimum_approved_cases,approved_by,note)
  values(p_minimum_approved_cases,left(trim(p_approved_by),120),left(trim(p_note),1200))
  returning policy_id into v_policy;
  return v_policy;
end;
$$;

create or replace function public.production_customer_outcome_policy_list(p_limit integer default 100)
returns table(
  policy_id uuid,minimum_approved_cases integer,approved_by text,note text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select p.policy_id,p.minimum_approved_cases,p.approved_by,p.note,p.created_at
  from private.production_customer_outcome_policies p
  order by p.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),500));
$$;

revoke all on function public.production_customer_outcome_review_record(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.production_customer_outcome_review_list(integer) from public,anon,authenticated;
revoke all on function public.production_customer_outcome_policy_record(integer,text,text) from public,anon,authenticated;
revoke all on function public.production_customer_outcome_policy_list(integer) from public,anon,authenticated;

grant execute on function public.production_customer_outcome_review_record(uuid,text,text,text) to service_role;
grant execute on function public.production_customer_outcome_review_list(integer) to service_role;
grant execute on function public.production_customer_outcome_policy_record(integer,text,text) to service_role;
grant execute on function public.production_customer_outcome_policy_list(integer) to service_role;
