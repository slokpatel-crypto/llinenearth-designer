-- Tighten the existing private-beta evidence so the shared Phase 5 / Phase 9 gate
-- proves the exact Launch 1 lock -> share/enquiry journey instead of relying on one generic checkbox.

alter table private.launch_beta_attempts
  add column if not exists design_locked boolean not null default false,
  add column if not exists share_or_enquiry_completed boolean not null default false;

create or replace function public.launch_beta_attempt_record_v2(
  p_case_id text,
  p_device_class text,
  p_design_locked boolean,
  p_share_or_enquiry_completed boolean,
  p_blocking_bug boolean,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_attempt uuid;
  v_complete boolean;
begin
  if p_device_class not in ('mobile','tablet','desktop') then raise exception 'unsupported beta device class'; end if;
  if coalesce(length(trim(p_case_id)),0)<3 or length(trim(p_case_id))>80 then raise exception 'invalid anonymous beta case id'; end if;
  if p_design_locked is null or p_share_or_enquiry_completed is null or p_blocking_bug is null then
    raise exception 'beta outcome fields are required';
  end if;
  if p_share_or_enquiry_completed and not p_design_locked then
    raise exception 'share/enquiry completion cannot precede a locked design';
  end if;
  if p_blocking_bug and length(trim(coalesce(p_note,'')))<3 then raise exception 'blocking beta bugs require a note'; end if;

  v_complete=p_design_locked and p_share_or_enquiry_completed;

  insert into private.launch_beta_attempts(
    case_id,device_class,core_flow_completed,design_locked,share_or_enquiry_completed,blocking_bug,note
  ) values(
    left(trim(p_case_id),80),p_device_class,v_complete,p_design_locked,p_share_or_enquiry_completed,
    p_blocking_bug,left(coalesce(p_note,''),1200)
  )
  returning attempt_id into v_attempt;
  return v_attempt;
end;
$$;

drop function if exists public.launch_beta_attempt_list(integer);

create function public.launch_beta_attempt_list(p_limit integer default 200)
returns table(
  attempt_id uuid,case_id text,device_class text,core_flow_completed boolean,
  design_locked boolean,share_or_enquiry_completed boolean,
  blocking_bug boolean,note text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select b.attempt_id,b.case_id,b.device_class,b.core_flow_completed,
    b.design_locked,b.share_or_enquiry_completed,b.blocking_bug,b.note,b.created_at
  from private.launch_beta_attempts b
  order by b.created_at desc
  limit greatest(1,least(coalesce(p_limit,200),500));
$$;

revoke all on function public.launch_beta_attempt_record_v2(text,text,boolean,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.launch_beta_attempt_record_v2(text,text,boolean,boolean,boolean,text) to service_role;
