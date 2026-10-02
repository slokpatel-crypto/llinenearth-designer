-- Raw physical/pixel fixture evidence for final-render pattern calibration.
-- Legacy direct-mm rows remain readable but do not satisfy the hardened release gate.

alter table private.designer_render_pattern_calibration
  add column if not exists measurement_method text not null default 'legacy_direct_mm',
  add column if not exists reference_mm numeric(10,3),
  add column if not exists reference_px numeric(12,3),
  add column if not exists observed_repeat_px numeric(12,3);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='designer_render_pattern_calibration_method_check'
      and conrelid='private.designer_render_pattern_calibration'::regclass
  ) then
    alter table private.designer_render_pattern_calibration
      add constraint designer_render_pattern_calibration_method_check
      check (measurement_method in ('legacy_direct_mm','pixel_fixture_v2'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='designer_render_pattern_calibration_fixture_check'
      and conrelid='private.designer_render_pattern_calibration'::regclass
  ) then
    alter table private.designer_render_pattern_calibration
      add constraint designer_render_pattern_calibration_fixture_check
      check (
        measurement_method='legacy_direct_mm'
        or (
          reference_mm is not null and reference_mm>0 and reference_mm<=5000
          and reference_px is not null and reference_px>0 and reference_px<=20000
          and observed_repeat_px is not null and observed_repeat_px>0 and observed_repeat_px<=20000
        )
      );
  end if;
end;
$$;

create or replace function public.designer_render_pattern_calibration_record_v2(
  p_outcome_id uuid,
  p_garment text,
  p_expected_repeat_mm numeric,
  p_reference_mm numeric,
  p_reference_px numeric,
  p_observed_repeat_px numeric,
  p_axis_status text,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_id uuid;
  v_px_per_mm numeric;
  v_observed_repeat_mm numeric;
  v_error numeric;
begin
  if p_garment not in ('shirt','trouser') then raise exception 'invalid garment'; end if;
  if p_axis_status not in ('match','mismatch','not_applicable') then raise exception 'invalid axis status'; end if;
  if p_expected_repeat_mm is null or p_expected_repeat_mm<=0 or p_expected_repeat_mm>1000 then raise exception 'invalid expected repeat'; end if;
  if p_reference_mm is null or p_reference_mm<=0 or p_reference_mm>5000 then raise exception 'invalid physical reference'; end if;
  if p_reference_px is null or p_reference_px<=0 or p_reference_px>20000 then raise exception 'invalid pixel reference'; end if;
  if p_observed_repeat_px is null or p_observed_repeat_px<=0 or p_observed_repeat_px>20000 then raise exception 'invalid observed repeat pixels'; end if;
  if not exists(select 1 from private.designer_render_outcomes where outcome_id=p_outcome_id) then raise exception 'unknown render outcome'; end if;

  v_px_per_mm=p_reference_px/p_reference_mm;
  v_observed_repeat_mm=p_observed_repeat_px/v_px_per_mm;
  v_error=abs(v_observed_repeat_mm-p_expected_repeat_mm)/p_expected_repeat_mm*100;

  insert into private.designer_render_pattern_calibration(
    outcome_id,garment,expected_repeat_mm,observed_repeat_mm,scale_error_pct,axis_status,note,
    measurement_method,reference_mm,reference_px,observed_repeat_px
  ) values(
    p_outcome_id,p_garment,round(p_expected_repeat_mm,3),round(v_observed_repeat_mm,3),round(v_error,3),
    p_axis_status,left(coalesce(p_note,''),1000),
    'pixel_fixture_v2',round(p_reference_mm,3),round(p_reference_px,3),round(p_observed_repeat_px,3)
  )
  returning calibration_id into v_id;

  return v_id;
end;
$$;

create or replace function public.designer_render_pattern_calibration_list_v2(p_limit integer default 200)
returns table(
  calibration_id uuid,
  outcome_id uuid,
  garment text,
  expected_repeat_mm numeric,
  observed_repeat_mm numeric,
  scale_error_pct numeric,
  axis_status text,
  note text,
  measurement_method text,
  reference_mm numeric,
  reference_px numeric,
  observed_repeat_px numeric,
  created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select
    c.calibration_id,c.outcome_id,c.garment,c.expected_repeat_mm,c.observed_repeat_mm,
    c.scale_error_pct,c.axis_status,c.note,c.measurement_method,c.reference_mm,c.reference_px,
    c.observed_repeat_px,c.created_at
  from private.designer_render_pattern_calibration c
  order by c.created_at desc
  limit greatest(1,least(coalesce(p_limit,200),1000));
$$;

revoke all on function public.designer_render_pattern_calibration_record_v2(uuid,text,numeric,numeric,numeric,numeric,text,text)
  from public,anon,authenticated;
revoke all on function public.designer_render_pattern_calibration_list_v2(integer)
  from public,anon,authenticated;

grant execute on function public.designer_render_pattern_calibration_record_v2(uuid,text,numeric,numeric,numeric,numeric,text,text)
  to service_role;
grant execute on function public.designer_render_pattern_calibration_list_v2(integer)
  to service_role;
