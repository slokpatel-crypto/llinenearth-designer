-- Phase 7 production hardening: explicit named human sign-off for the manual final-render review workflow.
-- This is append-only evidence. A later review can supersede an earlier decision without deleting history.

create schema if not exists private;

create table if not exists private.designer_render_manual_review_signoffs (
  signoff_id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('approved','review')),
  reviewer text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (length(trim(reviewer)) between 2 and 120),
  check (status <> 'review' or length(trim(note)) >= 3)
);

alter table private.designer_render_manual_review_signoffs enable row level security;
revoke all on private.designer_render_manual_review_signoffs from public,anon,authenticated;

create or replace function public.designer_render_manual_review_signoff_record(
  p_status text,
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
  if p_status not in ('approved','review') then raise exception 'invalid manual review signoff status'; end if;
  if coalesce(length(trim(p_reviewer)),0)<2 then raise exception 'named reviewer required'; end if;
  if p_status='review' and coalesce(length(trim(p_note)),0)<3 then raise exception 'review status requires a note'; end if;

  insert into private.designer_render_manual_review_signoffs(status,reviewer,note)
  values(p_status,left(trim(p_reviewer),120),left(coalesce(p_note,''),1000))
  returning signoff_id into v_id;
  return v_id;
end;
$$;

create or replace function public.designer_render_manual_review_signoff_latest()
returns table(signoff_id uuid,status text,reviewer text,note text,created_at timestamptz)
language sql
security definer
set search_path='public','private'
as $$
  select s.signoff_id,s.status,s.reviewer,s.note,s.created_at
  from private.designer_render_manual_review_signoffs s
  order by s.created_at desc
  limit 1;
$$;

revoke all on function public.designer_render_manual_review_signoff_record(text,text,text) from public,anon,authenticated;
revoke all on function public.designer_render_manual_review_signoff_latest() from public,anon,authenticated;
grant execute on function public.designer_render_manual_review_signoff_record(text,text,text) to service_role;
grant execute on function public.designer_render_manual_review_signoff_latest() to service_role;
