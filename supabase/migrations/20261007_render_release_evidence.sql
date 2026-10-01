-- Human evidence for final-render cross-view identity and commercial credit cap.
-- No threshold or cap is invented: the operator must enter the real owner-approved cap.

create schema if not exists private;

create table if not exists private.designer_render_identity_reviews (
  review_id uuid primary key default gen_random_uuid(),
  concept_id text not null,
  status text not null check (status in ('pass','fail')),
  reviewed_views text[] not null,
  reviewer text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (length(trim(concept_id)) between 1 and 180),
  check (array_length(reviewed_views,1) >= 2),
  check (length(trim(reviewer)) between 1 and 120)
);

create index if not exists designer_render_identity_reviews_concept_idx
  on private.designer_render_identity_reviews(concept_id,created_at desc);

alter table private.designer_render_identity_reviews enable row level security;
revoke all on private.designer_render_identity_reviews from public,anon,authenticated;

create table if not exists private.designer_render_credit_cap_events (
  event_id uuid primary key default gen_random_uuid(),
  credits_per_approved_cap numeric(12,4) not null check (credits_per_approved_cap>0 and credits_per_approved_cap<=100000),
  reviewer text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (length(trim(reviewer)) between 1 and 120)
);

alter table private.designer_render_credit_cap_events enable row level security;
revoke all on private.designer_render_credit_cap_events from public,anon,authenticated;

create or replace function public.designer_render_identity_review_record(
  p_concept_id text,
  p_status text,
  p_reviewer text,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_id uuid;
  v_views text[];
begin
  if p_status not in ('pass','fail') then raise exception 'invalid identity status'; end if;
  if coalesce(length(trim(p_reviewer)),0)=0 then raise exception 'reviewer required'; end if;

  select array_agg(distinct o.view order by o.view)
  into v_views
  from private.designer_render_outcomes o
  where o.concept_id=left(trim(p_concept_id),180);

  if coalesce(array_length(v_views,1),0)<2 then
    raise exception 'at least two rendered views are required for identity review';
  end if;

  insert into private.designer_render_identity_reviews(concept_id,status,reviewed_views,reviewer,note)
  values(left(trim(p_concept_id),180),p_status,v_views,left(trim(p_reviewer),120),left(coalesce(p_note,''),1000))
  returning review_id into v_id;

  return v_id;
end;
$$;

create or replace function public.designer_render_identity_review_list(p_limit integer default 300)
returns table(
  review_id uuid,concept_id text,status text,reviewed_views text[],reviewer text,note text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select r.review_id,r.concept_id,r.status,r.reviewed_views,r.reviewer,r.note,r.created_at
  from private.designer_render_identity_reviews r
  order by r.created_at desc
  limit greatest(1,least(coalesce(p_limit,300),1000));
$$;

create or replace function public.designer_render_credit_cap_record(
  p_cap numeric,
  p_reviewer text,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare v_id uuid;
begin
  if p_cap is null or p_cap<=0 or p_cap>100000 then raise exception 'invalid render credit cap'; end if;
  if coalesce(length(trim(p_reviewer)),0)=0 then raise exception 'reviewer required'; end if;

  insert into private.designer_render_credit_cap_events(credits_per_approved_cap,reviewer,note)
  values(round(p_cap,4),left(trim(p_reviewer),120),left(coalesce(p_note,''),1000))
  returning event_id into v_id;
  return v_id;
end;
$$;

create or replace function public.designer_render_credit_cap_latest()
returns table(event_id uuid,credits_per_approved_cap numeric,reviewer text,note text,created_at timestamptz)
language sql
security definer
set search_path='public','private'
as $$
  select e.event_id,e.credits_per_approved_cap,e.reviewer,e.note,e.created_at
  from private.designer_render_credit_cap_events e
  order by e.created_at desc
  limit 1;
$$;

revoke all on function public.designer_render_identity_review_record(text,text,text,text) from public,anon,authenticated;
revoke all on function public.designer_render_identity_review_list(integer) from public,anon,authenticated;
revoke all on function public.designer_render_credit_cap_record(numeric,text,text) from public,anon,authenticated;
revoke all on function public.designer_render_credit_cap_latest() from public,anon,authenticated;

grant execute on function public.designer_render_identity_review_record(text,text,text,text) to service_role;
grant execute on function public.designer_render_identity_review_list(integer) to service_role;
grant execute on function public.designer_render_credit_cap_record(numeric,text,text) to service_role;
grant execute on function public.designer_render_credit_cap_latest() to service_role;
