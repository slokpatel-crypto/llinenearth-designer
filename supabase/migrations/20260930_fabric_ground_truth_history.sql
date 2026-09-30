-- Backfill owner-labelled Fabric Analyzer evaluation from reviewed profile history.
-- Service-role only. Returns latest approved/corrected stock-bound profile plus
-- the ordered correction history needed to reconstruct what the Analyzer
-- originally showed before the operator changed it.

create or replace function public.fabric_analyzer_ground_truth_history(p_fabric_ids text[])
returns table(
  fabric_id text,
  profile_id uuid,
  analyzer_version text,
  review_status text,
  profile jsonb,
  feedback jsonb,
  reviewed_at timestamptz
)
language sql security definer set search_path='public','private' as $$
  with reviewed as (
    select
      b.fabric_id,
      p.id as profile_id,
      p.analyzer_version,
      p.review_status,
      p.profile,
      p.updated_at as reviewed_at,
      row_number() over(
        partition by b.fabric_id
        order by p.updated_at desc,p.id desc
      ) as rn
    from private.fabric_analysis_bindings b
    join private.fabric_analysis_profiles p on p.id=b.profile_id
    where b.fabric_id=any(p_fabric_ids)
      and p.review_status in ('approved','corrected')
  )
  select
    r.fabric_id,
    r.profile_id,
    r.analyzer_version,
    r.review_status,
    r.profile,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'fieldPath',f.field_path,
          'previousValue',f.previous_value,
          'correctedValue',f.corrected_value,
          'reason',f.reason,
          'at',f.created_at
        )
        order by f.created_at asc,f.id asc
      )
      from private.fabric_analysis_feedback f
      where f.profile_id=r.profile_id
    ),'[]'::jsonb) as feedback,
    r.reviewed_at
  from reviewed r
  where r.rn=1
  order by r.reviewed_at desc;
$$;

revoke all on function public.fabric_analyzer_ground_truth_history(text[]) from public,anon,authenticated;
grant execute on function public.fabric_analyzer_ground_truth_history(text[]) to service_role;

comment on function public.fabric_analyzer_ground_truth_history(text[])
is 'Returns latest reviewed stock-bound Fabric Analyzer profiles and ordered correction history for owner-labelled evaluation backfill.';
