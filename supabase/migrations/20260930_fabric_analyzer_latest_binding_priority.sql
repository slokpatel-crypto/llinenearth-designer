-- Fabric Analyzer evidence freshness hardening:
-- when a fabric is bound to a newer capture/profile, the newer evidence must
-- become the active Designer profile even if an older profile was approved.
-- Otherwise a newly captured unreviewed profile could be hidden forever behind
-- stale approved evidence and bypass the intended human re-review loop.

create or replace function public.fabric_analyzer_profiles_for_fabrics(
  p_fabric_ids text[],
  p_include_unreviewed boolean default true
)
returns table(
  fabric_id text,id uuid,image_fingerprint text,image_source text,declared_context jsonb,analyzer_version text,model_id text,
  profile jsonb,confidence jsonb,review_status text,review_notes text,created_at timestamptz,updated_at timestamptz
)
language sql security definer set search_path='public','private' as $$
  with ranked as (
    select b.fabric_id,p.id,p.image_fingerprint,p.image_source,p.declared_context,p.analyzer_version,p.model_id,
           p.profile,p.confidence,p.review_status,p.review_notes,p.created_at,p.updated_at,
           row_number() over(
             partition by b.fabric_id
             order by
               b.updated_at desc,
               p.updated_at desc,
               case p.review_status
                 when 'approved' then 4
                 when 'corrected' then 3
                 when 'unreviewed' then 2
                 else 1
               end desc,
               p.id desc
           ) as rn
    from private.fabric_analysis_bindings b
    join private.fabric_analysis_profiles p on p.id=b.profile_id
    where b.fabric_id=any(p_fabric_ids)
      and p.review_status<>'rejected'
      and (p_include_unreviewed or p.review_status in ('approved','corrected'))
  )
  select fabric_id,id,image_fingerprint,image_source,declared_context,analyzer_version,model_id,
         profile,confidence,review_status,review_notes,created_at,updated_at
  from ranked
  where rn=1;
$$;

comment on function public.fabric_analyzer_profiles_for_fabrics(text[],boolean)
is 'Returns the freshest bound non-rejected Analyzer profile per fabric. Binding/profile freshness outranks prior approval so new evidence cannot be hidden behind stale reviewed output.';
