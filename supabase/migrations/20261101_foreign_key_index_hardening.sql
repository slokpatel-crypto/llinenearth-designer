-- Supabase performance hardening.
-- Adds covering indexes for every foreign key currently reported by the
-- production database advisor as unindexed. Additive only; no data mutation.

create index if not exists fabric_analysis_bindings_profile_id_idx
  on private.fabric_analysis_bindings(profile_id);

create index if not exists fabric_analysis_feedback_profile_id_idx
  on private.fabric_analysis_feedback(profile_id);

create index if not exists fabric_analysis_jobs_profile_id_idx
  on private.fabric_analysis_jobs(profile_id);

create index if not exists fabric_analysis_profiles_analyzer_version_idx
  on private.fabric_analysis_profiles(analyzer_version);

create index if not exists fabric_analyzer_calibration_cases_last_profile_id_idx
  on private.fabric_analyzer_calibration_cases(last_profile_id);

create index if not exists fabric_analyzer_calibration_cases_source_id_idx
  on private.fabric_analyzer_calibration_cases(source_id);

create index if not exists fabric_color_reference_terms_source_id_idx
  on private.fabric_color_reference_terms(source_id);

create index if not exists fabric_material_reference_terms_source_id_idx
  on private.fabric_material_reference_terms(source_id);

create index if not exists fabric_pattern_reference_terms_source_id_idx
  on private.fabric_pattern_reference_terms(source_id);

create index if not exists fabric_reference_examples_source_id_idx
  on private.fabric_reference_examples(source_id);

create index if not exists house_ease_model_events_model_id_idx
  on private.house_ease_model_events(model_id);

create index if not exists production_orders_quote_id_idx
  on private.production_orders(quote_id);
