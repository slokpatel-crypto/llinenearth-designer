-- Fabric Analyzer safety hardening:
-- any persisted re-analysis must return to human review instead of inheriting
-- an approval/correction status from an older model output with the same
-- physical/image fingerprint.

create or replace function public.fabric_analyzer_profile_upsert(
  p_image_fingerprint text,p_image_source text,p_declared_context jsonb,p_analyzer_version text,
  p_model_id text,p_profile jsonb,p_confidence jsonb
)
returns uuid language plpgsql security definer set search_path='public','private' as $$
declare v_id uuid;
begin
  insert into private.fabric_analysis_profiles(
    image_fingerprint,image_source,declared_context,analyzer_version,model_id,profile,confidence,review_status,review_notes,updated_at
  ) values(
    left(p_image_fingerprint,128),left(coalesce(p_image_source,''),1800),coalesce(p_declared_context,'{}'::jsonb),
    left(p_analyzer_version,80),left(p_model_id,120),coalesce(p_profile,'{}'::jsonb),coalesce(p_confidence,'{}'::jsonb),
    'unreviewed','',now()
  )
  on conflict(image_fingerprint,analyzer_version) do update set
    image_source=excluded.image_source,
    declared_context=excluded.declared_context,
    model_id=excluded.model_id,
    profile=excluded.profile,
    confidence=excluded.confidence,
    review_status='unreviewed',
    review_notes='',
    updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.fabric_analyzer_profile_upsert(text,text,jsonb,text,text,jsonb,jsonb)
is 'Persists a Fabric Analyzer run. Re-analysis always resets the profile to unreviewed so a prior human approval cannot silently carry over to changed model output.';
