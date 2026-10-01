-- Read-only Roadmap v2 evidence-schema health probe for deployment readiness.
-- This does not create evidence or mutate gates; it only confirms required hardened RPCs exist.

create or replace function public.roadmap_v2_evidence_health()
returns jsonb
language sql
security definer
set search_path='public','private'
as $$
  select jsonb_build_object(
    'noviceServerTimer', to_regprocedure('public.designer_novice_timer_start(text,text)') is not null
      and to_regprocedure('public.designer_novice_timer_finish(uuid)') is not null
      and to_regprocedure('public.designer_novice_attempt_record_v2(uuid,boolean,boolean,boolean,text)') is not null,
    'verifiedBetaFlow', to_regprocedure('public.launch_beta_attempt_record_v4(text,text,text,text,boolean,text)') is not null,
    'signedStyleHandoff', to_regprocedure('public.style_director_handoff_audit_record_v2(text,text,text,text,text)') is not null
      and to_regprocedure('public.style_director_user_test_record_v2(text,text,boolean,boolean,boolean,uuid,boolean,text)') is not null,
    'distinctStyleValidation', to_regprocedure('public.style_director_validation_signoff_record_v3(text,integer,text,text)') is not null,
    'renderManualReview', to_regprocedure('public.designer_render_manual_review_signoff_latest()') is not null,
    'measurementEvidence', to_regprocedure('public.measurement_calibration_case_list(integer)') is not null,
    'productionDeliveryEvidence', to_regprocedure('public.production_delivery_evidence_list(integer)') is not null
  );
$$;

revoke all on function public.roadmap_v2_evidence_health() from public,anon,authenticated;
grant execute on function public.roadmap_v2_evidence_health() to service_role;
