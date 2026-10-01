-- Signed Style Director -> Designer handoff audit.
-- The public handoff token is short-lived and signed server-side. This table stores only
-- non-sensitive stock/style references proving the exact signed handoff reached Designer.

create schema if not exists private;

create table if not exists private.style_director_handoff_audit (
  audit_id uuid primary key default gen_random_uuid(),
  source_look_id text not null,
  shirt_id text not null,
  pant_id text not null,
  occasion text not null,
  created_at timestamptz not null default now(),
  check (length(trim(source_look_id)) between 2 and 180),
  check (length(trim(shirt_id)) between 2 and 180),
  check (length(trim(pant_id)) between 2 and 180)
);

create index if not exists style_director_handoff_audit_look_idx
  on private.style_director_handoff_audit(source_look_id,created_at desc);

alter table private.style_director_handoff_audit enable row level security;
revoke all on private.style_director_handoff_audit from public,anon,authenticated;

create or replace function public.style_director_handoff_audit_record(
  p_source_look_id text,
  p_shirt_id text,
  p_pant_id text,
  p_occasion text
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare v_id uuid;
begin
  if coalesce(length(trim(p_source_look_id)),0)<2 then raise exception 'source look id is required'; end if;
  if coalesce(length(trim(p_shirt_id)),0)<2 or coalesce(length(trim(p_pant_id)),0)<2 then raise exception 'stock pair is required'; end if;

  insert into private.style_director_handoff_audit(source_look_id,shirt_id,pant_id,occasion)
  values(left(trim(p_source_look_id),180),left(trim(p_shirt_id),180),left(trim(p_pant_id),180),left(trim(coalesce(p_occasion,'')),40))
  returning audit_id into v_id;
  return v_id;
end;
$$;

revoke all on function public.style_director_handoff_audit_record(text,text,text,text) from public,anon,authenticated;
grant execute on function public.style_director_handoff_audit_record(text,text,text,text) to service_role;
