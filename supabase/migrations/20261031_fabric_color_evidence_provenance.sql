-- Harden physical colour checks with named provenance.
-- Legacy rows remain visible, but only rows with checker/reference/illuminant
-- can satisfy the Phase 2 unique-fabric evidence gate.

alter table private.fabric_physical_color_checks
  add column if not exists checked_by text,
  add column if not exists evidence_reference text;

alter table private.fabric_physical_color_checks
  drop constraint if exists fabric_physical_color_checks_checked_by_check,
  drop constraint if exists fabric_physical_color_checks_evidence_reference_check;

alter table private.fabric_physical_color_checks
  add constraint fabric_physical_color_checks_checked_by_check
    check (checked_by is null or length(trim(checked_by)) between 2 and 120),
  add constraint fabric_physical_color_checks_evidence_reference_check
    check (evidence_reference is null or length(trim(evidence_reference)) between 3 and 240);

create or replace function public.fabric_physical_color_check_record_v2(
  p_fabric_id text,
  p_profile_id text,
  p_digital_hex text,
  p_method text,
  p_physical_l numeric,
  p_physical_a numeric,
  p_physical_b numeric,
  p_physical_hex text,
  p_delta_e numeric,
  p_illuminant text,
  p_device text,
  p_checked_by text,
  p_evidence_reference text,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare v_id uuid;
begin
  if coalesce(length(trim(p_fabric_id)),0)<2 then raise exception 'fabric id is required'; end if;
  if coalesce(length(trim(p_profile_id)),0)<3 then raise exception 'reviewed Analyzer profile id is required'; end if;
  if upper(coalesce(p_digital_hex,'')) !~ '^#[0-9A-F]{6}$' then raise exception 'invalid digital hex'; end if;
  if p_method not in ('spectrophotometer','colorimeter','calibrated_capture') then raise exception 'invalid physical colour method'; end if;
  if p_physical_l is null or p_physical_l<0 or p_physical_l>100 then raise exception 'invalid physical L'; end if;
  if p_physical_a is null or p_physical_a<-160 or p_physical_a>160 then raise exception 'invalid physical a'; end if;
  if p_physical_b is null or p_physical_b<-160 or p_physical_b>160 then raise exception 'invalid physical b'; end if;
  if p_delta_e is null or p_delta_e<0 or p_delta_e>200 then raise exception 'invalid delta E'; end if;
  if nullif(trim(coalesce(p_physical_hex,'')),'') is not null and upper(p_physical_hex) !~ '^#[0-9A-F]{6}$' then raise exception 'invalid physical hex'; end if;
  if coalesce(length(trim(p_illuminant)),0)<2 then raise exception 'controlled illuminant is required'; end if;
  if p_method<>'calibrated_capture' and coalesce(length(trim(p_device)),0)=0 then raise exception 'instrument identity is required'; end if;
  if p_method='calibrated_capture' and coalesce(length(trim(p_note)),0)<4 then raise exception 'capture evidence note is required'; end if;
  if coalesce(length(trim(p_checked_by)),0)<2 then raise exception 'named physical colour checker is required'; end if;
  if coalesce(length(trim(p_evidence_reference)),0)<3 then raise exception 'physical colour evidence reference is required'; end if;

  insert into private.fabric_physical_color_checks(
    fabric_id,profile_id,digital_hex,method,physical_l,physical_a,physical_b,
    physical_hex,delta_e,illuminant,device,checked_by,evidence_reference,note
  ) values(
    left(trim(p_fabric_id),160),left(trim(p_profile_id),100),upper(p_digital_hex),p_method,
    round(p_physical_l,3),round(p_physical_a,3),round(p_physical_b,3),
    case when trim(coalesce(p_physical_hex,''))='' then null else upper(p_physical_hex) end,
    round(p_delta_e,3),left(trim(p_illuminant),80),left(trim(coalesce(p_device,'')),160),
    left(trim(p_checked_by),120),left(trim(p_evidence_reference),240),left(trim(coalesce(p_note,'')),800)
  ) returning check_id into v_id;
  return v_id;
end;
$$;

drop function if exists public.fabric_physical_color_check_list(integer);
create function public.fabric_physical_color_check_list(p_limit integer default 200)
returns table(
  check_id uuid,fabric_id text,profile_id text,digital_hex text,method text,
  physical_l numeric,physical_a numeric,physical_b numeric,physical_hex text,
  delta_e numeric,illuminant text,device text,checked_by text,evidence_reference text,note text,created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select c.check_id,c.fabric_id,c.profile_id,c.digital_hex,c.method,
         c.physical_l,c.physical_a,c.physical_b,c.physical_hex,
         c.delta_e,c.illuminant,c.device,c.checked_by,c.evidence_reference,c.note,c.created_at
  from private.fabric_physical_color_checks c
  order by c.created_at desc
  limit greatest(1,least(coalesce(p_limit,200),1000));
$$;

revoke all on function public.fabric_physical_color_check_record_v2(text,text,text,text,numeric,numeric,numeric,text,numeric,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.fabric_physical_color_check_list(integer) from public,anon,authenticated;
grant execute on function public.fabric_physical_color_check_record_v2(text,text,text,text,numeric,numeric,numeric,text,numeric,text,text,text,text,text) to service_role;
grant execute on function public.fabric_physical_color_check_list(integer) to service_role;
