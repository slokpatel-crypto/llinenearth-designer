-- Human launch evidence for Roadmap v2 Phase 9.
-- Stores anonymous private-beta attempts and append-only launch checklist sign-offs.
-- No customer names, phone numbers, emails or measurements are stored here.

create schema if not exists private;

create table if not exists private.launch_beta_attempts (
  attempt_id uuid primary key default gen_random_uuid(),
  case_id text not null,
  device_class text not null check (device_class in ('mobile','tablet','desktop')),
  core_flow_completed boolean not null,
  blocking_bug boolean not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (length(case_id) between 3 and 80)
);

create table if not exists private.launch_checklist_events (
  event_id uuid primary key default gen_random_uuid(),
  item_id text not null check (item_id in (
    'privacy_notice','terms_refunds','measurement_handling',
    'third_party_processing','operator_access','incident_contact'
  )),
  status text not null check (status in ('approved','review')),
  signed_by text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (length(signed_by) between 2 and 120)
);

create index if not exists launch_beta_attempts_case_idx
  on private.launch_beta_attempts(case_id,created_at desc);
create index if not exists launch_checklist_events_item_idx
  on private.launch_checklist_events(item_id,created_at desc);

alter table private.launch_beta_attempts enable row level security;
alter table private.launch_checklist_events enable row level security;
revoke all on private.launch_beta_attempts from public,anon,authenticated;
revoke all on private.launch_checklist_events from public,anon,authenticated;

create or replace function public.launch_beta_attempt_record(
  p_case_id text,
  p_device_class text,
  p_core_flow_completed boolean,
  p_blocking_bug boolean,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare v_attempt uuid;
begin
  if p_device_class not in ('mobile','tablet','desktop') then raise exception 'unsupported beta device class'; end if;
  if coalesce(length(trim(p_case_id)),0)<3 or length(trim(p_case_id))>80 then raise exception 'invalid anonymous beta case id'; end if;
  if p_core_flow_completed is null or p_blocking_bug is null then raise exception 'beta outcome fields are required'; end if;
  if p_blocking_bug and length(trim(coalesce(p_note,'')))<3 then raise exception 'blocking beta bugs require a note'; end if;

  insert into private.launch_beta_attempts(case_id,device_class,core_flow_completed,blocking_bug,note)
  values(left(trim(p_case_id),80),p_device_class,p_core_flow_completed,p_blocking_bug,left(coalesce(p_note,''),1200))
  returning attempt_id into v_attempt;
  return v_attempt;
end;
$$;

create or replace function public.launch_checklist_event_record(
  p_item_id text,
  p_status text,
  p_signed_by text,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare v_event uuid;
begin
  if p_item_id not in (
    'privacy_notice','terms_refunds','measurement_handling',
    'third_party_processing','operator_access','incident_contact'
  ) then raise exception 'unsupported launch checklist item'; end if;
  if p_status not in ('approved','review') then raise exception 'unsupported launch checklist status'; end if;
  if length(trim(coalesce(p_signed_by,'')))<2 then raise exception 'named sign-off is required'; end if;
  if p_status='review' and length(trim(coalesce(p_note,'')))<3 then raise exception 'review status requires a note'; end if;

  insert into private.launch_checklist_events(item_id,status,signed_by,note)
  values(p_item_id,p_status,left(trim(p_signed_by),120),left(coalesce(p_note,''),1200))
  returning event_id into v_event;
  return v_event;
end;
$$;

create or replace function public.launch_beta_attempt_list(p_limit integer default 200)
returns table(
  attempt_id uuid,case_id text,device_class text,core_flow_completed boolean,
  blocking_bug boolean,note text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select b.attempt_id,b.case_id,b.device_class,b.core_flow_completed,b.blocking_bug,b.note,b.created_at
  from private.launch_beta_attempts b
  order by b.created_at desc
  limit greatest(1,least(coalesce(p_limit,200),500));
$$;

create or replace function public.launch_checklist_event_list(p_limit integer default 200)
returns table(
  event_id uuid,item_id text,status text,signed_by text,note text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select e.event_id,e.item_id,e.status,e.signed_by,e.note,e.created_at
  from private.launch_checklist_events e
  order by e.created_at desc
  limit greatest(1,least(coalesce(p_limit,200),500));
$$;

revoke all on function public.launch_beta_attempt_record(text,text,boolean,boolean,text) from public,anon,authenticated;
revoke all on function public.launch_checklist_event_record(text,text,text,text) from public,anon,authenticated;
revoke all on function public.launch_beta_attempt_list(integer) from public,anon,authenticated;
revoke all on function public.launch_checklist_event_list(integer) from public,anon,authenticated;

grant execute on function public.launch_beta_attempt_record(text,text,boolean,boolean,text) to service_role;
grant execute on function public.launch_checklist_event_record(text,text,text,text) to service_role;
grant execute on function public.launch_beta_attempt_list(integer) to service_role;
grant execute on function public.launch_checklist_event_list(integer) to service_role;
