import fs from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const live = process.argv.includes("--live");
let failed = false;

function ok(message) { console.log(`✓ ${message}`); }
function warn(message) { console.log(`! ${message}`); }
function fail(message) { console.error(`✗ ${message}`); failed = true; }

function requireFile(path) {
  if (!fs.existsSync(path)) return fail(`Missing release file: ${path}`);
  ok(`Found ${path}`);
}

function requireTokens(path, tokens) {
  if (!fs.existsSync(path)) return fail(`Missing release file: ${path}`);
  const content = fs.readFileSync(path, "utf8");
  for (const token of tokens) {
    if (!content.includes(token)) fail(`${path} is missing release contract: ${token}`);
  }
}

console.log(`Linen Earth release readiness${live ? " (live)" : " (static)"}\n`);

for (const path of [
  "src/app/page.tsx",
  "src/app/api/homepage-model/route.ts",
  "src/components/MeasurementStudio.tsx",
  "src/lib/designer/tailor-observations.ts",
  "src/app/measurements/page.tsx",
  "src/app/real-model/page.tsx",
  "public/designer/studio-tucked.webp",
  "src/lib/designer/photo-preview.ts",
  "src/lib/designer/photo-preview-support.ts",
  "src/lib/designer/block-strategy.ts",
  "src/lib/designer/fit-construction.ts",
  "src/lib/designer/house-ease-server.ts",
  "src/lib/designer/constraint-negotiation.ts",
  "src/lib/designer/outcome-learning.ts",
  "src/lib/designer/brand-language.ts",
  "src/components/PhotoOutfitPreview.tsx",
  "src/lib/designer/fit-outcomes.ts",
  "src/app/designer-studio/page.tsx",
  "src/lib/designer/search.ts",
  "src/lib/designer/evidence-context.ts",
  "src/app/api/designer/search/route.ts",
  "src/app/api/designer/brief/route.ts",
  "src/app/api/designer/look-render/route.ts",
  "src/app/api/designer/look-inspect/route.ts",
  "src/app/api/designer/look-download/route.ts",
  "src/lib/designer/brief.ts",
  "src/app/api/designer/casebook/route.ts",
  "src/app/api/designer/creative-inspect/route.ts",
  "src/app/api/designer/creative-generate/route.ts",
  "src/lib/designer/creative-context.ts",
  "src/app/api/operator/designer-research/discover/route.ts",
  "src/app/api/operator/designer-research/analyze/route.ts",
  "src/app/api/operator/designer-research/analyze-batch/route.ts",
  "src/lib/designer/research-source-discovery.ts",
  "src/lib/designer/research-source-analysis.ts",
  "src/lib/designer/casebook.ts",
  "src/lib/designer/garment-spec.ts",
  "desktop/src/App.tsx",
  "desktop/src-tauri/tauri.conf.json",
  ".github/workflows/build-linen-earth-os.yml",
  "supabase/migrations/20260920_style_events_hardening.sql",
  ".env.example",
  "package-lock.json",
  "AGENTS.md",
  "DECISIONS.md",
  // A passing static release check is NOT human deployment readiness.
  // Keep the measurable gate and exact-head checkpoint discoverable.
  "docs/TITAN_RELEASE_CHECKLIST.md",
  "docs/TITAN_RELEASE_CHECKPOINT.md",
  "docs/ARCHITECTURE_AUDIT.md",
  "src/app/lab/proof/page.tsx",
  "src/components/PremiumShirtProof.tsx",
  "src/lib/designer/proof-scale.ts",
  "src/lib/designer/design-lock.ts",
  "src/lib/designer/design-share.ts",
  "src/lib/designer/design-vault.ts",
  "src/lib/measurement-vault.ts",
  "src/lib/customer-account.ts",
  "src/lib/customer-auth.ts",
  "src/lib/customer-session-token.ts",
  "src/lib/customer-session.ts",
  "src/app/account/page.tsx",
  "src/app/api/customer-auth/otp/route.ts",
  "src/app/api/customer-auth/verify/route.ts",
  "src/app/api/customer-auth/session/route.ts",
  "src/app/api/customer-auth/logout/route.ts",
  "supabase/migrations/20261006_customer_account_ownership.sql",
  "src/app/api/customer-account/production/route.ts",
  "supabase/migrations/20261007_production_customer_ownership.sql",
  "supabase/migrations/20261013_customer_quote_acceptance.sql",
  "supabase/migrations/20261014_customer_production_timeline.sql",
  "supabase/migrations/20261015_customer_production_outcomes.sql",
  "src/lib/designer/customer-production-outcomes.ts",
  "tests/customer-production-outcomes.test.ts",
  "supabase/migrations/20261016_customer_outcome_learning_policy.sql",
  "src/lib/designer/customer-outcome-learning.ts",
  "tests/customer-outcome-learning.test.ts",
  "src/app/api/operator/customer-outcomes/route.ts",
  "src/app/operator/customer-outcomes/page.tsx",
  "src/app/operator/customer-outcomes/CustomerOutcomesClient.tsx",
  "supabase/migrations/20261017_production_learning_context.sql",
  "src/lib/designer/production-learning-context.ts",
  "tests/production-learning-context.test.ts",
  "src/lib/fabric-color-calibration.ts",
  "src/app/api/operator/fabric-color-calibration/route.ts",
  "src/app/operator/fabric-color-calibration/page.tsx",
  "src/app/operator/fabric-color-calibration/FabricColorCalibrationClient.tsx",
  "supabase/migrations/20261008_fabric_physical_color_checks.sql",
  "supabase/migrations/20261031_fabric_color_evidence_provenance.sql",
  "src/lib/designer/style-director-validation.ts",
  "src/lib/designer/style-director-handoff.ts",
  "src/app/api/style-director/handoff/route.ts",
  "src/app/api/operator/style-director-validation/route.ts",
  "src/app/operator/style-director-validation/page.tsx",
  "src/app/operator/style-director-validation/StyleDirectorValidationClient.tsx",
  "supabase/migrations/20261009_style_director_user_validation.sql",
  "src/lib/designer/ease-calibration.ts",
  "src/lib/designer/preview-option-coverage.ts",
  "src/lib/designer/measurement-calibration.ts",
  "src/app/api/operator/measurement-calibration/route.ts",
  "src/app/operator/measurement-calibration/page.tsx",
  "src/app/operator/measurement-calibration/MeasurementCalibrationClient.tsx",
  "tests/measurement-calibration.test.ts",
  "src/lib/designer/novice-designer-study.ts",
  "src/app/api/operator/novice-designer-study/route.ts",
  "src/app/operator/novice-designer-study/page.tsx",
  "src/app/operator/novice-designer-study/NoviceDesignerStudyClient.tsx",
  "supabase/migrations/20261012_designer_novice_study.sql",
  "supabase/migrations/20261019_novice_server_timing.sql",
  "supabase/migrations/20261020_verified_beta_share_flow.sql",
  "supabase/migrations/20261021_style_director_validation_threshold.sql",
  "supabase/migrations/20261022_style_director_handoff_audit.sql",
  "supabase/migrations/20261023_style_director_handoff_validation.sql",
  "supabase/migrations/20261024_style_director_distinct_handoff_gate.sql",
  "supabase/migrations/20261027_roadmap_v2_evidence_health.sql",
  "supabase/migrations/20261028_verified_meterage_cut_evidence.sql",
  "supabase/migrations/20261029_meterage_cut_provenance_gate.sql",
  "supabase/migrations/20261030_production_cut_evidence_registry.sql",
  "supabase/migrations/20261024_style_director_handoff_uniqueness.sql",
  "supabase/migrations/20261024_measurement_accuracy_evidence.sql",
  "supabase/migrations/20261026_style_director_verified_signoff.sql",
  "src/lib/designer/preview-option-reviews.ts",
  "tests/photo-preview-support.test.ts",
  "src/app/api/operator/preview-option-coverage/route.ts",
  "src/app/operator/preview-option-coverage/page.tsx",
  "src/app/operator/preview-option-coverage/PreviewOptionCoverageClient.tsx",
  "src/app/api/operator/ease-calibration/route.ts",
  "src/app/operator/ease-calibration/page.tsx",
  "src/app/operator/ease-calibration/EaseCalibrationClient.tsx",
  "supabase/migrations/20261010_house_ease_calibration_registry.sql",
  "supabase/migrations/20261011_launch_beta_flow_detail.sql",
  "src/lib/designer/production-handoff.ts",
  "src/lib/designer/tech-pack.ts",
  "src/lib/designer/production-quote.ts",
  "src/lib/designer/production-state.ts",
  "src/lib/designer/production-packet.ts",
  "src/lib/designer/stock-ledger.ts",
  "src/lib/designer/stock-availability.ts",
  "src/lib/designer/stock-availability-server.ts",
  "src/lib/designer/catalog-stock-server.ts",
  "src/lib/garment-viewer-model-contract.ts",
  "src/lib/garment-viewer-model-server.ts",
  "src/lib/garment-viewer-glb.ts",
  "src/lib/garment-viewer-readiness.ts",
  "src/lib/garment-viewer-evidence-server.ts",
  "src/components/GarmentViewer.tsx",
  "src/app/lab/garment-viewer/page.tsx",
  "src/app/api/operator/garment-viewer/route.ts",
  "src/app/operator/garment-viewer/page.tsx",
  "tests/stock-availability.test.ts",
  "src/app/recover-design/page.tsx",
  "src/app/operator/stock/page.tsx",
  "src/app/operator/production/page.tsx",
  "src/app/operator/garment-qc/page.tsx",
  "src/lib/designer/finished-garment-qc.ts",
  "supabase/migrations/20261002_finished_garment_qc.sql",
  "supabase/migrations/20261027_finished_garment_qc_provenance.sql",
  "src/app/operator/production-evidence/page.tsx",
  "src/lib/designer/production-delivery-evidence.ts",
  "supabase/migrations/20261003_production_delivery_evidence.sql",
  "supabase/migrations/20261026_production_delivery_evidence_provenance.sql",
  "supabase/migrations/20261103_production_first_ten_delivery_audit.sql",
  "supabase/migrations/20261104_production_zero_reentry_consistency.sql",
  "supabase/migrations/20261105_production_reentry_field_vocabulary.sql",
  "src/app/operator/meterage-model/page.tsx",
  "src/lib/designer/meterage-calibration.ts",
  "supabase/migrations/20261004_meterage_calibration_registry.sql",
  "src/app/operator/launch-readiness/page.tsx",
  "src/lib/designer/roadmap-readiness.ts",
  "src/lib/designer/roadmap-backend-health.ts",
  "src/lib/designer/production-runtime-health.ts",
  "src/app/api/operator/production-runtime-health/route.ts",
  "tests/production-runtime-health.test.ts",
  "src/lib/designer/evidence-sprint.ts",
  "src/app/operator/evidence-sprint/page.tsx",
  "src/app/operator/evidence-sprint/EvidenceSprintClient.tsx",
  "src/app/operator/evidence-sprint/evidence-sprint.css",
  "tests/evidence-sprint.test.ts",
  "src/app/api/operator/roadmap-backend-health/route.ts",
  "tests/roadmap-backend-health.test.ts",
  "tests/customer-designer-preview.test.ts",
  "tests/vercel-deployment-policy.test.ts",
  "src/lib/designer/fabric-truth-policy.ts",
  "src/app/api/operator/fabric-truth-policy/route.ts",
  "src/app/operator/fabric-truth-policy/page.tsx",
  "src/app/operator/fabric-truth-policy/FabricTruthPolicyClient.tsx",
  "src/app/operator/fabric-truth-policy/fabric-truth-policy.css",
  "tests/fabric-truth-policy.test.ts",
  "src/app/operator/roadmap-readiness/page.tsx",
  "src/app/operator/roadmap-readiness/RoadmapReadinessClient.tsx",
  "src/app/operator/roadmap-readiness/roadmap-readiness.css",
  "tests/roadmap-readiness.test.ts",
  "src/lib/designer/launch-readiness-evidence.ts",
  "supabase/migrations/20261005_launch_readiness_evidence.sql",
  "src/app/operator/production-calibration/page.tsx",
  "supabase/migrations/20261001_designer_locked_revision_vault.sql",
  "supabase/migrations/20261001_measurement_profile_vault.sql",
  "supabase/migrations/20261001_fabric_stock_ledger.sql",
  "supabase/migrations/20261028_fabric_stock_provenance.sql",
  "supabase/migrations/20261029_stock_reservation_provenance.sql",
  "supabase/migrations/20261030_stock_consumption_provenance.sql",
  "supabase/migrations/20261031_stock_reservation_concurrency_provenance.sql",
  "supabase/migrations/20261101_foreign_key_index_hardening.sql",
  "supabase/migrations/20261102_private_schema_deny_by_default.sql",
  "supabase/migrations/20261001_production_quotes_orders.sql",
  "supabase/migrations/20261001_render_outcomes.sql",
  "src/lib/designer/render-outcomes.ts",
  "src/lib/designer/render-outcome-metrics.ts",
  "src/app/operator/render-qa/page.tsx",
  "src/lib/designer/render-release-evidence.ts",
  "supabase/migrations/20261007_render_release_evidence.sql",
  "supabase/migrations/20261018_render_pattern_fixture_evidence.sql",
  "supabase/migrations/20261023_render_manual_review_signoff.sql",
]) requireFile(path);

requireTokens("src/app/page.tsx", ["/designer/studio-tucked.webp", "/style-director", "/designer-studio", "/real-model", "Open Real Model Designer"]);
requireTokens("src/lib/designer/proof-scale.ts", ["evaluateRecordedPhase1ProofEvidence","summarizeLatencySamples","realModelSampleDurationsMs","phase1BoundaryChecksReady","boundaryReady","validateVerifiedPhysicalEvidence","physicalEvidenceReady","PHASE1_PROOF_EVIDENCE_VERSION","PHASE1_PROOF_PHOTO_COORDINATE_SYSTEM","summarizeIndependentRealism","PHASE1_PROOF_MIN_REALISM_VIEWERS","PHASE1_PROOF_MIN_STRONG_REALISM","phase1ProofAcceptance"]);
requireTokens("src/components/PremiumShirtProof.tsx", ["linen-earth-phase1-proof-v4","Anonymous viewer code","boundaryChecks","Garment boundary review","realismAssessments","uniqueRealismViewers","physicalEvidenceNote","WAITING FOR PROVENANCE","photoReferenceMm","photoReferencePx","pxPerMmFromMarker","photo-1024x1536-fixture"]);
requireTokens("src/app/operator/phase10-readiness/Phase10ReadinessClient.tsx", ["proofBoundaries","proofMobileAccepted","target-mobile acceptance","garment boundaries","mobile ${proofMobileAccepted?"]);
requireTokens("src/app/api/operator/phase1-proof/route.ts", ["loadLatestPhase1ProofRecord","coreAccepted","boundaryReady","boundaryChecks","physicalEvidenceReady","physicalEvidenceNote","uniqueRealismViewers","photoReferenceMm","photoReferencePx","photoPxPerMm","scaleCoordinateSystem"]);
requireTokens("src/lib/designer/phase1-proof-server.ts", ['import "server-only"',"loadLatestPhase1ProofRecord","evaluateRecordedPhase1ProofEvidence","roadmap_phase1_proof","cache:\"no-store\""]);
requireTokens("src/lib/designer/photo-calibration-types.ts", ["CustomerPhotoCalibration","UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION","photo-1024x1536-fixture","linen-earth-phase1-proof-v4"]);
requireTokens("src/lib/designer/photo-calibration.ts", ["customerPhotoCalibrationFromProofPayload","coreAccepted===true","scaleGatePass===true","physicalEvidenceReady===true","boundaryReady===true","PHASE1_PROOF_PHOTO_COORDINATE_SYSTEM"]);
requireTokens("src/app/api/designer/photo-calibration/route.ts", ["customerPhotoCalibrationFromProofPayload","loadLatestPhase1ProofRecord","cache-control","no-store","x-content-type-options"]);
requireTokens("src/lib/designer/photo-calibration-client.ts", ["/api/designer/photo-calibration","customerPhotoCalibrationIdentity","fetchCustomerPhotoCalibration",'.finally(()=>{customerPhotoCalibrationRequest=null;})',"photo-1024x1536-fixture","linen-earth-phase1-proof-v4"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["UNVERIFIED_CUSTOMER_PHOTO_CALIBRATION","resolvedPhotoPxPerMm","verifiedPhotoPxPerMm","photoScaleReady","accepted studio calibration","customerPhotoCalibrationIdentity","fetchCustomerPhotoCalibration"]);
requireTokens("tests/photo-calibration.test.ts", ["accepted Phase 1 proof publishes only the safe photo calibration","public photo-calibration route exposes no operator proof notes or viewer data"]);
requireTokens("src/lib/designer/photo-calibration-client.ts", ['.finally(()=>{customerPhotoCalibrationRequest=null;})']);
requireTokens("src/components/PhotoOutfitPreview.tsx", ['window.addEventListener("focus",refresh)','document.addEventListener("visibilitychange",onVisibility)','document.visibilityState==="visible"']);
requireTokens("tests/photo-calibration.test.ts", ["customer preview refreshes proof-backed calibration after returning to the tab"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["photoCalibration:photoCalibration.verified ? {","photoPxPerMm:verifiedPhotoPxPerMm","scaleCoordinateSystem:photoCalibration.scaleCoordinateSystem","proofVersion:photoCalibration.proofVersion","} : {verified:false}","selectedLookSessionCache.get(renderSignature)"]);
requireTokens("tests/photo-calibration.test.ts", ["changing proof-backed calibration invalidates the locked final render signature"]);
requireTokens("src/app/api/memory/event/route.ts", ["linen-earth-phase1-proof-v4","boundaryChecks","boundaryReady","realModelSampleDurationsMs","photoReferenceMm","photoReferencePx","realismAssessments","uniqueRealismViewers"]);
requireTokens("src/app/api/memory/event/route.ts", ["designer-device-qa-v2","sampleDurationsMs","hardwareConcurrency","checks"]);
requireTokens("src/app/api/operator/device-qa/route.ts", ["evaluateDeviceQaEvidence","performancePass","visualPass","evidenceVersion"]);
requireTokens("src/app/operator/device-qa/DeviceQaClient.tsx", ["DEVICE_QA_EVIDENCE_VERSION","readPreviewPerformanceSamples","sampleDurationsMs"]);
requireTokens("src/lib/designer/device-qa-evidence.ts", ["DEVICE_QA_EVIDENCE_VERSION","DEVICE_QA_MIN_SAMPLES","DEVICE_QA_TARGET_P95_MS","evaluateDeviceQaEvidence","sampleDurationsMs"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["PhotoPreviewCalibration","photoPxPerMm","photoFabricPatternScale"]);
requireTokens("src/lib/designer/live-preview.ts", ["photoFabricPatternScale","photoExpectedRepeatPx","photoPxPerMm"]);
requireTokens("src/lib/fabric-intelligence-evidence.ts", ["intelligence.trust!==\"reviewed\"","auditablePhysicalSource","evidenceNote","fieldProvenance","measured.pattern.physicalScale","verifiedPhysical.gsm","verifiedPhysical.drape","verifiedPhysical.fiberContent","patternScaleVerified","fiberContentVerified"]);
requireTokens("src/lib/fabric-intelligence-server.ts", ["fieldProvenance:{...profile.provenanceByField}"]);
requireTokens("src/lib/fabric-intelligence-types.ts", ["evidenceNote:string|null","fieldProvenance?:Record<string"]);
requireTokens("src/lib/fabric-intelligence-adapter.ts", ["evidenceNote:string|null","evidenceNote:str(obj(root.verifiedPhysical).evidenceNote"]);
requireTokens("src/lib/fabric-analyzer.ts", ["verifiedPhysicalEvidenceNote","evidenceNote:safeText(input.verifiedPhysicalEvidenceNote"]);
requireTokens("src/app/operator/fabric-analyzer/FabricAnalyzerClient.tsx", ["verifiedPhysical?.sourceUrl","verifiedPhysical?.evidenceNote","VERIFIED PHYSICAL"]);
requireTokens("src/app/api/operator/designer-data/route.ts", ["analyzerPhysicalProvenance","evidenceNote","physicalField(\"measured.pattern.physicalScale\")"]);
requireTokens("src/app/operator/designer-data/DesignerDataClient.tsx", ["Physical evidence provenance","physicalEvidence:editor.physicalEvidence","physical_roll","supplier_document","owner_measurement"]);
requireTokens("src/app/operator/designer-data/DesignerDataBatchPanel.tsx", ["physicalSourceType","physicalReference","physicalCheckedBy","physicalEvidence:incomingPhysicalEvidence??current.physicalEvidence"]);
requireTokens("src/app/api/memory/event/route.ts", ["designer_fabric_metadata","normalizeFabricPhysicalEvidenceProvenance","physicalEvidence"]);
requireTokens("src/lib/designer/measurement-calibration.ts", ["MEASUREMENT_CALIBRATION_TARGET_CASES","MEASUREMENT_CHEST_MEDIAN_TARGET_CM","MEASUREMENT_SLEEVE_MEDIAN_TARGET_CM","normalizeMeasurementCalibrationDraft","summarizeMeasurementCalibration"]);
requireTokens("src/app/api/operator/measurement-calibration/route.ts", ["verifyOperatorSession","measurement_calibration_case_list","measurement_calibration_case_record","p_evidence_source","p_checked_by"]);
requireTokens("src/app/operator/measurement-calibration/MeasurementCalibrationClient.tsx", ["Physical comparison source","Checked by","/api/operator/measurement-calibration","Record comparison"]);
requireTokens("supabase/migrations/20261024_measurement_accuracy_evidence.sql", ["measurement_calibration_cases","measurement_calibration_case_record","measurement_calibration_case_list","physical comparison evidence source is required","service_role"]);
requireTokens("src/lib/designer/novice-designer-study.ts", ["timing_session_id","serverTimedLikedCases","evidenceReady:serverTimed.length>=5"]);
requireTokens("src/app/api/operator/novice-designer-study/route.ts", ["start_timer","finish_timer","record_timed_attempt","designer_novice_attempt_record_v2"]);
requireTokens("src/app/operator/novice-designer-study/NoviceDesignerStudyClient.tsx", ["Start server stopwatch","Stop stopwatch","record_timed_attempt","Server timer"]);
requireTokens("supabase/migrations/20261019_novice_server_timing.sql", ["designer_novice_timer_start","designer_novice_timer_finish","designer_novice_attempt_record_v2","five server-timed novice liked-design completions"]);
requireTokens("src/app/account/page.tsx", ["Email sign in","listOwned","recovery token","Measurement profiles","Accept quote","accept_quote","Timeline","orderEvents","record_outcome","post-delivery feedback","does not automatically change Designer recommendations"]);
requireTokens("src/lib/customer-auth.ts", ["SUPABASE_ANON_KEY","/auth/v1/otp","/auth/v1/verify","/auth/v1/user","CUSTOMER_SESSION_COOKIE"]);
requireTokens("src/lib/customer-session-token.ts", ["CUSTOMER_SESSION_MAX_AGE_SECONDS","createCustomerSessionToken","verifyCustomerSessionToken","timingSafeEqual"]);
requireTokens("src/app/api/customer-auth/verify/route.ts", ["createSignedCustomerSession","CUSTOMER_SESSION_COOKIE","Customer session signing is not configured"]);
requireTokens("src/app/api/customer-auth/logout/route.ts", ["CUSTOMER_SESSION_COOKIE","CUSTOMER_ACCESS_COOKIE","CUSTOMER_REFRESH_COOKIE"]);
requireTokens("src/app/api/designer/vault/route.ts", ["getCustomerIdentity","listOwned","loadOwned","deleteOwned","action===\"claim\""]);
requireTokens("src/app/api/measurements/vault/route.ts", ["getCustomerIdentity","listOwned","loadOwned","deleteOwned","action===\"claim\"","validStoredMeasurementProfile","validStoredTailorObservationProfile"]);
requireTokens("supabase/migrations/20261006_customer_account_ownership.sql", ["owner_user_id","auth.users","designer_locked_revision_vault_list_owned","measurement_profile_vault_list_owned","service_role"]);
requireTokens("src/app/api/customer-account/production/route.ts", ["getCustomerIdentity","production_quote_list_owned_v2","production_order_list_owned","production_order_event_list_owned","production_customer_outcome_list_owned","outcomes","production_quote_accept_owned","accept_quote","record_outcome","normalizeCustomerProductionOutcome","private, no-store"]);
requireTokens("supabase/migrations/20261007_production_customer_ownership.sql", ["resolve_locked_revision_owner","production_claim_revision_ownership","production_quote_list_owned","production_order_list_owned","owner_user_id"]);
requireTokens("supabase/migrations/20261013_customer_quote_acceptance.sql", ["production_quote_accept_owned","production_quote_list_owned_v2","customer_account","service_role"]);
requireTokens("supabase/migrations/20261014_customer_production_timeline.sql", ["production_order_event_list_owned","production_order_events","owner_user_id","service_role"]);
requireTokens("supabase/migrations/20261015_customer_production_outcomes.sql", ["production_customer_outcomes","production_customer_outcome_record","production_customer_outcome_list_owned","production_customer_outcome_list","customer outcome requires a delivered order","service_role"]);
requireTokens("src/lib/designer/customer-production-outcomes.ts", ["CUSTOMER_OUTCOME_RATINGS","CUSTOMER_FIT_RESULTS","normalizeCustomerProductionOutcome","Confirm the garment was worn"]);
requireTokens("supabase/migrations/20261016_customer_outcome_learning_policy.sql", ["production_customer_outcome_reviews","production_customer_outcome_policies","production_customer_outcome_review_record","production_customer_outcome_policy_record","named policy approver is required","service_role"]);
requireTokens("supabase/migrations/20261017_production_learning_context.sql", ["production_order_learning_context","production_order_create_with_context","production_customer_outcome_learning_list","durable production design context is required before evidence approval","prohibited personal measurement data","service_role"]);
requireTokens("src/lib/designer/production-learning-context.ts", ["PRODUCTION_LEARNING_CONTEXT_VERSION","buildProductionLearningContext","shirtId","trouserId"]);
requireTokens("src/lib/designer/customer-outcome-learning.ts", ["PRODUCTION_LEARNING_CONTEXT_VERSION","validOutcomeLearningContext","revisionId","recipeHash","shirtId","trouserId","summarizeCustomerOutcomeLearning","learningEligible","gateComplete"]);
requireTokens("src/app/api/operator/customer-outcomes/route.ts", ["verifyOperatorSession","production_customer_outcome_learning_list","production_customer_outcome_review_record","production_customer_outcome_policy_record","summarizeCustomerOutcomeLearning"]);
requireTokens("src/app/operator/customer-outcomes/CustomerOutcomesClient.tsx", ["Customer Outcome Review","Human evidence threshold","LEARNING ELIGIBLE","Durable design context","cannot be approved as learning evidence","Designer ranking remains unchanged"]);
requireTokens("src/lib/fabric-color-calibration.ts", ["deltaE2000","checkedBy","evidenceReference","legacyUnverified","evidenceGateComplete","calibrated_capture","spectrophotometer"]);
requireTokens("src/app/api/operator/fabric-color-calibration/route.ts", ["verifyOperatorSession","loadFabricAnalysesForFabricIds","approved","corrected","Digital colour reference must match","fabric_physical_color_check_record_v2","p_checked_by","p_evidence_reference","summarizeFabricPhysicalColorChecks"]);
requireTokens("src/app/operator/fabric-color-calibration/FabricColorCalibrationClient.tsx", ["Physical Colour Calibration","MEDIAN ΔE","legacy/unproven","Checked by","Evidence reference","reviewed profile required","Save append-only colour evidence"]);
requireTokens("supabase/migrations/20261008_fabric_physical_color_checks.sql", ["fabric_physical_color_checks","fabric_physical_color_check_record","fabric_physical_color_check_list","service_role"]);
requireTokens("supabase/migrations/20261031_fabric_color_evidence_provenance.sql", ["checked_by","evidence_reference","fabric_physical_color_check_record_v2","reviewed Analyzer profile id is required","controlled illuminant is required","service_role"]);
requireTokens("src/lib/designer/style-director-validation.ts", ["directionsUnderstandable","directionsDistinct","stockHandoffWorked","handoffAuditId","verifiedHandoffCases","uniqueVerifiedHandoffs","requiredPositiveCases","thresholdMet","validationComplete"]);
requireTokens("src/app/api/operator/style-director-validation/route.ts", ["style_director_user_test_record_v2","p_handoff_audit_id","style_director_validation_signoff_record_v3","p_required_positive_cases","verifyOperatorSession"]);
requireTokens("src/app/operator/style-director-validation/StyleDirectorValidationClient.tsx", ["Style Director Validation","materially distinct","Verified handoff audit ID","server audit exists","Documented clean-case target","No default is invented","Record user-test evidence","Record approved"]);
requireTokens("supabase/migrations/20261009_style_director_user_validation.sql", ["style_director_user_tests","style_director_validation_signoffs","record real-user validation evidence before sign-off","service_role"]);
requireTokens("supabase/migrations/20261021_style_director_validation_threshold.sql", ["required_positive_cases","style_director_validation_signoff_record_v2","positive Style Director cases do not meet the documented approval target","service_role"]);
requireTokens("src/lib/designer/style-director-handoff.ts", ["linen-earth-style-director-handoff-v2","createStyleDirectorHandoffToken","verifyStyleDirectorHandoffToken","styleDirectorHandoffMatches","styleSpec:StyleSpecV2"]);
requireTokens("src/app/api/style-director/route.ts", ["createStyleDirectorHandoffToken","handoffToken"]);
requireTokens("src/app/style-director/page.tsx", ["handoffToken:selectedLook.handoffToken","from:\"style-director\""]);
requireTokens("src/app/api/style-director/handoff/route.ts", ["verifyStyleDirectorHandoffToken","styleDirectorHandoffMatches","createHash","style_director_handoff_audit_record_v2","p_token_fingerprint"]);
requireTokens("src/components/DesignerModule.tsx", ["handoffToken","/api/style-director/handoff","VERIFIED HANDOFF","directorHandoffAuditId"]);
requireTokens("supabase/migrations/20261022_style_director_handoff_audit.sql", ["style_director_handoff_audit","style_director_handoff_audit_record","service_role"]);
requireTokens("supabase/migrations/20261023_style_director_handoff_validation.sql", ["handoff_audit_id","style_director_user_test_record_v2","verified handoff audit id is required","service_role"]);
requireTokens("supabase/migrations/20261024_style_director_distinct_handoff_gate.sql", ["style_director_validation_signoff_record_v3","distinct handoff_audit_id","distinct verified Style Director handoffs","service_role"]);
requireTokens("supabase/migrations/20261027_roadmap_v2_evidence_health.sql", ["roadmap_v2_evidence_health","noviceServerTimer","verifiedBetaFlow","signedStyleHandoff","distinctStyleValidation","renderManualReview","measurementEvidence","productionDeliveryEvidence","stockProvenance","garmentQcProvenance","deliveryProvenance","outcomeLearningContext","productionCutEvidence","verifiedMeterageCuts","service_role"]);
requireTokens("supabase/migrations/20261102_private_schema_deny_by_default.sql", ["revoke all privileges on schema private","revoke all privileges on all tables in schema private","revoke all privileges on all functions in schema private","alter default privileges for role postgres in schema private","privateSchemaDenyByDefault","has_schema_privilege('anon','private','USAGE')"]);
requireTokens("supabase/migrations/20261024_style_director_handoff_uniqueness.sql", ["token_fingerprint","style_director_handoff_audit_record_v2","style_director_user_tests_handoff_unique","service_role"]);
requireTokens("supabase/migrations/20261026_style_director_verified_signoff.sql", ["count(distinct l.handoff_audit_id)","join private.style_director_handoff_audit","verified positive Style Director cases","service_role"]);
requireTokens("src/lib/designer/ease-calibration.ts", ["requiredEaseEvidenceKeys","evidenceCoverageComplete","normalizeHouseEaseCalibrationDraft","SHIRT_EASE_CLASSES","TROUSER_EASE_CLASSES"]);
requireTokens("src/lib/designer/preview-option-coverage.ts", ["fullyCleared","constructionBlocked","noPreviewSupport","gateComplete"]);
requireTokens("src/lib/designer/novice-designer-study.ts", ["durationSeconds","likedDesignCompleted","targetSeconds","withinTargetCases","gateComplete"]);
requireTokens("src/app/api/operator/novice-designer-study/route.ts", ["designer_novice_attempt_record","designer_novice_study_decision_record","verifyOperatorSession"]);
requireTokens("src/app/operator/novice-designer-study/NoviceDesignerStudyClient.tsx", ["Novice Designer Completion Study","documented roadmap target","Start server stopwatch","Record server-timed attempt","Approve five-case gate"]);
requireTokens("supabase/migrations/20261012_designer_novice_study.sql", ["designer_novice_attempts","designer_novice_study_decisions","five novice liked-design completions within the documented target","service_role"]);
requireTokens("src/lib/designer/preview-option-reviews.ts", ["DESIGNER_STYLE_CHOICES","designer_preview_option_review","customerPreviewCoverageRows","constructionStatus","photoPreviewSupportForChoice","supportReason:photographicSupport.reason","livePreview:photographicSupport.status"]);
requireTokens("src/app/api/operator/preview-option-coverage/route.ts", ["verifyOperatorSession","customerPreviewCoverageRows","summarizePreviewOptionCoverage"]);
requireTokens("src/app/operator/preview-option-coverage/PreviewOptionCoverageClient.tsx", ["Customer Preview Coverage","Approve customer preview","Reject preview support","Approximate","Photographic support truth","supportReason"]);
requireTokens("src/app/api/operator/ease-calibration/route.ts", ["house_ease_evidence_record","house_ease_model_create","house_ease_model_approve","evidenceCoverageComplete"]);
requireTokens("src/app/operator/ease-calibration/EaseCalibrationClient.tsx", ["House Ease Calibration","35 cells","active in Designer runtime","controlled promotion step","Register evidence-backed draft"]);
requireTokens("supabase/migrations/20261010_house_ease_calibration_registry.sql", ["house_ease_evidence","house_ease_models","real finished-garment evidence is required for every house-ease cell","service_role"]);
requireTokens("supabase/migrations/20261011_launch_beta_flow_detail.sql", ["design_locked","share_or_enquiry_completed","launch_beta_attempt_record_v2","share/enquiry completion cannot precede a locked design"]);
requireTokens("src/app/api/operator/launch-readiness/route.ts", ["record_verified_beta","launch_beta_attempt_record_v4","verifiedFlowAudit","p_evidence_kind"]);

requireTokens("src/lib/designer/launch-readiness-transport.ts", [
  "safeLaunchReadinessRows", "BETA_STRING_LIMITS", "CHECKLIST_STRING_LIMITS",
  "source.length>500", "Invalid operator launch evidence boolean.",
]);
requireTokens("src/app/api/operator/launch-readiness/route.ts", [
  "return respond({error:\"Unauthorized.\"},401)",
  "return respond({configured:false,betaAttempts:[],checklistEvents:[]})",
  "readBoundedJsonResponse(response,maxBytes)",
  'safeLaunchReadinessRows(rawBeta,"beta")',
  'safeLaunchReadinessRows(rawChecklist,"checklist")',
]);
requireTokens("scripts/verify-launch-readiness-private-http.cjs", [
  "signed synthetic operator", "privateHeaders(r)",
  "DO-NOT-LEAK-CI-", "LAUNCH_LISTS",
]);
requireTokens(".github/workflows/ci.yml", [
  "node scripts/verify-launch-readiness-private-http.cjs",
]);

requireTokens("src/app/operator/launch-readiness/LaunchReadinessClient.tsx", ["LOCK → VERIFIED SHARE/ENQUIRY","record_verified_beta","Verified action","share_audit_confirmed","enquiry_audit_confirmed"]);
requireTokens("src/app/api/designer/share/route.ts", ["design_share_audit_record","p_revision_id:verified.revisionId","audited"]);
requireTokens("src/app/api/designer/enquiry/route.ts", ["verifyLockedDesignRevision","design_enquiry_audit_record","Locked Designer look","audited"]);
requireTokens("scripts/verify-enquiry-prepared-not-sent-http.cjs", [
  "127.0.0.1", 'new URL("/api/designer/enquiry",base)',
  'assert.equal(data.audited,false', 'assert.equal(data.auditId,null',
  'assert.equal(data.ownerVerified,false', 'assert.equal(data.operatorReceived,false',
  'assert.equal(data.status,"whatsapp_draft")',
  'assert.equal(data.handoffStatus,"prepared_not_sent")',
  'assert.equal(url.hostname,"wa.me"', 'assert.equal(tampered.status,409',
  'assert.equal(token.status,400', 'await prepared(revision,',
]);
requireTokens(".github/workflows/ci.yml", [
  "node scripts/verify-enquiry-prepared-not-sent-http.cjs",
]);

requireTokens("src/components/DesignerModule.tsx", ["verified share audit recorded","checked={shareConsent}"]);
requireTokens("supabase/migrations/20261020_verified_beta_share_flow.sql", ["design_share_audit","design_enquiry_audit","launch_beta_attempt_record_v4","share_audit_confirmed","enquiry_audit_confirmed","no verified % audit exists for this locked revision"]);
requireTokens("src/lib/designer/launch-readiness-evidence.ts", ["normalizeVerifiedBetaAttempt","evidenceKind","row.design_locked===true","row.share_or_enquiry_completed===true","row.enquiry_audit_confirmed===true","distinctVerifiedRevisions","uniqueSuccessfulByRevision"]);
requireTokens("src/lib/designer/block-strategy.ts", ["block-strategy-provisional-1","assessBlockStrategy","shaped-shirt","roomy-seat-block","suggestedPatch"]);
requireTokens("src/lib/designer/planner.ts", ["DesignerBlockStrategy","blockStrategy:selectedBlock","item.blockStrategy?.score"]);
requireTokens("src/lib/designer/search.ts", ["blockStrategy: DesignerBlockStrategy","assessBlockStrategy","block.score"]);
requireTokens("src/components/DesignerModule.tsx", ["blockStrategy=assessment?.blockStrategy","Starting block:","newDesignerTechnicalDrawer","requestLookAssessment"]);
requireTokens("src/components/DesignerModule.tsx", ["Ease basis:","approved_house_calibration","fitEaseTableVersion"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", [
  "PHOTO_TUCKED_SHIRT_CLIP",
  "PHOTO_TUCKED_TROUSER_CLIP",
  "PHOTO_TUCKED_NECK_CLEAR",
  "PHOTO_UNTUCKED_SHIRT_BODY_CLIP",
  "PHOTO_UNTUCKED_LEFT_SLEEVE_CLIP",
  "PHOTO_UNTUCKED_RIGHT_SLEEVE_CLIP",
  "PHOTO_UNTUCKED_COLLAR_CLIP",
  "masks.shirt",
  "masks.pant",
  "featheredPathMask",
  "pathMasks",
  "if(path) context.drawImage(featheredPathMask(path),0,0)",
  "Contrast collars/cuffs sit directly beside skin and hands",
  "photographicShapeMaps",
  "photographicShapeMap",
  "blur(5px)",
  "weightedGarmentLuminanceMean",
  "neutralizePhotographicLuminance",
  "garmentMean",
  "panelLightingMasks = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>",
  "function photoLightingMask(mask?:HTMLCanvasElement,path=\"\",maskPrepared=false)",
  "context.drawImage(maskPrepared?mask:featherMaskInside(mask),0,0)",
  "const lightingMask = photoLightingMask(mask,path,Boolean(placement.maskPrepared))",
  "globalAlpha = .9",
  "globalAlpha = .07",
  "function photographicReliefMap(photo: HTMLImageElement, garmentMask?: HTMLCanvasElement)",
  "photographicReliefMaps = new WeakMap<HTMLImageElement, Map<HTMLCanvasElement | null, HTMLCanvasElement>>",
  "const garmentMean = weightedGarmentLuminanceMean(original.data, maskPixels.data)",
  "maskedPhotographicLuminance(original.data[index],garmentMean,maskPixels.data[index+3])",
  "blurContext.drawImage(source, 0, 0, reliefWidth, reliefHeight)",
  "broadContext.drawImage(source, 0, 0, reliefWidth, reliefHeight)",
  "microDetail",
  "foldDetail",
  "128 + microDetail * 1.8 + foldDetail * 1.15",
  "photographicReliefMap(photo, lightingMask)",
  "photographicReliefMap(photo, detailMask)",
  "globalAlpha = .7",
  "globalAlpha = .14",
  "const detailMask = featheredPathMask(path)",
  "photographicShapeMap(photo, detailMask)",
  "globalAlpha = .42",
  "globalAlpha = .32",
  "PHOTO_TUCKED_PANEL_PATTERN_ANCHOR",
  "PHOTO_UNTUCKED_SHIRT_GRAIN_ROTATION",
  "PHOTO_UNTUCKED_SHIRT_PATTERN_ANCHOR",
  "UNTUCKED_TROUSER_SEAM_X=512",
  "splitUntuckedTrouserLegMasks",
  "maskPrepared:true",
  "PHOTO_UNTUCKED_TROUSER_GRAIN_ROTATION",
  "PHOTO_UNTUCKED_TROUSER_PATTERN_ANCHOR",
  "function fabricPatternTransform(fabric:DesignerFabric,placement:FabricPatternPlacement,scale:number)",
  "translate(anchorX,anchorY)",
  "translate(-anchorX,-anchorY)",
]);
requireTokens("src/lib/designer/photo-shading.ts", [
  "weightedGarmentLuminanceMean",
  "neutralizePhotographicLuminance",
  "PHOTO_SHAPE_CONTRAST_GAIN",
]);
requireTokens("src/lib/designer/photo-panel-grain.ts", [
  "photoPanelRotationFromVertical",
  "PHOTO_TUCKED_PANEL_AXES",
  "PHOTO_TUCKED_PANEL_GRAIN_ROTATION",
  "PHOTO_TUCKED_PANEL_PATTERN_ANCHOR",
  "PHOTO_UNTUCKED_SHIRT_PATTERN_ANCHOR",
  "PHOTO_UNTUCKED_SHIRT_GRAIN_ROTATION",
  "PHOTO_UNTUCKED_SHIRT_PANEL_AXES",
  "PHOTO_UNTUCKED_TROUSER_PANEL_AXES",
  "PHOTO_UNTUCKED_TROUSER_GRAIN_ROTATION",
  "PHOTO_UNTUCKED_TROUSER_PATTERN_ANCHOR",
  "visual projection geometry only",
  "screen-space layout anchors only",
  "not tailoring or grain evidence",
  "not a claim about physical cloth measurements",
]);
requireTokens("tests/photo-panel-grain.test.ts", [
  "panel grain rotation measures screen-space fall from vertical",
  "tucked photo panels keep directional fabric aligned to photographed garment axes",
  "tucked panel pattern anchors stay on photographed seam and waist starts",
  "untucked studio shirt keeps sleeves and collar on photographed panel directions",
  "untucked trouser photos keep each leg on its photographed fall",
]);

requireTokens("tests/photo-shading.test.ts", [
  "shape normalization is invariant to the photographed source cloth baseline",
  "garment luminance mean ignores transparent pixels outside the cloth mask",
]);
requireTokens("tests/customer-designer-preview.test.ts", [
  "photographic garment clips feather only inside the real cloth boundary",
  "photo lighting normalization is panel-local inside adaptive garment masks",
  "newDesignerConstruction",
  "instant photo compositor normalizes source albedo before borrowing studio depth",
  "photo compositor removes source-template detail brightness calibration",
  "photo compositor restores garment-local colour-neutral photographic relief",
  "contrast collar and cuff shading reuses baseline-neutral photo structure",
  "tucked directional fabric follows photographed panel grain with stable pattern anchors",
  "untucked photographic shirt projects fabric per torso sleeve and collar panel",
  "untucked trousers project fabric per photographed leg without seam alpha loss",
]);
requireTokens("src/lib/designer/brand-language.ts", [
  "linen-earth-brand-language-provisional-1",
  "evaluateLinenEarthBrandLanguage",
  "soft ranking signal",
  "Keep one visual hero",
]);
requireTokens("src/lib/designer/planner.ts", [
  "BrandLanguageEvaluation",
  "brandLanguage",
  "* .10",
]);
requireTokens("src/lib/designer/outcome-learning.ts", [
  "DESIGNER_FEEDBACK_REASONS",
  "summarizeDesignerOutcomes",
  "sufficientForLearning",
  "topReason",
]);
requireTokens("src/app/api/memory/event/route.ts", [
  "DESIGNER_FEEDBACK_REASONS",
  "payload.reason",
  "styleInput",
  "creativeVisualCheck",
]);
requireTokens("src/lib/designer/constraint-negotiation.ts", [
  "designer-negotiation-v1",
  "buildDesignerNegotiation",
  "hard_blocker",
  "fit_tradeoff",
  "TRY-PLEATED-BLOCK",
]);
requireTokens("src/lib/designer/fit-construction.ts", [
  "fit-construction-provisional-1",
  "fit-construction-calibrated-2",
  "assessFitConstruction",
  "HOUSE_SHIRT_EASE",
  "HOUSE_TROUSER_EASE",
  "HOUSE_EASE_TABLE_VERSION",
  "provisional_house_defaults",
  "approved_house_calibration",
  "easeModel",
]);
requireTokens("src/lib/designer/ease-calibration.ts", ["approvedHouseEaseModelFromRow","ApprovedHouseEaseModel","status,20)!==\"approved\""]);
requireTokens("src/lib/designer/house-ease-server.ts", ["server-only","loadApprovedHouseEaseModel","house_ease_model_list","approvedHouseEaseModelFromRow"]);
requireTokens("src/app/api/designer/assess/route.ts", ["loadApprovedHouseEaseModel","easeModel","houseEaseModel"]);
requireTokens("src/app/api/designer/search/route.ts", ["loadApprovedHouseEaseModel","easeModel"]);
requireTokens("src/app/api/designer/brief/route.ts", ["loadApprovedHouseEaseModel","easeModel"]);
requireTokens("src/lib/designer/planner.ts", [
  "FitConstructionAssessment",
  "ApprovedHouseEaseModel",
  "assessFitConstruction",
  "easeModel",
  "fitConstruction",
]);
requireTokens("src/lib/designer/photo-preview.ts", [
  "PHOTO_TUCKED_SHIRT_CLIP",
  "PHOTO_TUCKED_TROUSER_CLIP",
  "PHOTO_TUCKED_NECK_CLEAR",
  "/designer/studio-tucked.webp",
]);
requireTokens("src/app/measurements/page.tsx", ["MeasurementStudio","MEASUREMENT STUDIO","See exactly where"]);
requireTokens("src/components/MeasurementStudio.tsx", ["SHIRT BLUEPRINT","TROUSER BLUEPRINT","active===id","/designer-studio"]);
requireTokens("src/app/real-model/page.tsx", ["redirect","/designer-studio"]);
requireTokens("src/components/AppShell.tsx", ["Real Model Designer","/real-model","Measurements","/measurements"]);
requireTokens("src/lib/style-director-agent.ts", ["StyleDirectorRealModelSpec","buildRealModelSpec","evaluateDesignerCombo","shirtName","pantName"]);
requireTokens("src/app/style-director/page.tsx", ["Open Linen Earth Real Model Designer","REAL MODEL OUTFIT","#designerPhotoTitle"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["StyleDirectorRealModelPreview","Existing Linen Earth real model","composePhotoOutfit","DESIGNER_PHOTO_TEMPLATES"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["onPreviewReady?:(dataUrl:string,calibrationIdentity:string)=>void",'LOCKED_PREVIEW_MIME="image/webp"',"LOCKED_PREVIEW_QUALITY=.96","onPreviewReadyRef.current(serializeLockedPreview(canvas),resolvedCalibrationIdentity)"]);
requireTokens("src/app/style-director/page.tsx", ["StyleDirectorRealModelPreview","shirtFabric","pantFabric","Existing real model · live outfit"]);
requireTokens("src/app/style-director/page.tsx", ["directorFabricFallback","REAL STOCK / PHOTO TEMPLATE PENDING","Real fabric · no simulated mannequin","Garment geometry stays unvisualized until a photographed template supports this category"]);
requireTokens("src/app/style-director/page.tsx", ["visualizePhotoreal","/api/designer/look-render","lockedPreviewImage:lockedPreviewImage || undefined","onPreviewReady={acceptLockedPreview}","Preparing real model…","Photoreal unlocks when a photographed garment template supports this category","currentCalibrationIdentity","lockedPreviewCalibrationIdentity","renderCalibrationIdentity","fetchCustomerPhotoCalibration","customerPhotoCalibrationIdentity","renderCalibrationIdentity!==currentCalibrationIdentity","setRenderCalibrationIdentity(sourceCalibrationIdentity)","function acceptLockedPreview(dataUrl:string,calibrationIdentity:string)"]);
requireTokens("tests/photo-calibration.test.ts", ["Style Director invalidates a generated photoreal when accepted photo calibration changes"]);
requireTokens("src/app/style-director/style-director.css", [".directorExistingModel canvas","object-fit:contain"]);
requireTokens("src/app/style-director/style-director.css", [".lookVisual img","object-fit:contain","background:#081827"]);
requireTokens("src/app/style-director/style-director.css", [".directorFabricFallback"]);
requireTokens("src/app/style-director/style-director.css", [".directorPhotoPending"]);
requireTokens("tests/customer-designer-preview.test.ts", ["Style Director keeps the full photographed model visible","Style Director generated photoreal also stays full-body"]);
requireTokens("tests/customer-designer-preview.test.ts", ["Style Director photoreal letterbox matches the navy studio"]);
requireTokens("tests/customer-designer-preview.test.ts", ["Style Director never falls back to a simulated mannequin"]);
requireTokens("tests/customer-designer-preview.test.ts", ["Style Director photoreal uses the same locked real-model preview instead of a flat source"]);
requireTokens("src/app/designer/page.tsx", ['redirect("/designer-studio")']);
requireTokens("src/app/visual/page.tsx", ['redirect("/style-director")']);
requireTokens("src/app/designer-brief/page.tsx", ['redirect("/style-director")']);
requireTokens("src/app/page.tsx", ['name: "Suits"','name: "Blazers"','href: "/style-director"']);
requireTokens("tests/customer-designer-preview.test.ts", ["legacy customer design routes consolidate onto the photo-first experiences"]);
requireTokens("src/app/catalog/page.tsx", ['redirect("/designer-studio")']);
requireTokens("src/app/atelier/page.tsx", ['redirect("/account")']);
requireTokens("src/app/designs/page.tsx", ['redirect("/account")']);
requireTokens("src/app/knowledge/page.tsx", ['redirect("/style-director")']);
requireTokens("tests/customer-designer-preview.test.ts", ["legacy customer modules redirect into the consolidated experience"]);
requireTokens("src/components/DesignerModule.tsx", ['params.get("shirt")','params.get("pant")','params.get("style")',"STYLE DIRECTOR"]);
requireTokens("src/lib/designer/garment-spec.ts", ["linen-earth-garment-spec-v1","buildCanonicalGarmentSpec","finishedTargets","ready_for_tailor_review","not a cutting pattern","fitEaseSource","fitEaseTableVersion","conceptId:string","treatments:Array","Creative treatments are design instructions","CanonicalCreativeVisualReview","visualReview:CanonicalCreativeVisualReview"]);
requireTokens("src/app/api/designer/assess/route.ts", ["buildCanonicalGarmentSpec","fitConstruction","blockStrategy","brandLanguage","negotiation","creative","visualReview"]);
requireTokens("src/components/DesignerModule.tsx", ["garmentSpec=assessment?.garmentSpec","Export garment spec","downloadGarmentSpec","activeCreative","creativeTreatmentCount","creativePatternId","creativeVisualReview","setCreativeVisualReview(check)"]);
requireTokens("src/app/api/memory/event/route.ts", ["garmentSpecInput","fitConstructionScore","brandLanguageScore","materialVerification"]);
requireTokens("src/lib/designer/search.ts", [
  "DesignerSearchScope","keep_shirt","keep_trouser","open",
  "DesignerSearchTier","Safe","Elevated","Statement",
  "searchDesignerCatalogue","explainWhyNotCurrentPair","hardBlocked","comparisonFor"
]);
requireTokens("src/lib/designer/evidence-context.ts", ["server-only","aggregateDesignerCasebook","aggregateFitOutcomes","loadDesignerEvidenceContext"]);
requireTokens("src/app/api/designer/search/route.ts", ["searchDesignerCatalogue","loadDesignerEvidenceContext","loadDesignerFabricMetadata","safeMeasurements","safeObservations","__linenDesignerSearchRate"]);
requireTokens("src/lib/designer/brief.ts", ["parseDesignerBrief","occasionFrom","climateFrom","intentionFrom","colorPreferences","preferredTier","semi[-\\s]?formal","\\bformal\\b"]);
requireTokens("src/lib/designer/engine.ts", ["catalogueStyleFormality","formal shirting","printed linen blend",'roleTags: fabric.roleTags?.length ? [...fabric.roleTags] : null']);
requireTokens("src/lib/fabric-analyzer.ts", ['import "server-only"',"analyzeMenswearFabric","verifiedFacts","visualObservations","uncertainClaims"]);
requireTokens("src/lib/fabric-analyzer-taxonomy.ts", ["MENSWEAR_MATERIAL_TAXONOMY","MENSWEAR_PATTERN_TAXONOMY","MENSWEAR_COLOR_TAXONOMY","FABRIC_ANALYZER_EVIDENCE_RULES"]);
requireTokens("src/lib/fabric-analyzer-reference-index.ts", ["REAL_MENSWEAR_MATERIAL_TERMS","REAL_MENSWEAR_PATTERN_TERMS","STANDARD_COLOR_REFERENCE_TERMS","FABRIC_REFERENCE_SOURCES","real-reference-v3"]);
requireTokens("src/lib/fabric-analyzer.ts", ["fabric-analyzer-v4","FABRIC_REFERENCE_COUNTS","retainKnown","references:{","Retrieved real-reference subset","REAL_MENSWEAR_FABRIC_EXAMPLES","REAL_MENSWEAR_FABRIC_EXAMPLE_COUNT","Never transfer composition","Closed output IDs"]);
requireTokens("src/lib/fabric-analyzer-real-examples.ts", ["REAL_MENSWEAR_FABRIC_EXAMPLES","REAL_MENSWEAR_FABRIC_EXAMPLE_COUNT","AUTO-GENERATED","source_id","composition","pattern_name"]);
requireTokens("src/lib/fabric-analyzer-provenance-map.ts", ["FABRIC_REFERENCE_PROVENANCE","AUTO-GENERATED provenance map","source_id","materials","patterns","colors"]);
requireTokens("src/lib/fabric-analyzer.ts", ["FABRIC_REFERENCE_PROVENANCE","sourceIdsForReferences","backend derives source IDs"]);
requireTokens("src/lib/fabric-analyzer-store.ts", ["fabricAnalysisFingerprint","loadStoredFabricAnalysis","storeFabricAnalysis","recordFabricAnalyzerCorrection","loadFabricAnalyzerLearningHints","fabric_analyzer_learning_summary","SUPABASE_SECRET_KEY"]);
requireTokens("src/lib/fabric-analyzer.ts", ["analyzeMenswearFabricWithStore","loadFabricAnalyzerLearningHints","Reviewed correction learning:","reviewed corrections","Explicit supplier/owner facts outrank learned hints"]);
requireFile("src/lib/fabric-intelligence-types.ts");
requireFile("src/lib/fabric-ground-truth-stats.ts");
requireFile("tests/phase10-ground-truth-stats.test.ts");
requireFile("tests/phase10-construction-review-progress.test.ts");
requireFile("src/lib/designer/benchmark-progress.ts");
requireFile("tests/phase10-benchmark-progress.test.ts");
requireTokens("src/lib/designer/benchmark-progress.ts", ["nextUnlabelledBenchmarkIndex","labelledCaseIds","currentIndex"]);
requireTokens("src/app/api/operator/designer-evaluation/route.ts", ["nextUnlabelledBenchmarkIndex","nextUnlabelledIndex","labelState.labels.keys()"]);
requireTokens("src/app/operator/designer-evaluation/DesignerEvaluationClient.tsx", ["nextUnlabelledIndex","Next unlabelled","Save label + next unlabelled"]);
requireFile("src/lib/designer/construction-review-summary.ts");
requireTokens("src/lib/designer/construction-review-summary.ts", ["summarizeConstructionReviews","decided","completionPercent","approved+rejected"]);
requireTokens("src/app/operator/construction-approval/ConstructionApprovalClient.tsx", ["summarizeConstructionReviews","reviewSummary.completionPercent","preferNextPending","shouldAdvance=!selected.review && filter===\"pending\"","await load(true,shouldAdvance)","Construction decisions completed"]);
requireFile("src/lib/fabric-ground-truth-scorecard.ts");
requireFile("src/lib/fabric-ground-truth-labels.ts");
requireFile("src/app/api/operator/fabric-ground-truth/scorecard/route.ts");
requireFile("tests/phase10-analyzer-ground-truth-scorecard.test.ts");
requireFile("supabase/migrations/20260930_fabric_ground_truth_history.sql");
requireFile("supabase/migrations/20260930_fabric_analyzer_queue_provenance.sql");
requireTokens("supabase/migrations/20260930_fabric_ground_truth_history.sql", ["fabric_analyzer_ground_truth_history","fabric_analysis_feedback","review_status in ('approved','corrected')","service_role"]);
requireTokens("supabase/migrations/20260930_fabric_analyzer_queue_provenance.sql", ["fabric_analyzer_batch_enqueue","verifiedPhysicalEvidenceNote","service_role"]);
requireTokens("src/lib/fabric-ground-truth-labels.ts", ["loadFabricAnalyzerGroundTruthHistory","fabricGroundTruthStateFromProfile","reconstructOriginalFabricGroundTruthState","backfilledLabels"]);
requireTokens("src/lib/fabric-analyzer-store.ts", ["FabricAnalyzerGroundTruthHistoryRow","loadFabricAnalyzerGroundTruthHistory","fabric_analyzer_ground_truth_history"]);
requireTokens("src/app/api/operator/fabric-analyzer/queue/route.ts", ["normalizeVerifiedPhysicalEvidenceInput","enqueueFabricAnalyzerBatch"]);
requireTokens("src/app/api/operator/fabric-analyzer/process/route.ts", ["normalizeVerifiedPhysicalEvidenceInput","physicalEvidence"]);
requireTokens("src/lib/physical-evidence-provenance.ts", ["normalizeVerifiedPhysicalEvidenceInput","verifiedPhysicalEvidenceNote","validateVerifiedPhysicalEvidence"]);
requireTokens("src/lib/fabric-ground-truth-scorecard.ts", ["FABRIC_GROUND_TRUTH_VERSION","scoreFabricGroundTruth","fieldAgreementPercent","exactProfilePercent"]);
requireTokens("src/app/api/operator/fabric-ground-truth/scorecard/route.ts", ["verifyOperatorSession","MIN_LABELS=40","loadFabricGroundTruthLabels","reportable"]);
requireTokens("src/app/operator/fabric-ground-truth/FabricGroundTruthClient.tsx", ["fabric_ground_truth_label","fabric-ground-truth-v1","OWNER-LABELLED ANALYZER AGREEMENT","fieldAgreementPercent"]);
requireTokens("src/app/operator/phase10-readiness/Phase10ReadinessClient.tsx", ["analyzerScorecard","/api/operator/fabric-ground-truth/scorecard","analyzerLabelTarget","fieldAgreementPercent"]);
requireTokens("src/lib/fabric-ground-truth-stats.ts", ["summarizeFabricGroundTruth","reviewedFabrics","pendingFabrics","stockBoundProfiles","pending.delete"]);
requireTokens("src/app/api/operator/fabric-analyzer/stats/route.ts", ["loadFabricAnalysesForFabricIds","FABRIC_STOCK.filter","summarizeFabricGroundTruth"]);
requireTokens("src/app/operator/phase10-readiness/Phase10ReadinessClient.tsx", ["groundTruth?.reviewedFabrics","groundTruth?.target"]);
requireFile("src/lib/fabric-intelligence-server.ts");
requireFile("src/app/api/operator/fabric-analyzer/analyze/route.ts");
requireFile("src/lib/fabric-capture-input.ts");
requireFile("src/app/operator/fabric-analyzer/FabricCapturePicker.tsx");
requireTokens("src/app/operator/fabric-analyzer/FabricAnalyzerClient.tsx", ["approveAndNext","Approve + next fabric","evidence?.priority","/operator/designer-data"]);
requireTokens("src/app/operator/fabric-ground-truth/FabricGroundTruthClient.tsx", ["fabric_id:string|null","Catalogue reference · direct capture not retained","retainedSourceImage","/api/operator/designer-data","scope=all"]);
requireTokens("src/app/api/operator/fabric-analyzer/review/route.ts", ["url.searchParams.get(\"scope\")","loadFabricAnalysesForFabricIds","FABRIC_STOCK.map","newestFirst"]);
requireFile("tests/phase10-direct-fabric-capture.test.ts");
requireTokens("src/lib/fabric-capture-input.ts", ["directFabricCaptureBytes","DIRECT_FABRIC_CAPTURE_MAX_BYTES","operator-direct-capture"]);
requireTokens("src/app/operator/fabric-analyzer/FabricCapturePicker.tsx", ["createImageBitmap","image/jpeg","850_000","Use photo from device"]);
requireTokens("src/app/api/operator/fabric-analyzer/analyze/route.ts", ["DIRECT_FABRIC_CAPTURE_MAX_CHARS","isDirectFabricCapture","3_800_000"]);
requireFile("src/app/api/operator/fabric-analyzer/batch/route.ts");
requireFile("src/app/api/operator/fabric-analyzer/review/route.ts");
requireFile("src/app/api/operator/fabric-analyzer/stats/route.ts");
requireFile("src/app/api/operator/fabric-analyzer/calibrate/route.ts");
requireFile("src/app/api/operator/fabric-analyzer/queue/route.ts");
requireFile("src/app/api/operator/fabric-analyzer/process/route.ts");
requireFile("src/lib/fabric-analyzer-calibration.ts");
requireFile("scripts/sync-fabric-reference-index.mjs");
requireTokens("src/lib/fabric-intelligence-types.ts", ["DesignerFabricIntelligence",'trust:"reviewed"|"high-confidence"|"provisional"',"recommendedConstruction","pairing"]);
requireTokens("src/lib/fabric-intelligence-server.ts", ['import "server-only"',"loadDesignerFabricIntelligence","loadFabricAnalysesForFabricIds","high-confidence","reviewed"]);
requireTokens("src/lib/designer/search.ts", ["fabricIntelligenceAlignment","fabricIntelligence?: Record<string,DesignerFabricIntelligence>","intelligenceScore"]);
requireTokens("src/app/api/designer/brief/route.ts", ["enrichDesignerFabricsWithIntelligence","fabricIntelligence"]);
requireTokens("src/app/api/designer/search/route.ts", ["enrichDesignerFabricsWithIntelligence","fabricIntelligence"]);
requireTokens("src/app/api/style-director/route.ts", ["loadDesignerFabricIntelligence","fabricIntelligence"]);
requireTokens("src/lib/style-director-agent.ts", ["directorIntelligenceScore","directorPairIntelligenceScore","DesignerFabricIntelligence"]);
requireTokens("src/lib/fabric-analyzer-store.ts", ["fabric_analyzer_profile_bind","fabric_analyzer_profiles_for_fabrics","fabric_analyzer_profile_review","fabric_analyzer_feedback_apply","loadFabricAnalyzerProfilesForReview","enqueueFabricAnalyzerBatch","claimFabricAnalyzerJobs","finishFabricAnalyzerJob","loadFabricAnalyzerStats","canonicalUrlIdentity"]);
for(const path of [
  "src/app/api/operator/fabric-analyzer/analyze/route.ts",
  "src/app/api/operator/fabric-analyzer/batch/route.ts",
  "src/app/api/operator/fabric-analyzer/review/route.ts",
  "src/app/api/operator/fabric-analyzer/stats/route.ts",
  "src/app/api/operator/fabric-analyzer/calibrate/route.ts",
  "src/app/api/operator/fabric-analyzer/queue/route.ts",
  "src/app/api/operator/fabric-analyzer/process/route.ts",
]) requireTokens(path,["verifyOperatorSession"]);
requireTokens("src/app/api/fabric/analyze/route.ts", ["verifyOperatorSession","OPERATOR_COOKIE","Not found.","sameOrigin"]);
requireTokens("src/lib/fabric-analyzer-calibration.ts", ["runFabricAnalyzerCalibration","loadFabricAnalyzerCalibrationCases","recordFabricAnalyzerCalibration","formality range"]);
requireTokens("src/lib/fabric-analyzer.ts", ["reviewPriority","reviewReasons","reviewPriorityFor"]);
requireTokens("scripts/sync-fabric-reference-index.mjs", ["fabric_analyzer_reference_snapshot","fabric-analyzer-reference-index.ts","fabric-analyzer-provenance-map.ts","fabric-analyzer-real-examples.ts"]);
requireTokens("src/lib/designer/search.ts", ["OCCASION_INTELLIGENCE_IDS","intelOccasionMatch","patternSupportScore","colorFamilyPairSignal","optionIdForLabel","bothHighContrast","bothBold"]);
requireFile("supabase/migrations/20260929_fabric_analyzer_private_backend.sql");
requireFile("supabase/migrations/20260930_fabric_analyzer_reanalysis_review_reset.sql");
requireTokens("supabase/migrations/20260930_fabric_analyzer_reanalysis_review_reset.sql", ["fabric_analyzer_profile_upsert","review_status='unreviewed'","review_notes=''","prior human approval"]);
requireTokens("supabase/migrations/20260929_fabric_analyzer_private_backend.sql", ["private.fabric_analysis_profiles","private.fabric_analysis_bindings","fabric_analyzer_feedback_apply","fabric_analyzer_profiles_for_fabrics","fabric_analyzer_calibration_cases_get","service_role"]);

requireTokens("src/lib/designer/search.ts", ["occasionFabricAlignment","formal shirting","printed linen blend","occasionScore","occasionPreferredShirts","strictOccasionFit","openShirts"]);
requireFile("src/lib/vocab/types.ts");
requireFile("src/lib/vocab/normalization.ts");
requireFile("src/lib/vocab/color-distance.ts");
requireFile("src/lib/vocab/colors.ts");
requireFile("src/lib/vocab/patterns.ts");
requireFile("src/lib/vocab/styling.ts");
requireFile("src/lib/vocab/designer-options.ts");
requireFile("src/lib/vocab/intelligence.ts");
requireFile("src/lib/fabric-intelligence-adapter.ts");
requireFile("tests/phase10-vocab.test.ts");
requireTokens("src/lib/vocab/normalization.ts", ["normalizeToken","normalizeArray","reviewNeeded"]);
requireTokens("src/lib/fabric-intelligence-adapter.ts", ["fabric-analyzer-v3","fabric-analyzer-v4","adaptFabricProfileToV4","reviewNeeded"]);
requireTokens("src/lib/fabric-intelligence-server.ts", ["adaptFabricProfileToV4","reviewNeeded"]);
requireTokens("src/lib/vocab/intelligence.ts", ["colorFamilyPairSignal"]);
requireTokens("src/app/api/designer/brief/route.ts", ["parseDesignerBrief","searchDesignerCatalogue",'scope:"open"',"tierOrder","safeMeasurements","safeObservations"]);
requireTokens("src/components/DesignerModule.tsx", ["DesignerAdvisorPanel","one_line_designer_brief","expectedIdentity","styleSpec:nextStyleSpec","result.styleSpec??fromLegacyStyle(result.style)"]);
requireTokens("src/components/DesignerAdvisorPanel.tsx", ["/api/designer/brief","Ask Designer","newDesignerBrief","StyleDirectorRealModelPreview","newDesignerBriefModel","SAME LINEN EARTH MODEL","newDesignerBriefCut","Revise this direction","request.isCurrent()","request.signal","recordJudgement"]);
requireTokens("src/lib/designer/search.ts",["Occasion match:"]);
requireTokens("src/lib/browser-style-memory.ts", ["readLocalDesignerTasteProfile","aggregateDesignerTaste"]);
requireTokens("src/lib/designer/taste-profile.ts",["evidence<4","preferredTier","preferredShirtWear","preferredTrouser","distinctRecipes","creativeVisualCheck","occasion"]);
requireTokens("src/lib/designer/advisor.ts",["designer-advice-v1","designerTaskFor","safeDesignerJudgement","buildDesignerNegotiation","canApply","legacyOptionByLabel","styleSpec:fromLegacyStyle"]);
requireTokens("src/app/api/designer/brief/route.ts", ["safePersonalTaste","personalizeDesignerBrief","linen-designer-brief-v2"]);
requireTokens("src/lib/designer/personal-taste.ts",["evidence<4","protectedKeys","parseDesignerConstructionIntent","scopeStyleLocks","Personal preferences from your distinct judgements"]);
requireTokens("src/lib/designer/search.ts", ["fitAdaptedStyle","Fit-aware adjustment:","suggestedPatch","fitAdaptation"]);
requireTokens("src/lib/designer/block-strategy.ts", ['patch.shirtFit = "Regular / Classic Fit"','patch.trouser = "Pleated Trouser"',"BLOCK-TORSO-STRAIGHT","BLOCK-SEAT-FLATFRONT"]);
requireTokens("src/components/DesignerAdvisorPanel.tsx", ["fitAdaptation","newDesignerBriefFit","FIT-AWARE","fitTargets"]);
requireTokens("src/lib/designer/search.ts", ["fabricPairDiffers","Prefer genuinely different fabric pairs","occasionPreferredShirts"]);
requireTokens("src/app/api/designer/look-render/route.ts", ["renderSelectedLookFashnFront","renderSelectedLookFashnView","frontImage","three-quarter","side","back"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["PhotorealView","choosePhotorealView","Generate 3/4","photorealViews"]);
requireTokens("src/lib/ai-visualization.ts", ["SelectedLookVisualCheck","inspectSelectedLookFashnOutput","repairSelectedLookFashnFront","assertFashnRepairRateLimit"]);
requireTokens("src/app/api/designer/look-inspect/route.ts", ["inspectSelectedLookFashnOutput","cache-control","no-store"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["/api/designer/look-inspect","selectedCheck","Repair once","repairSelectedLook"]);
requireTokens("src/lib/ai-visualization.ts", ['view:SelectedLookView="front"',"Expected camera/view:","three-quarter","side","back"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["activeSelectedCheck","inspectSelectedLook(data.result,view,request)","This camera view needs review"]);
requireTokens("src/app/api/designer/look-download/route.ts", ["OFFICIAL_FASHN_OUTPUT","content-disposition","private, no-store"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["/api/designer/look-download","activeImage","encodeURIComponent(activeImage)"]);
requireTokens("src/components/DesignerModule.tsx", [
  "OPTIONAL","Try a different fabric pairing","Show 3 options","Keep shirt","Keep trouser","Change both","Use look","newDesignerOptionalSearch","/api/designer/search","Finding…",
  "CreativeStudioPanel","craftRequest",
  "/api/designer/creative-generate","requestCreativeDirections(12","creativeAutoNote","onCreativeInspection"
]);
requireTokens("src/lib/designer/creative-engine.ts", [
  "generateCreativeDirections","researchMutationSeeds","hybridResearchSeed","researchFreedom","maximum","researchUtilization","explorationClass",
  "redesignLoop","pairwiseTournament","refinementShortlist","sourceDistance","chooseCreativeRedesign"
]);
requireTokens("src/lib/designer/fashion-research-source-pool.ts", [
  "FASHION_RESEARCH_SOURCES","FASHION_RESEARCH_TOPICS","FASHION_RESEARCH_TARGETS","buildFashionResearchTargets"
]);
requireTokens("src/app/api/designer/creative-generate/route.ts", ["generateCreativeDirections","chooseCreativeRedesign","researchFreedom:\"maximum\"","loadActiveDesignerCatalogueFabrics","loadDesignerCreativeContext","__linenCreativeGenerateRate"]);
requireTokens("src/lib/designer/creative-context.ts", ["server-only","aggregateCreativeLearning","aggregateCreativeResearch","loadDesignerCreativeContext"]);
requireTokens("src/app/api/designer/creative-render/route.ts", ["renderCreativeFashnFront","CreativeFashnRequest"]);
requireTokens("src/app/api/designer/creative-inspect/route.ts", ["inspectCreativeFashnOutput","CreativeFashnRequest","maxDuration=30"]);
requireTokens("src/lib/ai-visualization.ts", ["inspectCreativeRender","heroVisibility","boundaryIntegrity","PROTECTED_RENDER_BOXES","Visual hierarchy contract","semanticCreativeRenderCheck","ai-gateway.vercel.sh/v1/responses","LINEN_VISUAL_CRITIC_MODEL","openai/gpt-5.4","referenceDataUri","fabricContext","heroAccuracy","fabricFidelity","supportCompetition","visualCriticModels","google/gemini-3-flash"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["VISUAL CHECK PASSED","onCreativeInspection","newDesignerRenderCheck"]);
requireTokens("src/lib/designer/creative-learning.ts", ["renderMismatchReviews",'review.reason==="render_mismatch"',"renderRisk","renderQualitySamples"]);
requireTokens("src/app/operator/designer-research/DesignerResearchClient.tsx", ["Creative Research Desk","Save research signal","Discover up to 1,000 websites","Analyze source ✦","Synthesize 8 diverse sources ✦","analyzeResearchBatch"]);
requireTokens("src/lib/designer/research-source-discovery.ts", ["discoverFashionWebsites","Q3661311","Q11828862","Q607081","Math.min(1000"]);
requireTokens("src/lib/designer/research-source-analysis.ts", ["analyzeFashionResearchSource","analyzeFashionResearchBatch","offset+=4","Math.min(8","safePublicUrl","resolvePublicAddress","pinnedPageRequest","node:https","node:dns/promises","Research source resolves to a private or local network address","linen_research_signal","Do not copy a finished garment","LINEN_RESEARCH_MODEL","google/gemini-3-flash"]);
requireTokens("src/app/api/operator/designer-research/discover/route.ts", ["discoverFashionWebsites",'searchParams.get("limit")||1000',"Operator login required"]);
requireTokens("src/app/api/operator/designer-research/analyze/route.ts", ["analyzeFashionResearchSource","Operator login required","maxDuration=30"]);
requireTokens("src/app/api/operator/designer-research/analyze-batch/route.ts", ["analyzeFashionResearchBatch","slice(0,8)","maxDuration=60","Operator login required"]);
requireTokens("src/lib/designer/casebook.ts", [
  "designer-casebook-v1","designer_case_review","casebookSignalFor","total>=3","scale=6"
]);
requireTokens("src/app/api/designer/casebook/route.ts", [
  "aggregateDesignerCasebook","source:\"eq.operator\"","type:\"eq.operator_note\"","select:\"type,source,payload\""
]);
requireTokens("src/app/operator/OperatorClient.tsx", [
  "DESIGNER CASE REVIEW","Approve case","Reject case","designer_case_review"
]);
requireTokens("src/lib/designer/roadmap-readiness.ts", ["summarizeRoadmapReadiness","fabricTruthEvidence","phase2Complete=reviewedComplete&&colorComplete&&fabricTruthEvidence.gateComplete","phase1Complete","phase8Complete","phase9Complete","backendHealth.gateComplete","productionRuntime.gateComplete"]);
requireTokens("src/app/operator/roadmap-readiness/RoadmapReadinessClient.tsx", ["Readiness Control Tower","ENGINEERING","PRODUCTION BACKEND","PRODUCTION RUNTIME","REAL EVIDENCE","No phase is promoted from missing data"]);
requireTokens("src/lib/designer/fabric-truth-policy.ts", ["FABRIC_TRUTH_POLICY_VERSION","normalizeFabricTruthPolicy","evaluateFabricTruthPolicy","gateComplete"]);
requireTokens("src/lib/designer/roadmap-backend-health.ts", ["ROADMAP_BACKEND_CAPABILITIES","summarizeRoadmapBackendHealth","productionCutEvidence","verifiedMeterageCuts","privateSchemaDenyByDefault"]);
requireTokens("src/app/api/operator/roadmap-backend-health/route.ts", ["verifyOperatorSession","roadmap_v2_evidence_health","summarizeRoadmapBackendHealth"]);
requireTokens("src/lib/designer/production-runtime-health.ts", ["PRIMARY_VERCEL_PROJECT_ID","summarizeProductionRuntimeHealth","VERCEL_DEPLOYMENT_ID","VERCEL_GIT_COMMIT_SHA","primaryProject"]);
requireTokens("src/app/api/operator/production-runtime-health/route.ts", ["verifyOperatorSession","productionRuntimeHealthFromEnv","private, no-store"]);
requireTokens("src/lib/designer/evidence-sprint.ts", ["buildEvidenceSprint","premium-shirt-proof","fabric-truth","deterministic-designer","measurement-fit","production-bridge","closed-loop"]);
requireTokens("src/app/operator/evidence-sprint/EvidenceSprintClient.tsx", ["Evidence Sprint","NEXT THREE","Highest-leverage evidence to collect","Missing data never marks a task complete","Evidence boundary"]);
requireTokens("src/app/operator/OperatorClient.tsx", ["/operator/evidence-sprint","EVIDENCE SPRINT"]);
requireTokens("vercel.json", ["deploymentEnabled","\"**\": false","\"main\": true","ignoreCommand"]);
requireTokens("scripts/vercel-ignore.mjs", ["VERCEL_GIT_COMMIT_REF","VERCEL_GIT_COMMIT_MESSAGE","PRODUCTION_BRANCH = \"main\"","DEPLOY_MARKER = \"[deploy]\"","no [deploy] milestone marker","continue production build"]);
requireTokens("src/app/api/operator/fabric-truth-policy/route.ts", ["verifyOperatorSession","fabric_truth_evidence_policy","normalizeFabricTruthPolicy"]);
requireTokens("src/app/operator/fabric-truth-policy/FabricTruthPolicyClient.tsx", ["The software does not choose these thresholds","Save approved policy","LIVE PHYSICAL COVERAGE"]);
requireTokens("src/lib/designer/fit-outcomes.ts", ["designer-fit-outcomes-v1","aggregateFitOutcomes","fitOutcomeSignalFor"]);
requireTokens("src/app/api/designer/casebook/route.ts", ["aggregateFitOutcomes","fitOutcomes"]);
requireTokens("src/app/operator/OperatorClient.tsx", ["FIRST-FITTING OUTCOME","designer_fit_outcome","saveFitOutcome"]);
requireTokens("src/lib/designer/search.ts", ["fitOutcomeSignalFor","Reviewed first-fit"]);
requireTokens("src/lib/designer/tailor-observations.ts", ["linen-earth-tailor-observations-v1","ShoulderBalance","PostureBalance","SeatBalance","validStoredTailorObservationProfile"]);
requireTokens("src/components/MeasurementStudio.tsx", ["OPTIONAL / TAILOR OBSERVATIONS","MANUAL INPUT ONLY","TAILOR_OBSERVATION_STORAGE_KEY","persistMeasurementPair","event.preventDefault()","measureSaveError"]);
requireTokens("src/lib/designer/fit-construction.ts", ["OBS-SHOULDER-SLOPING","OBS-POSTURE-FORWARD","OBS-SEAT-FULL","OBS-MOBILITY"]);
requireTokens("src/components/DesignerModule.tsx", ["tailorObservationSummary","observationCoverage","observations:tailorObservations"]);
requireFile("src/lib/designer/body-profile.ts");
requireFile("src/components/LiveConstructionPreview.tsx");
requireFile("tests/phase10-body-profile.test.ts");
requireTokens("src/lib/designer/style-spec-v2.ts", ["STYLE_SCHEMA_VERSION=2","mergeLegacyIntoStyleSpec","validateStyleSpecV2","styleSpecRenderSummary"]);
requireTokens("src/components/DesignerModule.tsx", ["styleSpec","PhotoOutfitPreview","bodyProfileFromMeasurements"]);
requireTokens("src/components/DesignerModule.tsx", ["photoPreviewSupportForChoice","photoMatchSummary","PHOTO MATCH · MIXED","selected details directly match a photographed template"]);
requireTokens("src/app/designer-studio/designer-light.css", [".newDesignerPhotoMatch","data-state=\"mixed\""]);
requireTokens("src/app/designer-studio/designer-light.css", [".newDesignerPhotoStage","background:#0a1726",".newDesignerPhotoAi"]);
requireTokens("src/app/designer-studio/designer-light.css", [".newDesignerBriefModel .directorExistingModel canvas","object-fit:contain"]);
requireTokens("tests/customer-designer-preview.test.ts", ["customer Designer exposes the selected details photo-match state"]);
requireTokens("tests/customer-designer-preview.test.ts", ["Designer recommendation cards keep the photographic mannequin full-body"]);
requireTokens("tests/customer-designer-preview.test.ts", ["contrast collar and cuff shading reuses baseline-neutral photo structure"]);
requireTokens("tests/customer-designer-preview.test.ts", ["plain linen swatches retain visible microtexture without reusing catalogue shadows"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["serializeLockedPreview(canvasRef.current)",'LOCKED_PREVIEW_MIME="image/webp"',"LOCKED_PREVIEW_QUALITY=.96","lockedPreviewImage"]);
requireTokens("src/app/api/designer/look-render/route.ts", ['lockedPreviewImage:typeof body.lockedPreviewImage==="string"']);
requireTokens("src/lib/ai-visualization.ts", ["LOCKED_PREVIEW_DATA_URI","LOCKED_PREVIEW_MAX_BYTES=4_500_000","LOCKED_PREVIEW_IDENTITY_BOXES",".webp({quality:96,nearLossless:true,smartSubsample:true})","data:image/webp;base64",'output_format: "png"',"documented input contract does not expose an aspect-ratio override","selectedLookGarmentEditMask","PHOTO_TUCKED_SHIRT_CLIP","PHOTO_TUCKED_TROUSER_CLIP","mask,","runEdit(source,selectedLookPrompt(input,usedLockedPreview),context,garmentMask)","selected-look-locked-preview","deterministic locked live preview"]);
requireTokens("src/lib/designer/render-cache-key.ts", ["linen-final-render-cache-v3-locked-studio-model","LINEN_EARTH_MODEL_IDENTITY_ID","modelIdentity:LINEN_EARTH_MODEL_IDENTITY_ID","function lockedPreviewIdentity",'createHash("sha256").update(raw).digest("hex")','lockedPreview:view==="front"?lockedPreviewIdentity(input.lockedPreviewImage):""']);
requireTokens("tests/customer-designer-preview.test.ts", ["final photoreal render is seeded from the validated locked live preview"]);
requireTokens("src/lib/designer/render-protected-region.ts", ["PROTECTED_REGION_DELTA_REFERENCE=.22","PROTECTED_REGION_REVIEW_PERCENT=34","PROTECTED_REGION_WEAK_PERCENT=60","protectedRegionChangePercent","classifyProtectedRegionChange"]);
requireTokens("src/lib/ai-visualization.ts", ["protectedRegionChange","protectedRegionStatus",'if(view==="front")',"protectedDeltas=PROTECTED_RENDER_BOXES.map","Deterministic protected-region check for the front view","mannequinConsistency:combinedMannequin","Restore the locked mannequin and studio outside the garment edit region"]);
requireTokens("tests/render-protected-region.test.ts", ["protected render drift uses the same conservative normalized scale as visual QA","protected region status fails closed only after meaningful front-view drift"]);
requireTokens("tests/final-render-protected-region-qa.test.ts", ["front photoreal QA measures protected model and studio drift before semantic review","secondary camera views do not compare against front-only protected coordinates"]);
requireTokens("src/lib/ai-visualization.ts", ["FABRIC_CONTEXT_PANEL_WIDTH=500","FABRIC_CONTEXT_HEIGHT=620","FABRIC_CONTEXT_GUTTER=32","fabricContextPanel",'fit:"contain"',"withoutEnlargement:false","FABRIC_CONTEXT_BACKGROUND","rightOffset=FABRIC_CONTEXT_PANEL_WIDTH+FABRIC_CONTEXT_GUTTER","neutral gutter deliberately keeps shirt and trouser references","without adding labels/text","LEFT PANEL is the exact shirt-fabric reference; RIGHT PANEL is the exact trouser-fabric reference. Ignore the neutral strip between them.","shirt left panel, neutral separator, trouser right panel"]);
requireTokens("tests/final-render-fabric-context.test.ts", ["final-render fabric context preserves each full swatch and separates garments",'fit:"contain"',"FABRIC_CONTEXT_GUTTER=32"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["Lock final design","Final photoreal ✦","selectedLookSessionCache","styleSpec","bodyProfile"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["grayscale(1) blur(7px)","microDetail","foldDetail","colour-neutral multi-band relief map","globalAlpha = .7","globalAlpha = .14"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["const plainTextureDetailGain = .34","high-frequency linen weave to avoid a flat painted-shirt look","plainTextureDetailGain"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["function drawWhiteDetail","const detailMask = featheredPathMask(path)","photographicShapeMap(photo, detailMask)","globalAlpha = .42","globalAlpha = .32"]);
requireTokens("src/lib/designer/photo-preview.ts", ["DESIGNER_PHOTO_TEMPLATES","/designer/studio-tucked.webp"]);
requireTokens("tests/customer-designer-preview.test.ts", ["photo compositor removes source-template detail brightness calibration"]);
requireTokens("tests/customer-designer-preview.test.ts", ["customer final photoreal keeps the full model in frame"]);
requireTokens("src/app/designer-studio/designer-light.css", [".newDesignerPhotoAi","object-fit:contain"]);
requireTokens("src/app/api/designer/look-render/route.ts", ["resolved.locked!==true","getCachedSelectedLookRender","loadDurableSelectedLookRender","storeDurableSelectedLookRender","resolveSelectedLookRequest","x-linen-render-cache"]);
requireTokens("src/lib/designer/render-cache.ts", ["designer_render_cache_get","designer_render_cache_upsert_v2","loadDesignerRenderCacheStats","loadPopularDesignerRenderPairs"]);
requireTokens("src/lib/designer/selected-look-server.ts", ["resolveSelectedLookRequest","enrichSelectedLookEvidence","loadDesignerFabricMetadata","loadDesignerFabricIntelligence"]);
requireFile("supabase/migrations/20260930_designer_render_cache.sql");
requireFile("supabase/migrations/20260930_designer_render_cache_observability.sql");
requireTokens("src/app/api/operator/designer-render-cache/stats/route.ts", ["verifyOperatorSession","loadDesignerRenderCacheStats","loadPopularDesignerRenderPairs","visibleOnCustomerWeb:false"]);
requireTokens("src/lib/ai-visualization.ts", ["styleSpecRenderSummary","bodyProfileRenderSummary","getCachedSelectedLookRender","Lock the final design before using the photoreal renderer."]);
requireTokens("src/lib/designer/body-profile.ts", ["BodyPreviewProfile","BODY_HEIGHT_OPTIONS","BODY_SKIN_TONES","bodyProfileFromMeasurements"]);
requireTokens("src/lib/fabric-analyzer.ts", ["macroImageUrl","foldImageUrl","Photo protocol image order is FLAT","captureMeasurements","Macro capture missing","Fold capture missing"]);
requireTokens("src/lib/fabric-analyzer-store.ts", ["macroContentSha256","foldContentSha256","macroImageUrl","foldImageUrl"]);
requireTokens("src/app/api/operator/fabric-analyzer/analyze/route.ts", ["macroImageUrl","foldImageUrl"]);
requireTokens("src/app/api/operator/fabric-analyzer/batch/route.ts", ["macroImageUrl","foldImageUrl"]);
requireTokens("src/app/api/operator/fabric-analyzer/process/route.ts", ["macroImageUrl","foldImageUrl"]);
requireTokens("supabase/migrations/20260929_fabric_analyzer_private_backend.sql", ["fabric-analyzer-v4","macroImageUrl","foldImageUrl","swatchRealWidthMm","repeatRealMm"]);

requireTokens("src/components/PremiumShirtProof.tsx", ["Premium Shirt Proof","StyleDirectorRealModelPreview","LiveConstructionPreview","Roadmap gate: ≤ 8% scale error"]);
requireTokens("src/lib/designer/design-lock.ts", ["linen-earth-design-lock-v1","recipeHash","revisionId","verifyLockedDesignRevision"]);
requireTokens("src/lib/designer/design-vault.ts", ["lev1","createDesignVaultAccessKey","hashDesignVaultAccessKey"]);
requireTokens("src/lib/measurement-vault.ts", ["lem1","createMeasurementVaultAccessKey","hashMeasurementVaultAccessKey"]);
requireTokens("src/lib/vault-id.ts", ["normalizeVaultId","typeof value!==\"string\"","VAULT_ID.test(normalized)"]);
requireTokens("src/lib/vault-request-identifiers.ts", ["normalizeVaultId(body.vaultId)","return {ok:false,field:\"vaultId\"}"]);
requireTokens("src/components/MeasurementStudio.tsx", ["Secure measurement copy","/api/measurements/vault","Recovery token"]);
requireTokens("src/lib/designer/production-handoff.ts", ["linen-earth-production-handoff-v1","stockReservation","clothEstimate","quote"]);
requireTokens("src/lib/designer/tech-pack.ts", ["linen-earth-tech-pack-v1","Tailor Tech Pack","not a cutting pattern"]);
requireTokens("src/lib/designer/production-quote.ts", ["normalizeProductionQuoteDraft","Quote total cannot be negative"]);
requireTokens("src/lib/designer/production-state.ts", ["ORDER_TRANSITIONS","QUOTE_TRANSITIONS","cloth_reserved","delivered"]);
requireTokens("src/lib/designer/production-delivery-evidence.ts", ["evidenceReference","legacyOrUnverifiedCount","provenanceReady","gateComplete:firstTarget.length>=target"]);
requireTokens("src/app/api/operator/production-evidence/route.ts", ["production_delivery_evidence_record_v2","p_evidence_reference"]);
requireTokens("src/app/operator/production-evidence/ProductionEvidenceClient.tsx", ["Production-flow evidence reference","legacy audits without provenance","evidenceReference"]);
requireTokens("supabase/migrations/20261026_production_delivery_evidence_provenance.sql", ["evidence_reference","production_delivery_evidence_record_v2","named operator or checker is required","production-flow evidence reference is required","service_role"]);
requireTokens("supabase/migrations/20261104_production_zero_reentry_consistency.sql", ["production_zero_reentry_fields_consistent","manual_design_reentry = false","jsonb_array_length(reentry_fields)","raise exception"]);
requireTokens("supabase/migrations/20261105_production_reentry_field_vocabulary.sql", ["production_reentry_fields_known","reentry_fields <@","fabric_identity","quote_order_identity","raise exception"]);
requireTokens("src/lib/designer/production-packet.ts", ["packetBuiltFromLockedRevision:true","noDesignDataReEntry:false","deliveryAuditRequired:true","verified separately after real delivery"]);
requireTokens("src/lib/designer/production-packet.ts", ["linen-earth-production-packet-v1","noDesignDataReEntry"]);
requireTokens("src/lib/designer/stock-ledger.ts", ["stockSnapshot","normalizeManualStockEvent","normalizeStockReservation","normalizeStockConsumption","normalizeStockRelease","recordedBy","requestedBy","checkedBy","releasedBy","sourceReference","reservedMetres","availableMetres"]);
requireTokens("src/lib/fabric-stock.ts", ["availabilityVerified?: boolean"]);
requireTokens("src/lib/designer/stock-availability.ts", [
  "verifiedStockAvailabilityMap",
  "stockSnapshotHasConfirmedProvenance",
  "provenance_ready",
  "uniqueCatalogueIds.has(fabric.id)&&verified.has(fabric.id)",
  "uniqueCatalogueIds.has(fabric.id)&&fabric.inStock&&verified.get(fabric.id)===true",
  "verifiedFabricIds:[...verified.keys()].filter((id)=>uniqueCatalogueIds.has(id))",
]);
requireTokens("scripts/ci-verified-stock-fixture.cjs", ["GITHUB_ACTIONS","127.0.0.1","fabric_stock_snapshot_v2","physicalEvidence:false"]);
requireTokens("tests/ci-verified-stock-fixture.test.ts", ["refuses to start outside GitHub Actions"]);
for (const workflow of [".github/workflows/ci.yml",".github/workflows/deep-engine-non3d.yml"]) {
  requireTokens(workflow, ["scripts/ci-verified-stock-fixture.cjs","SUPABASE_URL=http://127.0.0.1:54324","sb_secret_titan_ci_fixture_only"]);
}

requireTokens("src/lib/designer/engine.ts", ["availabilityVerified?: boolean","verified physical stock status","provenance-ready positive stock status"]);
requireTokens("tests/stock-availability.test.ts", ["availabilityVerified,true","availabilityVerified,false","missing or unreachable stock ledger"]);
requireTokens("src/lib/designer/stock-availability-server.ts", ["fabric_stock_snapshot_v2","applyLiveVerifiedStockAvailability","stockSnapshotHasConfirmedProvenance","cache:\"no-store\""]);
requireTokens("src/lib/designer/catalog-stock-server.ts", ["loadDesignerFabricMetadata","applyDesignerFabricMetadataToStock","applyLiveVerifiedStockAvailability","verifiedStockFabrics","loadActiveDesignerCatalogueFabrics","loadDesignerFabricIntelligence","attachCatalogFabricPhysics","filter((fabric)=>fabric.inStock)"]);
requireTokens("src/app/api/designer/catalog/route.ts", ["loadActiveDesignerCatalogueFabrics","verifiedStockFabrics"]);
requireTokens("src/lib/garment-viewer-model-contract.ts", ["linen-earth-garment-viewer-v2","REQUIRED_GARMENT_VIEWER_MATERIALS","approvedGarmentViewerModelSource","validateGarmentViewerModelManifest"]);
requireTokens("src/lib/garment-viewer-glb.ts", ["parseGarmentViewerGlbJson","externalGlbUri","performanceBudgetReady","structuralReady"]);
requireTokens("src/lib/garment-viewer-readiness.ts", ["garmentViewerPromotionReadiness","GARMENT_VIEWER_REALISM_RUBRIC_VERSION","ROADMAP_SCALE_TOLERANCE_PCT"]);
requireTokens("src/components/GarmentViewer.tsx", ["sampler?.setScale","sampler?.setOffset","sampler?.setRotation","GARMENT_VIEWER_LATENCY_STORAGE_KEY","LINEN_EARTH_MODEL_IDENTITY_ID","LINEN_EARTH_MODEL_REFERENCE_IMAGE","LINEN_EARTH_MODEL_VIEWS","PHOTO PARITY NOT YET APPROVED"]);
requireTokens("src/lib/designer/model-identity.ts", ["linen-earth-studio-model-v1","/designer/studio-tucked.webp","yawDeg:0","yawDeg:35","yawDeg:90","yawDeg:180"]);
requireTokens("src/app/operator/garment-viewer/page.tsx", ["CUSTOMER PROMOTION GATE","GarmentViewerEvidenceForm","loadLatestGarmentViewerReadiness"]);
requireTokens("src/app/operator/phase10-readiness/Phase10ReadinessClient.tsx", ["garment-viewer-m2","Reusable 3D GarmentViewer production gate","/api/operator/garment-viewer"]);
requireTokens("src/app/api/designer/search/route.ts", ["applyLiveVerifiedStockAvailability","liveStock.stock.filter((fabric)=>fabric.inStock)"]);
requireTokens("src/app/api/designer/brief/route.ts", ["applyLiveVerifiedStockAvailability","liveStock.stock.filter((fabric)=>fabric.inStock)"]);
requireTokens("src/app/api/designer/assess/route.ts", ["loadActiveDesignerCatalogueFabrics","creativeDirectionMatchesSelection"]);
requireTokens("src/app/api/style-director/route.ts", ["applyLiveVerifiedStockAvailability","verifiedStockFabrics"]);
requireTokens("src/app/style-director/page.tsx", ["verified ledger availability enforced where recorded"]);
requireTokens("src/app/operator/production/ProductionClient.tsx", ["Load locked design","New quotes and production orders are blocked","Quote created from verified locked revision","Production order created from verified locked revision","durable design context","learningContexts","Outcome lineage","context missing","CUSTOMER OUTCOME","not automatically applied to Designer ranking","/operator/customer-outcomes","Outcome Review"]);
requireTokens("src/app/api/operator/stock/route.ts", ["fabric_stock_snapshot_v2","fabric_stock_record_v3","fabric_stock_reserve_v2","fabric_stock_release_v2","fabric_stock_consume_reservation_v2","p_recorded_by","p_requested_by","p_released_by","p_checked_by","p_source_reference","normalizeStockMutationRequestKey(body.requestKey)","p_request_key:requestKey"]);

// T3/J1/T5: No stock mutation receipt, private response or raw backend error
// can silently regress while the physical inventory remains unverified.
requireTokens("src/lib/designer/operator-stock-safety.ts", [
  "verifiedOperatorStockReceiptId", "normalizeVaultId(value)", "value.toLowerCase()===normalized",
  "verifiedOperatorStockMutationReceipt", "receipt.released===true", "receipt.consumed===true",
]);
requireTokens("src/app/api/operator/stock/route.ts", [
  "function respond(body:unknown", "private, no-store", 'pragma:"no-cache"',
  "verifiedOperatorStockReceiptId(await rpc<unknown>", "Stock operation could not be completed.",
]);
requireTokens("scripts/verify-operator-private-response-headers.cjs", ['"/api/operator/stock"']);

requireTokens("src/app/operator/stock/StockClient.tsx", ["Fabric Stock Ledger","Physical source reference","Meterage sheet + documented line reference","Close action source","PHYSICAL PROVENANCE","provenance_ready","Create reservation","Consume","Release","validateOperatorStockSnapshot(data.stock)","setStock(verifiedStock)","verifiedOperatorStockMutationReceipt(body.action,data)"]);

requireTokens("src/lib/designer/stock-ledger.ts", [
  "stockReservationAttempt(", "stockReservationSignature(", "existing.get(signature)??newKey()",
]);
requireTokens("src/app/operator/stock/StockClient.tsx", [
  "writeInFlight.current=true", "const generation=++readGeneration.current",
  "readGeneration.current++", "reservationKeys.current.set(attempt.signature,attempt.requestKey)",
  "confirmedReservations.has(reservationSignature)", "Outcome may be uncertain.", "await load();",
]);

requireTokens("supabase/migrations/20261001_fabric_stock_ledger.sql", ["fabric_stock_snapshot","fabric_stock_reserve","request_key","service_role"]);
requireTokens("supabase/migrations/20261028_fabric_stock_provenance.sql", ["fabric_stock_record_v2","fabric_stock_snapshot_v2","recorded_by","source_reference","legacy_unverified_event_count","provenance_ready","service_role"]);
requireTokens("supabase/migrations/20261031_stock_record_exact_retry.sql", [
  "fabric_stock_record_v3","pg_advisory_xact_lock","stock-request:","stock-fabric:",
  "v_existing.source_reference<>p_source_reference","return v_existing.event_id",
  "revoke all on function public.fabric_stock_record_v3","service_role",
]);
requireTokens("src/lib/designer/stock-ledger.ts", [
  "normalizeStockMutationRequestKey", "stockManualRecordAttempt", "stockManualRecordSignature",
]);

requireTokens(".github/workflows/titan-stock-record-db.yml", [
  "image: postgres:16", "job.services.postgres.id", "verify-stock-record-db.sh",
]);
requireTokens("scripts/ci/verify-stock-record-db.sh", [
  "stock-record-db-setup.sql",
  "supabase/migrations/20261031_stock_record_exact_retry.sql",
  "stock-record-db-assertions.sql",
  "Concurrent same-key physical receipts",
  "Concurrent overdraw must allow exactly one adjustment.",
]);
requireTokens("scripts/ci/stock-record-db-setup.sql", [
  "create unique index fabric_stock_ledger_request_key_uidx",
  "create or replace function public.fabric_stock_snapshot_v2",
]);
requireTokens("scripts/ci/stock-record-db-assertions.sql", [
  "stock request key already belongs to different evidence",
  "adjustment exceeds available unreserved fabric",
  "privileged stock RPC role grants are not restricted",
]);

requireTokens(".github/workflows/titan-stock-record-db.yml", [
  'verify-stock-record-db.sh "$PG_CONTAINER" historical',
]);
requireTokens("scripts/ci/verify-stock-record-db.sh", [
  "database=titan_stock_historical",
  "20261001_fabric_stock_ledger.sql", "20261028_fabric_stock_provenance.sql",
  "20261029_stock_reservation_provenance.sql", "20261030_stock_consumption_provenance.sql",
  "20261031_stock_reservation_concurrency_provenance.sql",
  "20261031_stock_record_exact_retry.sql",
  "stock-record-historical-assertions.sql",
]);
requireTokens("scripts/ci/stock-record-historical-assertions.sql", [
  "public.fabric_stock_reserve_v2(",
  "public.fabric_stock_consume_reservation_v2(",
  "public.fabric_stock_release_v2(",
  "historic real consumption/release changed physical or reserved metres incorrectly",
  "historic manual source was counted more than once",
]);


requireTokens("src/app/operator/stock/StockClient.tsx", [
  "manualRecordKeys.current.set(attempt.signature,attempt.requestKey)",
  'void post({action:"record",...intent,requestKey:attempt.requestKey}',
  "confirmedManualRecords.has(manualRecordSignature)",
]);

requireTokens("supabase/migrations/20261029_stock_reservation_provenance.sql", ["fabric_stock_reserve_v2","p_requested_by","p_source_reference","reservation quantity evidence reference is required","service_role"]);
requireTokens("supabase/migrations/20261030_stock_consumption_provenance.sql", ["fabric_stock_consume_reservation_v2","p_checked_by","p_source_reference","actual cloth-usage evidence reference is required","service_role"]);
requireTokens("supabase/migrations/20261031_stock_reservation_concurrency_provenance.sql", ["stock-request:","stock-reservation:","fabric_stock_release_v2","fabric_stock_reserve_v2","fabric_stock_consume_reservation_v2","reservation release reference is required","service_role"]);

requireTokens("src/lib/designer/stock-ledger.ts", [
  "normalizeStockReservation", "Locked revision ID must match exactly.",
  "Reservation request key must match exactly.",
]);
requireTokens("supabase/migrations/20261031_stock_source_audit_rpc.sql", [
  "fabric_stock_source_audit_v1", "returns jsonb",
  "from private.fabric_stock_ledger", "jsonb_build_object(",
  "revoke all on function public.fabric_stock_source_audit_v1()",
  "to service_role;",
]);
requireTokens("scripts/ci-verified-stock-fixture.cjs", [
  "AUDIT_PATH", "fabric_stock_source_audit_v1", "AUDIT_FIXTURE",
  'process.env.GITHUB_ACTIONS!=="true"||process.env.CI!=="true"',
  "Object.keys(payload).length!==0",
]);
requireTokens("scripts/verify-operator-stock-audit-http.cjs", [
  "GITHUB_ACTIONS", "signedOperatorCookie", "createHmac",
  'await unauthorized(undefined,"anonymous")',
  'await unauthorized("linen_operator_session=forged.token","forged")',
  "assert.deepEqual(data,{audit:AUDIT_FIXTURE}",
  "assert.equal(Object.keys(data.audit).length,10)",
  "READ-ONLY SOURCE AUDIT",
]);
requireTokens(".github/workflows/ci.yml", [
  "node scripts/ci-verified-stock-fixture.cjs",
  "node scripts/verify-operator-stock-audit-http.cjs",
  "LINEN_OPERATOR_SESSION_SECRET",
]);
requireTokens("src/app/api/operator/stock/audit/route.ts", [
  "verifyOperatorSession", "cache-control", "private, no-store",
  "fabric_stock_source_audit_v1", "readBoundedJsonResponse(response,8_192)",
  "verifyOperatorStockSourceAudit", "Unauthorized.",
]);
requireTokens("src/lib/designer/operator-stock-safety.ts", [
  "STOCK_SOURCE_AUDIT_KEYS", "verifyOperatorStockSourceAudit",
  "Number.isSafeInteger", "duplicateLineGroups",
]);
requireTokens("src/app/operator/stock/StockClient.tsx", [
  "Run aggregate audit", "verifyOperatorStockSourceAudit(payload.audit)",
  "auditGeneration.current++", "setSourceAudit(null)",
]);
requireTokens("scripts/ci/stock-source-audit-rpc-assertions.sql", [
  "privacy-safe operator source RPC mismatches historical aggregate audit",
  "source audit RPC grants permit non-service-role access",
]);
requireTokens("scripts/ci/verify-stock-record-db.sh", [
  "20261031_stock_source_audit_rpc.sql", "stock-source-audit-rpc-assertions.sql",
]);
requireTokens("scripts/ci/stock-reservation-source-audit.sql", [
  "BEGIN TRANSACTION READ ONLY",
  "FROM private.fabric_stock_ledger", "GROUP BY fabric_id,revision_id,source_key",
  "duplicate_lines", "missing_locked_revision", "missing_source",
  "missing_checker", "missing_request_key", "missing_reservation_uuid",
  "padded_source", "placeholder_source", "SELECT concat_ws('|',",
]);
requireTokens("scripts/ci/stock-reservation-source-audit-fixture.sql", [
  "ci-audit-fabric", "Sheet-Legacy-001-Line-1",
  "sheet-legacy-001-line-1", "TBD",
]);
requireTokens("scripts/ci/verify-stock-record-db.sh", [
  "stock-reservation-source-audit.sql", "stock-reservation-source-audit-fixture.sql",
  "Migration incorrectly installed over historic duplicate physical lines.",
  "existing duplicate meterage reservation lines require owner reconciliation",
  "Refusing stock fixture writes outside disposable GitHub Actions.",
  "Read-only legacy source audit detected synthetic conflicts",
]);
requireTokens("supabase/migrations/20261031_stock_reservation_line_dedupe.sql", [
  "existing duplicate meterage reservation lines require owner reconciliation",
  "create unique index if not exists fabric_stock_reserve_source_line_uidx",
  "fabric_id,revision_id,(lower(btrim(source_reference)))",
  "l.revision_id=p_revision_id",
  "lower(btrim(l.source_reference))=lower(btrim(p_source_reference))",
  "meterage source line already reserved for locked design and fabric",
]);
requireTokens("scripts/ci/stock-reservation-line-dedupe-assertions.sql", [
  "different locked design could not use same source sheet",
  "distinct documented source line was blocked",
  "SQL unique index allowed duplicate meterage line",
]);
requireTokens("scripts/ci/verify-stock-record-db.sh", [
  "20261031_stock_reservation_line_dedupe.sql",
  "stock-reservation-line-dedupe-assertions.sql",
  "Concurrent different-key same-line reservations must have one winner.",
]);
requireTokens("src/app/operator/stock/StockClient.tsx", [
  "Meterage sheet + documented line reference",
  "Do not invent a new line reference to bypass a duplicate.",
]);
requireTokens("supabase/migrations/20261031_stock_reservation_exact_key_evidence.sql", [
  "fabric_stock_reserve_v2", "v_existing.event_type<>'reserve'",
  "v_existing.fabric_id<>p_fabric_id",
  "v_existing.quantity_metres<>p_quantity_metres",
  "v_existing.revision_id is distinct from p_revision_id",
  "v_existing.recorded_by is distinct from p_requested_by",
  "v_existing.source_reference is distinct from p_source_reference",
  "stock reservation request key belongs to different evidence",
  "pg_advisory_xact_lock", "stock-request:", "stock-fabric:",
  "revoke all on function public.fabric_stock_reserve_v2", "service_role",
]);
requireTokens("scripts/ci/verify-stock-record-db.sh", [
  "20261031_stock_reservation_exact_key_evidence.sql",
  "stock-reservation-exact-key-assertions.sql",
  "Conflicting same-key reservations did not serialize to one winner.",
]);
requireTokens("scripts/ci/stock-reservation-exact-key-assertions.sql", [
  "identical reserve retry did not reuse its original UUID",
  "different quantity improperly reused reservation key",
  "different checker improperly reused reservation key",
  "existing physical receipt key was adopted by a reservation",
  "reserve RPC execute privileges widened",
]);

requireTokens("supabase/migrations/20261001_production_quotes_orders.sql", ["production_quote_create","production_order_create","invalid order transition","service_role"]);
requireTokens("supabase/migrations/20261002_finished_garment_qc.sql", ["finished_garment_qc_record","finished_garment_qc_list","finished-garment QC approval is required before delivery","service_role"]);
requireTokens("supabase/migrations/20261027_finished_garment_qc_provenance.sql", ["inspection_reference","finished_garment_qc_record_v2","provenance-backed finished-garment QC approval is required before delivery","service_role"]);
requireTokens("src/lib/designer/finished-garment-qc.ts", ["inspectionReference","Named inspector / checker is required","Physical inspection reference is required"]);
requireTokens("src/lib/designer/delivery-qc-approval.ts", ["hasVerifiedLatestDeliveryQc","hasVerifiedDeliveryQcOrderLineage","row.order_id.toLowerCase()!==orderId.toLowerCase()","verifiedOperatorProductionCreateId(row.inspection_id)","time>latest.time","ambiguous","latest.decision!==\"approved\"","typeof inspector===\"string\"","typeof reference===\"string\""]);

// Operator evidence must not make pre-order QC, outcome or learning-context
// rows look credible when the current order is present on the capped page.
requireTokens("src/lib/designer/production-desk-ledger.ts", [
  "validOptionalOrderLineage(value.orders,value.qcInspections,value.customerOutcomes,value.learningContexts)",
  "for(const row of qc)",
  "row.revision_id!==order.revision_id",
  "parseProductionEvidenceTimestamp(row.created_at)<parseProductionEvidenceTimestamp(order.created_at)",
]);
// Operator success-shaped mutation replies and case-equivalent SQL IDs must
// not lose customer-facing receipts or be misreported as completed work.
requireTokens("src/lib/designer/production-desk-ledger.ts", ["validProductionDeskMutationReceipt","sameProductionRecordId","sameProductionRecipeHash"]);
requireTokens("src/app/operator/production/ProductionClient.tsx", ["if(!validProductionDeskMutationReceipt(body.action,data))","sameProductionRecordId(outcome.order_id,item.order_id)","sameProductionRecipeHash(item.recipe_hash,order.recipeHash)"]);
// M99: production RPC failures must never print customer or backend exception
// objects, stack traces or request details to the operator server log.
requireTokens("src/lib/designer/operator-production-error.ts",[
  "safeOperatorProductionErrorCode", "backend_timeout",
  "backend_transport", "production_integrity_failure",
]);
requireTokens("src/app/api/operator/production/route.ts",[
  "safeOperatorProductionErrorCode(error)",
  'console.error("[operator/production:read]"',
  'console.error("[operator/production:write]"',
]);
requireTokens("src/lib/designer/production-desk-readback.ts",[
  "verifiedProductionMutationReadback", "verifiedOperatorProductionCreateId",
  'action==="create_quote"', 'action==="create_order"',
  'action==="quote_status"', 'action==="order_status"',
  "contexts.some(context=>sameId(context.order_id,id)",
  "normalizeProductionQuoteDraft", "sameCreatedQuoteFinancials(row,body)",
  'row.status!=="draft"', "paise(row.subtotal)", "paise(row.adjustment)", "paise(row.total)",
  'row.status==="created"', "matchesOperatorNote(row,body,false)",
  "matchesOperatorNote(row,body,true)",
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "if(expected&&(!data.configured||!verifiedProductionMutationReadback(",
  "expected.action,expected.body,expected.receipt,data.quotes,data.orders,data.learningContexts",
  "const confirmed=await load({action:body.action,body,receipt:data});",
  "if(confirmed){", "if(releaseProductionWriteHold(safeProductionHoldStorage(),holdToken))",
  "setMessage(success);",
]);
// M102: a lost POST acknowledgement may follow a committed mutation; only
// definite prewrite input/auth/size/rate denials may use a normal reject message.
requireTokens("src/lib/designer/production-post-retry.ts",[
  "isCertainProductionPrewriteRejection", "400,401,403,413,429",
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "certainPrewriteRejection=isCertainProductionPrewriteRejection(response.status)",
  "const refreshed=await load();",
  "The production mutation may already have been saved",
  "Do not retry until the production ledger can be inspected",
]);
// M103: a successful GET after an ambiguous write cannot prove a missing
// record on the independently capped ledger. Require human review to resume.
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "const [requiresWriteReview,setRequiresWriteReview]=useState(false)",
  "if(!configured||requiresWriteReview) return;",
  "if(!certainPrewriteRejection){",
  "setPendingWriteReview(attempt)",
  "setRequiresWriteReview(true)",
  "its exact record could not be confirmed",
  "function confirmReviewedProductionHistory()",
  "if(!requiresWriteReview||!configured||busy||actionInFlight.current)return;",
  "setRequiresWriteReview(false)",
  "Production writes paused for manual review",
  "I reviewed history — enable writes",
  'disabled={busy||!configured||requiresWriteReview||!canQuote}',
  'disabled={busy||!configured||requiresWriteReview||!lockedOrderMatches}',
  'const lockedOrderMatches=Boolean(loadedRevision)&&order.revisionId===loadedRevision?.revisionId',
  'sameProductionRecipeHash(order.recipeHash,loadedRevision?.recipeHash)',
  'disabled={busy||!configured||requiresWriteReview} defaultValue=""',
]);
// M109: a lost acknowledgement or browser crash must be reconcilable by
// original anonymous request UUID, without copying personal details. A missing
// SQL receipt may still be in flight and must not unlock further writes.
requireTokens("supabase/migrations/20261107_production_creation_receipt_lookup.sql",[
  "production_creation_request_receipt_lookup", "returns table(action text,receipt_id uuid)",
  "where r.request_key=p_request_key", "limit 2",
  "from public,anon,authenticated", "to service_role",
]);
requireTokens("src/lib/designer/production-write-hold.ts",[
  "readProductionWriteHoldKey", "storage.getItem(PRODUCTION_WRITE_HOLD_KEY)",
]);
requireTokens("src/lib/designer/production-creation-receipt-lookup.ts",[
  "parseProductionCreationReceipts", 'row.action!=="create_quote"&&row.action!=="create_order"',
  "receipt_id", "result.push({action:row.action,receiptId})",
]);
requireTokens("src/app/api/operator/production/route.ts",[
  'if(action==="creation_receipt_lookup")',
  'rpc<unknown>("production_creation_request_receipt_lookup",{p_request_key:key})',
  "parseProductionCreationReceipts(rows)", "return respond({receipts})",
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "async function lookupPendingCreationReceipt()",
  'action:"creation_receipt_lookup",requestKey:pendingKey',
  "const snapshot=captureProductionWriteReviewSnapshot(safeProductionHoldStorage())",
  "productionWriteReviewSnapshotUnchanged(safeProductionHoldStorage(),snapshot)",
  "No committed creation receipt was visible at lookup time",
  "Find original quote/order receipt by request ID",
]);
requireTokens("scripts/ci/verify-production-create-idempotency.sh",[
  "20261107_production_creation_receipt_lookup.sql",
  "production-creation-receipt-lookup-assertions.sql",
]);
requireTokens("tests/production-creation-receipt-lookup.test.ts",[
  "creation receipt lookup rejects a stale generation even with the SAME original UUID",
  "PRODUCTION_WRITE_EPOCH_KEY",
  "productionWriteReviewSnapshotUnchanged(store,old)",
]);

requireTokens("scripts/verify-production-creation-receipt-epoch-browser.cjs",[
  "M145 signed creation-receipt epoch browser QA is CI-only.",
  "COMMITTED CREATION RECEIPTS", "window.__m145Race.release()",
  "An older receipt must not be displayed for a superseded write generation.",
  "for(const width of [390,768,1440])",
]);
requireTokens(".github/workflows/ci.yml",[
  "node scripts/verify-production-creation-receipt-epoch-browser.cjs",
]);
// M108: quote and order creation must use one client-provided UUID whose
// exact intent is deduplicated atomically by private PostgreSQL, not a new
// server-generated UUID on each retry. Only the service role may execute.
requireTokens("src/lib/designer/production-request-key.ts",[
  "parseOperatorProductionRequestKey", "typeof value!==\"string\"",
]);
requireTokens("src/app/api/operator/production/route.ts",[
  "parseOperatorProductionRequestKey(body.requestKey)",
  '"production_quote_create_idempotent"',
  '"production_order_create_with_context_idempotent"',
  "p_request_key:requestKey",
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "body:JSON.stringify({...body,requestKey:holdToken})",
]);
requireTokens("supabase/migrations/20261106_production_create_request_idempotency.sql",[
  "private.production_creation_request_receipts", "primary key(action,request_key)",
  "pg_advisory_xact_lock", "sha256(convert_to(jsonb_build_object",
  "production_quote_create_idempotent",
  "production_order_create_with_context_idempotent",
  "production creation request key belongs to different quote instructions",
  "production creation request key belongs to different order instructions",
  "revoke all on private.production_creation_request_receipts from public,anon,authenticated",
  "grant execute on function public.production_quote_create_idempotent",
]);
// M107: an uncertain SQL mutation may commit even if its browser tab crashes.
// Require a token-only fail-closed local marker BEFORE POST; only a matching
// confirmed request or definite prewrite reject may release it automatically.
requireTokens("src/lib/designer/production-write-hold.ts",[
  "PRODUCTION_WRITE_HOLD_KEY", "productionWriteHoldPending",
  "beginProductionWriteHold", "releaseProductionWriteHold",
  "acknowledgeProductionWriteHold",
  "storage.getItem(PRODUCTION_WRITE_HOLD_KEY)",
  "storage.setItem(PRODUCTION_WRITE_HOLD_KEY,token)",
  "storage.removeItem(PRODUCTION_WRITE_HOLD_KEY)",
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "function safeProductionHoldStorage():Storage|null",
  "try{return window.localStorage;}",
  "productionWriteHoldPending(safeProductionHoldStorage())",
  'window.addEventListener("storage",onStorage)',
  "event.key===PRODUCTION_WRITE_HOLD_KEY||event.key===PRODUCTION_WRITE_EPOCH_KEY",
  "verifiedWriteReviewSnapshot.current=null",
  "setRecoveredCreationReceipts(null)",
  "const holdToken=crypto.randomUUID()",
  "const claimed=await beginProductionWriteHoldAtomically(",
  "if(releaseProductionWriteHold(safeProductionHoldStorage(),holdToken))",
  "acknowledgeProductionWriteHold(storage,snapshot.holdToken)",
]);
// M104: a post-write review is meaningless if the operator cannot compare
// the frozen submitted note/prices with real durable quote and order fields.
// Never carry recovery tokens or arbitrary request payloads into that panel.
requireTokens("src/lib/designer/production-review-summary.ts",[
  "productionWriteReviewSummary", "lineItems", "adjustment",
  "revisionId", "recipeHash", "quoteId", "orderId", "note",
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "const [pendingWriteReview,setPendingWriteReview]",
  "const attempt=productionWriteReviewSummary(body)",
  "setPendingWriteReview(attempt)",
  "setPendingWriteReview(null)",
  "UNCONFIRMED SUBMISSION",
  "pendingWriteReview.lineItems.map",
  "pendingWriteReview.note",
  "Saved quote lines",
  "item.line_items.map",
  "item.subtotal", "item.adjustment",
  "Saved note: {item.note",
  "Linked quote: {item.quote_id",
]);
// M106: accepted quotes are terminal; display Void only when canonical
// shared transitions (and production SQL) allow the requested change.
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  'canTransitionQuote(item.status as ProductionQuoteStatus,"void")',
]);
requireTokens("src/lib/designer/production-state.ts",[
  "accepted:[]", 'draft:["sent","void"]', 'sent:["accepted","void"]',
]);
// M105: an unconfirmed production write or stale cached React ledger must
// never be packaged as a current operator quote/order packet.
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "if(!loadedRevision||!configured||requiresWriteReview||busy||actionInFlight.current) return;",
  'await fetch("/api/operator/production",{cache:"no-store"})',
  "validProductionDeskResponse(fresh)",
  "fresh.quotes as Quote[],fresh.orders as Order[]",
  "finally{actionInFlight.current=false;setBusy(false);}",
  'disabled={!configured||requiresWriteReview||busy} onClick={()=>void exportProductionPacket()}',
]);
// A successful recovery HTTP status must not unlock operator exports or mutations
// without a locally verified immutable revision/hash, or retain an old selection.
requireTokens("src/app/operator/production/ProductionClient.tsx", [
  "verifyLockedDesignRevision(data.revision)",
  "if(!response.ok||!data?.revision||!await verifyLockedDesignRevision(data.revision))",
  'setQuote((current)=>({...current,revisionId:"",recipeHash:""}))',
  'setOrder((current)=>({...current,revisionId:"",recipeHash:"",quoteId:""}))',
]);
requireTokens("src/app/api/operator/garment-qc/route.ts", ["finished_garment_qc_record_v2","p_inspection_reference"]);
requireTokens("src/app/operator/garment-qc/GarmentQcClient.tsx", ["Finished Garment QC","Physical inspection reference","provenanceReady","Legacy inspection · provenance not recorded","Approve for delivery","Record rework","PHYSICAL CHECKS"]);
requireTokens("src/lib/designer/production-quote-order-transport.ts", [
  "safeProductionQuoteOrderRows", "validProductionDeskLedgers",
  "safeQuotes", "line_items", "label:line.label", "amount:line.amount",
]);
requireTokens("src/app/api/operator/production/route.ts", [
  "safeProductionQuoteOrderRows(quotes,orders)",
  "quotes:safeLedger.quotes,orders:safeLedger.orders",
]);
requireTokens("scripts/ci-verified-stock-fixture.cjs", [
  "PRODUCTION_LISTS", "QUOTE_LIST_PATH", "ORDER_LIST_PATH",
  "DO-NOT-LEAK-CI-LINE-ITEM", "DO-NOT-LEAK-CI-QUOTE",
]);
requireTokens("scripts/verify-production-ledger-private-http.cjs", [
  "signed operator", "assertPrivate(response)",
  "DO-NOT-LEAK-CI-", "PRODUCTION_LISTS",
  "private_supplier_rate", "secret_factory_cost", "expired",
]);
requireTokens(".github/workflows/ci.yml", [
  "node scripts/verify-production-ledger-private-http.cjs",
]);
requireTokens("src/app/api/operator/production/route.ts", ["finished_garment_qc_list","production_order_deliver_idempotent","production_order_set_status_idempotent","production_customer_outcome_list","customerOutcomes","production_order_learning_context_list","learningContexts","loadVerifiedLockedRevision","A valid locked-design recovery token is required","verified locked design does not match the quote revision/hash","verified locked design does not match the order revision/hash","parseDesignVaultRecoveryToken","verifyLockedDesignRevision","buildProductionLearningContext","production_order_create_with_context","learningContextAttached","lockedRevisionVerified"]);
requireTokens("supabase/migrations/20261003_production_delivery_evidence.sql", ["production_delivery_evidence_record","production_delivery_evidence_list","delivery evidence can only be recorded for a delivered order","service_role"]);
requireTokens("src/lib/designer/production-delivery-evidence.ts", ["PRODUCTION_REENTRY_FIELDS","summarizeProductionDeliveryEvidence","gateComplete","reentryIncidentCount"]);
requireTokens("src/app/operator/production-evidence/ProductionEvidenceClient.tsx", ["Zero-Reentry Proof","FIRST 10 AUDITED","ZERO RE-ENTRY","Save immutable completion audit"]);
requireTokens("supabase/migrations/20261004_meterage_calibration_registry.sql", ["production_meterage_model_create","production_meterage_model_approve","at least 20 real cut cases are required before approval","service_role"]);
requireTokens("supabase/migrations/20261028_verified_meterage_cut_evidence.sql", ["production_meterage_model_create_v2","production_meterage_model_approve_v2","production_usage_case","every meterage evidence case must resolve","20 verified unambiguous real cut cases","service_role"]);
requireTokens("supabase/migrations/20261029_meterage_cut_provenance_gate.sql", ["production_meterage_model_create_v3","production_meterage_model_approve_v3","production-usage-v2","checkedBy","evidenceReference","20 provenance-backed real cuts","service_role"]);
requireTokens("supabase/migrations/20261030_production_cut_evidence_registry.sql", ["production_cut_evidence","production_cut_evidence_record","production_cut_evidence_list","production_meterage_model_create_v4","production_meterage_model_approve_v4","durable locked-design production context","cut fabric does not match","distinct provenance-backed real production cuts","service_role"]);
requireTokens("src/lib/designer/meterage-calibration.ts", ["normalizeMeterageCalibrationDraft","normalizeProductionCutEvidenceDraft","verifiedMeterageEvidenceCase","meterageForWidth","canApproveMeterageModel"]);
requireTokens("src/app/api/operator/production-calibration/route.ts", ["normalizeProductionCutEvidenceDraft","production_cut_evidence_record","production_cut_evidence_list","p_order_id","p_evidence_reference"]);
requireTokens("src/app/operator/production-calibration/ProductionCalibrationClient.tsx", ["Production order ID","Checked by","Physical evidence reference","/api/operator/production-calibration"]);
requireTokens("src/app/operator/meterage-model/MeterageModelClient.tsx", ["Meterage Registry","production-cut registry","Approve + activate","requires ≥20 real"]);
requireTokens("src/app/api/operator/meterage-model/route.ts", ["evidenceCaseIds","production_cut_evidence_list","production-order-backed real cut cases","production_meterage_model_create_v4","production_meterage_model_approve_v4"]);
requireTokens("supabase/migrations/20261005_launch_readiness_evidence.sql", ["launch_beta_attempt_record","launch_checklist_event_record","No customer names","service_role"]);
requireTokens("src/lib/designer/launch-readiness-evidence.ts", ["LAUNCH_BETA_TARGET=5","LAUNCH_CHECKLIST_ITEMS","summarizeLaunchReadiness","launchEvidenceComplete"]);
requireTokens("src/app/operator/launch-readiness/LaunchReadinessClient.tsx", ["Launch Evidence","PRIVATE BETA","HUMAN LAUNCH CHECKLIST","deployment readiness is still a separate gate"]);
requireTokens("src/app/api/operator/launch-readiness/route.ts", ["normalizeBetaAttempt","normalizeLaunchChecklistDecision","launch_beta_attempt_record","launch_checklist_event_record"]);
requireTokens("src/app/operator/phase10-readiness/Phase10ReadinessClient.tsx", ["private-beta-launch-signoff","/operator/launch-readiness","human sign-offs remain","provenanceReadyStock","legacyStockEvents","Live physical stock provenance"]);
requireTokens("next.config.ts", ["Strict-Transport-Security","X-Frame-Options","Cross-Origin-Opener-Policy"]);
requireTokens("src/app/api/designer/look-render/route.ts", ["recordRenderOutcome","repair:true"]);
requireTokens("src/app/api/designer/look-inspect/route.ts", ["attachRenderQa","jobId"]);
requireTokens("src/lib/designer/render-outcome-metrics.ts", ["summarizeRenderOutcomes","creditsPerApproved","approvalRate","summarizeRenderPatternCalibrations","scale_error_pct"]);
requireTokens("src/app/operator/render-qa/RenderQaClient.tsx", ["Final Render QA","Add measured pattern check","APPROVAL RATE","CREDITS / APPROVED","PATTERN SCALE QA","CROSS-VIEW IDENTITY","Record owner-approved credit cap","Approve manual review workflow"]);
requireTokens("supabase/migrations/20261001_render_outcomes.sql", ["designer_render_outcome_record","designer_render_outcome_review","designer_render_pattern_calibration_record","service_role"]);
requireTokens("src/lib/designer/render-release-evidence.ts", ["summarizeCrossViewIdentity","evaluateRenderCreditCap","evaluateFinalRenderReleaseEvidence","FINAL_RENDER_REVIEW_TARGET","FINAL_RENDER_APPROVAL_TARGET_PERCENT","patternGateComplete","manualReviewGateComplete","totalGates:5","eligibleConcepts","withinCap"]);
requireTokens("src/app/operator/render-qa/RenderQaClient.tsx", ["PATTERN RELEASE COVERAGE","patternCoverageSummary","referenceMm","referencePx","observedRepeatPx","pixel_fixture_v2"]);
requireTokens("src/app/api/operator/render-qa/route.ts", ["patternCoverageSummary","patternEvidenceByFabric","expectedRepeatByFabric","summarizeApprovedPatternCalibrationCoverage","patternedFabricIds","referenceMm","referencePx","observedRepeatPx","Reviewed physical repeat evidence is required"]);
requireTokens("src/lib/designer/render-outcome-metrics.ts", ["deriveObservedRepeatMmFromFixture","summarizeApprovedPatternCalibrationCoverage","expectedRepeatByFabric","missingTruthPairs","staleCalibrationPairs","legacyCalibrationPairs","measurement_method","pixel_fixture_v2","requiredPairs","passedPairs","gateComplete"]);
requireTokens("src/app/operator/phase10-readiness/Phase10ReadinessClient.tsx", ["Final render release evidence","evaluateFinalRenderReleaseEvidence","identitySummary","creditCapSummary"]);
requireTokens("supabase/migrations/20261007_render_release_evidence.sql", ["designer_render_identity_review_record","designer_render_credit_cap_record","at least two rendered views","service_role"]);
requireTokens("src/lib/designer/render-outcomes.ts", ["designer_render_pattern_calibration_record_v2","designer_render_pattern_calibration_list_v2","referenceMm","referencePx","observedRepeatPx"]);
requireTokens("supabase/migrations/20261018_render_pattern_fixture_evidence.sql", ["designer_render_pattern_calibration_record_v2","designer_render_pattern_calibration_list_v2","pixel_fixture_v2","reference_mm","reference_px","observed_repeat_px","service_role"]);
requireTokens("supabase/migrations/20261023_render_manual_review_signoff.sql", ["designer_render_manual_review_signoff_record","designer_render_manual_review_signoff_latest","service_role"]);


requireTokens("src/app/api/homepage-model/route.ts", [
  "FASHN_API_KEY",
  "model-create",
  "status",
  "X-Linen-Render",
  "/designer/studio-tucked.webp",
]);
requireTokens("desktop/src-tauri/tauri.conf.json", ["\"version\": \"1.0.0\"", "\"productName\": \"Linen Earth OS\""]);
requireTokens("desktop/package.json", ["\"version\": \"1.0.0\""]);
requireTokens("desktop/src-tauri/Cargo.toml", ["version = \"1.0.0\""]);
requireTokens("desktop/src/App.tsx", [
  "Ctrl K",
  "+ New walk-in",
  "operatorTour",
  "MEASUREMENT PASSPORT",
  "PAYMENT HISTORY",
]);
requireTokens(".github/workflows/ci.yml", ["concurrency:","github.event.pull_request.number || github.ref","cancel-in-progress: true"]);
requireTokens(".github/workflows/build-linen-earth-os.yml", [
  "npm run desktop:build",
  "SHA256SUMS.txt",
  "actions/upload-artifact@v4",
  "nsis/*.exe",
]);
requireTokens("supabase/migrations/20260920_style_events_hardening.sql", [
  "enable row level security",
  "grant select, insert on table public.style_events to service_role",
  "select 5;",
  "linen_cloud_health",
]);
requireTokens("scripts/check-cloud-readiness.mjs", [
  "fabric_stock_snapshot",
  "fabric_stock_snapshot_v2",
  "production_quote_list",
  "production_order_list",
  "production_delivery_evidence_list",
  "production_first_ten_delivery_audit",
  "production_meterage_model_list",
  "production_cut_evidence_list",
  "launch_beta_attempt_list",
  "launch_checklist_event_list",
  "designer_locked_revision_vault_get",
  "measurement_profile_vault_get",
  "production_quote_list_owned",
  "production_quote_list_owned_v2",
  "production_quote_accept_owned",
  "production_order_list_owned",
  "production_order_event_list_owned",
  "production_customer_outcome_list_owned",
  "production_customer_outcome_list",
  "production_customer_outcome_review_list",
  "production_customer_outcome_policy_list",
  "production_order_learning_context_list",
  "production_customer_outcome_learning_list",
  "fabric_physical_color_check_list",
  "style_director_user_test_list",
  "style_director_validation_signoff_list",
  "house_ease_evidence_list",
  "house_ease_model_list",
  "designer_novice_attempt_list",
  "designer_novice_study_decision_list",
  "designer_render_outcome_list",
  "designer_render_pattern_calibration_list",
  "designer_render_identity_review_list",
  "designer_render_credit_cap_latest",
  "designer_render_manual_review_signoff_latest",
  "roadmap_v2_evidence_health",
  "Apply Roadmap v2 Supabase migrations",
]);

requireTokens(".env.example", [
  "FASHN_API_KEY=",
  "SUPABASE_URL=",
  "SUPABASE_SECRET_KEY=",
  "LINEN_OPERATOR_SYNC_TOKEN=",
  "LINEN_OPERATOR_PASSWORD_HASH=",
  "LINEN_OPERATOR_SESSION_SECRET=",
  "LINEN_MEMORY_SESSION_SECRET=",
  "LINEN_CUSTOMER_SESSION_SECRET=",
  "SUPABASE_ANON_KEY=",
  "AI_GATEWAY_API_KEY=",
  "LINEN_VISUAL_CRITIC_MODEL=",
  "LINEN_RESEARCH_MODEL=",
  "LINEN_GARMENT_MODEL_SRC=",
]);

if (!failed) ok("Static website, desktop, cloud and installer release contracts are intact.");

if (live) {
  const base = process.env.RELEASE_URL?.trim()?.replace(/\/$/, "");
  if (!base) {
    fail("RELEASE_URL is required for --live checks.");
  } else {
    try {
      const response = await fetch(`${base}/api/homepage-model?status=1`, { cache: "no-store" });
      if (!response.ok) {
        fail(`Homepage model health returned HTTP ${response.status}.`);
      } else {
        const health = await response.json();
        // Paid renders are opt-in. The normal homepage uses the fixed Studio photo
        // and must remain launchable with no generative API key.
        if (!health || typeof health.configured !== "boolean" || health.provider !== "fashn")
          fail("Optional homepage render status contract is invalid.");
        else if (!health.configured)
          warn("Optional FASHN is not configured; canonical Studio homepage needs no paid render.");
        else ok(`Optional FASHN render route configured (${health.provider} / ${health.model || "model"}).`);
      }
    } catch (error) {
      fail(`Live homepage model check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const cloud = spawnSync(process.execPath, ["scripts/check-cloud-readiness.mjs"], {
    stdio: "inherit",
    env: process.env,
  });
  if (cloud.status !== 0) fail("Cloud readiness check failed.");
  else ok("Cloud readiness check passed.");
} else {
  warn("Optional image-provider status and live Supabase checks are skipped. Run npm run release:check:live with RELEASE_URL and production env vars before launch.");
}


requireTokens("src/components/CreativeStudioPanel.tsx",["03 / CREATE","Create ideas ✦","creativePlacementSvg","PLACEMENT ILLUSTRATION · SCALE PROPOSED","Reasoning and sample checks","Reset creative learning"]);
requireTokens("src/app/api/designer/creative-profile/route.ts",["getCustomerIdentity","body.owner!==identity.id","resetAt","context.preferences.enabled"]);
requireTokens("src/lib/designer/research-refresh-server.ts",["claim.duplicate","paidModelCalls:0","contentHash:hash","pending_review"]);
requireTokens("src/app/api/cron/designer-research/route.ts",["CRON_SECRET","timingSafeEqual"]);

// Public Designer POST handlers must enforce the same bounded streamed JSON
// transport as privileged recovery/production writes, including chunked bodies.
requireTokens("src/lib/secure-json-request.ts", ["readSecureJsonObject","secureJsonRequestError","SecureJsonBodyInvalid","SecureJsonBodyTooLarge"]);
for(const kind of ["assess","search","brief"]) {
  requireTokens(`src/app/api/designer/${kind}/route.ts`, [
    "secureJsonRequestError(request,","readSecureJsonObject(request,",
    "error instanceof SecureJsonBodyInvalid","error instanceof SecureJsonBodyTooLarge",
  ]);
}


/* Draft-stack reconciliation: prohibit silent loss of the production/vault safety boundary. */
requireTokens("src/app/api/designer/vault/route.ts", ["secureJsonRequestError(request,98304)","readSecureJsonObject(request,98304)"]);
requireTokens("src/app/api/measurements/vault/route.ts", ["secureJsonRequestError(request,16384)","readSecureJsonObject(request,16384)"]);
requireTokens("src/app/api/operator/production/route.ts", ["secureJsonRequestError(request,65536)","readSecureJsonObject(request,65536)"]);
// J5: every operator production and QC receipt, including 401/409/503,
// must bypass shared caches; both browser lanes exercise actual 401 headers.
requireTokens("src/app/api/operator/production/route.ts", ["function respond(body:unknown,status=200)","private, no-store","pragma","return respond(receipt)"]);
requireTokens("src/app/api/operator/garment-qc/route.ts", ["function respond(body:unknown,status=200)","private, no-store","pragma","return respond({configured:true,orders,inspections})"]);
requireTokens("scripts/verify-operator-private-response-headers.cjs", ["/api/operator/production","/api/operator/garment-qc","no-store","Unauthorized."]);
requireTokens(".github/workflows/ci.yml", ["node scripts/verify-operator-private-response-headers.cjs"]);
requireTokens(".github/workflows/deep-engine-non3d.yml", ["node scripts/verify-operator-private-response-headers.cjs"]);

requireTokens("src/app/api/operator/production-evidence/route.ts", ["secureJsonRequestError(request,16384)","readSecureJsonObject(request,16384)"]);
requireTokens("src/lib/designer/production-delivery-evidence.ts", ["orderLineage.set(key,","evidence.recipe_hash!==lineage.hash","evidenceIds.has(evidenceId)"]);
requireTokens("scripts/check-cloud-readiness.mjs", ["orderLineageById.set(key,","row.recipe_hash===lineage.recipeHash","seenEvidenceIds.has(evidenceId)"]);

// Public design handoffs carry the same bounded source security as the
// private recovery vault. A prepared WhatsApp link is not a delivered enquiry.
requireTokens("src/lib/designer/locked-handoff-request.ts",[
  "LOCKED_HANDOFF_JSON_MAX_BYTES","readSecureJsonObject(request,LOCKED_HANDOFF_JSON_MAX_BYTES)",
  "secureJsonRequestError(request,LOCKED_HANDOFF_JSON_MAX_BYTES)",
  "vaultRateBlocked(handoffRequests,ip)","verifiedLockedHandoffAuditId",
]);
requireTokens("src/app/api/designer/share/route.ts",[
  "readLockedHandoffRequest(request)","parseConsentedShareIntent(parsed.revision)",
  "verifyLockedDesignRevision(revision)","parseDesignVaultRecoveryToken(intent.recoveryToken)",
  "getCustomerIdentity(request)","designer_locked_revision_vault_get_owned",
  "designer_locked_revision_vault_get","selectVaultReadRow(ownedResult)",
  "selectVaultReadRow(tokenResult)","sameLockedEnquiryRevision(revision,owned.payload",
  "readBoundedJsonResponse(response,maxBytes)",
  "verifiedLockedHandoffAuditId(await rpc(\"design_share_audit_record\"",
  "if(!auditId) return privateJson","createDesignShareToken(verified)",
  "audited:true,auditId,ownerVerified:true","cache-control","private, no-store",
]);
requireTokens("src/lib/designer/share-intent.ts",[
  "consentToShare !== true","typeof input.recoveryToken !== \"string\"",
]);
requireTokens("src/components/DesignerModule.tsx",[
  "checked={shareConsent}","disabled={shareBusy||!shareConsent||!vaultAccountOwned||!vaultRecoveryToken}",
  "consentToShare:true,recoveryToken:vaultRecoveryToken",
  "result.ownerVerified!==true","result.audited!==true","shareGenerationRef.current!==generation",
]);
// Owner-scoped recovery and token-scoped recovery must BOTH verify the lock
// before a receipt can be called an authenticated customer enquiry intent.
requireTokens("src/app/api/designer/enquiry/route.ts",[
  "readLockedHandoffRequest(request)","parseEnquiryIntent(parsed.revision)",
  "designer_locked_revision_vault_get_owned","designer_locked_revision_vault_get",
  "selectVaultReadRow(ownedResult)","selectVaultReadRow(tokenResult)",
  "sameLockedEnquiryRevision(intent.revision",
  "readBoundedJsonResponse(response,256 * 1024)",
  "verifiedLockedHandoffAuditId(await rpc(\"design_enquiry_audit_record\"",
  "operatorReceived:false","handoffStatus:\"prepared_not_sent\"",
]);
requireTokens("src/lib/designer/enquiry-intent.ts",[
  "consentToContact !== true","legacy_draft","sameLockedEnquiryRevision",
]);
requireTokens("scripts/verify-designer-enquiry.cjs",[
  "cross-site origin","unconsented envelope","oversized JSON body",
]);
requireTokens("src/components/DesignerModule.tsx",[
  "checked={enquiryConsent}","disabled={enquiryBusy||!enquiryConsent}",
  "enquiryGenerationRef.current+=1","enquiryGenerationRef.current!==generation",
  "consentToContact:true","vaultAccountOwned&&vaultRecoveryToken",
  "result.status===\"intent_recorded\"","result.operatorReceived!==false",
  "result.handoffStatus!==\"prepared_not_sent\"","result.revisionId!==revision.revisionId",
  "enquiryResult?.revisionId===verifiedLockedRevision.revisionId",
  "Open WhatsApp and send","destination.hostname!==\"wa.me\"",
]);

// Operator quotes and orders must refer to exactly one live recovered lock.
requireTokens("src/lib/designer/operator-locked-selection.ts",[
  "parseOperatorLockedSelection","typeof input.revisionId","typeof input.recipeHash",
  "typeof input.recoveryToken","note.length>1000","quoteId.length>180",
]);
requireTokens("src/app/api/operator/production/route.ts",[
  "selectVaultReadRow(rows)","parseOperatorLockedSelection(body)",
  "verifyLockedDesignRevision(revision)","production_quote_create","production_order_create_with_context",
]);

// An exported production packet may only attach the quote explicitly linked
// by its order receipt; never guess from a shared locked-recipe hash.
requireTokens("src/lib/designer/production-desk-ledger.ts",[
  "export function selectProductionPacketRecords",
  "sameProductionRecordId(row.quote_id,order.quote_id)",
  "Multiple production orders share this locked recipe",
  "Multiple quotes share this locked recipe",
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "selectProductionPacketRecords(",
  "fresh.quotes as Quote[],fresh.orders as Order[]",
]);


 // React busy state alone cannot stop two same-render operator mutations.
 // Require a synchronous guard shared by quote/order writes and vault recovery.
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "useRef","const actionInFlight=useRef(false)",
  "if(busy||actionInFlight.current) return;",
  "if(!recoveryToken.trim()||busy||actionInFlight.current) return;",
  "actionInFlight.current=true;",
  "finally{actionInFlight.current=false;setBusy(false);}",
]);


// An older operator GET must not repopulate stale quote/QC evidence after
// a mutation, failed refresh or later verified ledger response.
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "const [configured,setConfigured]=useState(false)",
  "const ledgerReadVersion=useRef(0)",
  "const readVersion=++ledgerReadVersion.current",
  "if(readVersion!==ledgerReadVersion.current) return false;",
  "ledgerReadVersion.current+=1;",
  "if(!configured||requiresWriteReview) return;",
  "if(!loadedRevision||!configured||requiresWriteReview||busy||actionInFlight.current) return;",
  "disabled={busy||!configured||requiresWriteReview}",
]);

 
// M133: A React state update is not a synchronous safety barrier. An in-flight
// production history refresh must immediately revoke all mutation/review and
// packet permissions, including within the same browser event turn.
requireTokens("src/lib/designer/production-ledger-generation.ts",[
  "isCurrentVerifiedProductionLedger", "Number.isSafeInteger(latestReadVersion)",
  "verifiedReadVersion === latestReadVersion",
  "renderedReadVersion === latestReadVersion",
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "const verifiedLedgerReadVersion=useRef(0)",
  "const [renderedLedgerReadVersion,setRenderedLedgerReadVersion]=useState(0)",
  "setRenderedLedgerReadVersion(data.configured?readVersion:0)",
  "verifiedLedgerReadVersion.current=0",
  "verifiedLedgerReadVersion.current=data.configured?readVersion:0",
  "if(!hasCurrentVerifiedLedger()) return;",
  "if(!hasCurrentVerifiedLedger())return;",
  "const packetLedgerVersion=ledgerReadVersion.current",
  "ledgerReadVersion.current!==packetLedgerVersion",
]);
requireTokens("tests/production-ledger-generation.test.ts",[
  "refresh started before React commits disabled controls",
  "operator review, mutations and packet export",
]);
requireTokens("scripts/verify-production-ledger-refresh-barrier-browser.cjs",[
  "GITHUB_ACTIONS", "CI", "127.0.0.1",
  "refresh.click();", "acknowledge.click();",
  "sameTurnAcknowledgementBlocked:true", "productionPosts:0",
]);
requireTokens(".github/workflows/ci.yml",[
  "node scripts/verify-production-ledger-refresh-barrier-browser.cjs",
]);

// M80: Human customer outcome/review/policy ledgers must never forward raw
// service-role fields or make malformed latest evidence count as accepted.
requireTokens("src/lib/designer/customer-outcome-review-transport.ts",[
  "safeOutcomeReviewEvidence", "Invalid or oversized customer learning evidence.",
  "minimum_approved_cases", "learning_context:exactContext",
  "CUSTOMER_OUTCOME_RATINGS.some", "CUSTOMER_FIT_RESULTS.some",
  'if(!worn&&fit!=="not_checked")',
  "Adverse customer fit evidence requires a recorded reason.",
  "decision:r.decision",
  'outcome_id:recordId(o.outcome_id,"outcome")',
  'order_id:recordId(o.order_id,"order")',
  'review_id:recordId(r.review_id,"review")',
  'outcome_id:recordId(r.outcome_id,"review outcome")',
  'policy_id:recordId(p.policy_id,"policy")',
  "Customer rejected review requires a reason.",
  "Customer policy needs a named approver and documented reason.",
]);
requireTokens("src/app/api/operator/customer-outcomes/route.ts",[
  "readBoundedJsonResponse(response,maxBytes)",
  "safeOutcomeReviewEvidence(rawOutcomes,rawReviews,rawPolicies)",
  'return respond({error:"Unauthorized."},401)',
  'return respond({error:"Customer outcome evidence could not be loaded."},503)',
]);
requireTokens("scripts/ci-verified-stock-fixture.cjs",[
  "OUTCOME_LEARNING_PATH","OUTCOME_REVIEW_PATH","OUTCOME_POLICY_PATH",
  "DO-NOT-LEAK-CI-OUTCOME-NESTED",
]);
requireTokens("scripts/verify-customer-outcome-review-private-http.cjs",[
  "OUTCOME_REVIEW_FIXTURE","data.summary.gateComplete,false",
  'data.reviews[0].decision,"rejected"',
  "DO-NOT-LEAK-CI-",
]);
requireTokens(".github/workflows/ci.yml",[
  "node scripts/verify-customer-outcome-review-private-http.cjs",
]);

// M79: nested immutable design learning context must not expose arbitrary
// future SQL or nested metadata fields while preserving approved recipe truth.
requireTokens("src/lib/designer/production-learning-transport.ts",[
  "safeProductionLearningContexts","PRODUCTION_LEARNING_CONTEXT_VERSION",
  "source.styleSchemaVersion!==2","treatmentIds",
  "Invalid production learning context object.",
]);
requireTokens("src/app/api/operator/production/route.ts",[
  "validProductionDeskResponse(originalReceipt)",
  "learningContexts:safeProductionLearningContexts(contexts.rows)",
  "validProductionDeskResponse(receipt)",
]);
requireTokens("scripts/ci-verified-stock-fixture.cjs",[
  "LEARNING_CONTEXT_LIST_PATH","LEARNING_CONTEXT_LISTS",
  "DO-NOT-LEAK-CI-LEARNING-SOURCE",
]);
requireTokens("scripts/verify-production-ledger-private-http.cjs",[
  "LEARNING_CONTEXT_LISTS","contextRow.context.creative.treatmentIds",
  "private_roll_supplier","DO-NOT-LEAK-CI-",
]);

// M78: operator customer outcomes must not leak new SQL fields or misrepresent
// genuine adverse fit as a successful, physically verified delivery.
requireTokens("src/lib/designer/production-outcome-transport.ts",[
  "safeProductionCustomerOutcomes","Unverified customer outcome ledger.",
  "Malformed customer outcome evidence.","overall_rating:row.overall_rating",
  "fit_result:row.fit_result","worn_confirmed:row.worn_confirmed",
]);
requireTokens("src/app/api/operator/production/route.ts",[
  "validProductionDeskResponse(originalReceipt)",
  "customerOutcomes:safeProductionCustomerOutcomes(outcomes.rows)",
  "validProductionDeskResponse(receipt)",
]);
requireTokens("scripts/ci-verified-stock-fixture.cjs",[
  "CUSTOMER_OUTCOME_LIST_PATH","CUSTOMER_OUTCOME_LISTS",
  "DO-NOT-LEAK-CI-OUTCOME","needs_work","major_alteration",
]);
requireTokens("scripts/verify-production-ledger-private-http.cjs",[
  "CUSTOMER_OUTCOME_LISTS","outcome.overall_rating",
  "outcome.fit_result","private_customer_contact",
  "DO-NOT-LEAK-CI-",
]);

// M77: operator QC physical receipts must never forward future private SQL
// columns; validate full upstream evidence before filtering for browser.
requireTokens("src/app/api/operator/production/route.ts",[
  "validProductionDeskResponse(originalReceipt)",
  "safeProductionQcRows(qc.rows)",
  "validProductionDeskResponse(receipt)",
]);
requireTokens("src/lib/designer/production-qc-transport.ts",[
  "FINISHED_GARMENT_QC_CHECKS","FINISHED_GARMENT_QC_DEFECTS",
  "Unexpected optional QC check.","Unexpected optional QC defect.",
]);
requireTokens("scripts/ci-verified-stock-fixture.cjs",[
  "QC_LIST_PATH","DO-NOT-LEAK-CI-QC",
]);
requireTokens("scripts/verify-production-ledger-private-http.cjs",[
  "data.qcInspections.length,1","private_customer_phone",
  "DO-NOT-LEAK-CI-",
]);

// M71: Physical receipt source-line uniqueness must be tested in REAL
// disposable PostgreSQL; textual source references do not prove supplier stock.
requireTokens("supabase/migrations/20261031_stock_receipt_source_line_dedupe.sql",[
  "existing duplicate physical receipt source lines require owner reconciliation",
  "create unique index if not exists fabric_stock_receipt_source_line_uidx",
  "lower(btrim(source_reference))",
  "physical receipt source line already recorded for fabric",
  "stock-fabric:", "return v_existing.event_id",
  "revoke all on function public.fabric_stock_record_v3",
  "service_role",
]);
requireTokens("scripts/ci/stock-receipt-source-audit.sql",[
  "BEGIN TRANSACTION READ ONLY", "duplicate_lines",
  "missing_source", "missing_checker", "missing_request_key",
  "padded_source", "placeholder_source", "SELECT concat_ws('|',",
]);
requireTokens("scripts/ci/stock-receipt-source-audit-fixture.sql",[
  "ci-receipt-audit-fabric", "Supplier-001-Line-1",
  "supplier-001-line-1", "TBD",
]);
requireTokens("scripts/ci/stock-receipt-source-line-assertions.sql",[
  "different-key duplicate receipt unexpectedly succeeded",
  "direct duplicate receipt bypassed natural-key index",
  "distinct receipt line rejected", "distinct fabric receipt rejected",
]);
requireTokens("scripts/ci/verify-stock-record-db.sh",[
  "20261031_stock_receipt_source_line_dedupe.sql",
  "stock-receipt-source-audit-fixture.sql",
  "stock-receipt-source-audit.sql",
  "existing duplicate physical receipt source lines require owner reconciliation",
  "stock-receipt-source-line-assertions.sql",
  "Concurrent different-key same-line receipts must have one winner.",
  "Refusing stock fixture writes outside disposable GitHub Actions.",
]);


// M110: lost quote-status acknowledgements must not duplicate transition
// events when the original anonymous request UUID is replayed.
requireTokens("src/app/api/operator/production/route.ts",[
  'if(action==="quote_status")', "production_quote_set_status_idempotent",
  "parseOperatorProductionRequestKey(body.requestKey)", "p_request_key:requestKey",
]);
requireTokens("supabase/migrations/20261108_production_quote_status_idempotency.sql",[
  "pg_advisory_xact_lock", "production_quote_status_request_receipts",
  "v_updated:=public.production_quote_set_status", "quote status request key belongs to different instructions",
  "from public,anon,authenticated", "to service_role",
]);
requireTokens("scripts/ci/verify-production-create-idempotency.sh",[
  "20261108_production_quote_status_idempotency.sql",
  "production-quote-status-idempotency-assertions.sql",
]);

// M111: only non-delivery order transitions are replay-safe under the
// original browser UUID. Physical delivery still needs transactional QC.
requireTokens("src/app/api/operator/production/route.ts",[
  'if(action==="order_status")', "production_order_set_status_idempotent",
  "parseOperatorProductionRequestKey(body.requestKey)", "p_request_key:requestKey",
  'status==="delivered"', "production_order_deliver_idempotent",
]);
requireTokens("supabase/migrations/20261109_production_order_status_idempotency.sql",[
  "pg_advisory_xact_lock", "production_order_status_request_receipts",
  "v_updated:=public.production_order_set_status",
  "order status request key belongs to different instructions",
  "delivery requires separate transactional QC verification",
  "from public,anon,authenticated", "to service_role",
]);
requireTokens("scripts/ci/verify-production-create-idempotency.sh",[
  "20261109_production_order_status_idempotency.sql",
  "production-order-status-idempotency-assertions.sql",
]);

// M112: every delivered transition must pass through the canonical SQL QC
// gate, including direct service-role calls; browser capped reads do not prove
// physical provenance. Exact original-key replays use a private SQL receipt.
requireTokens("supabase/migrations/20261110_delivery_qc_sql_gate.sql",[
  "for update","ambiguous latest QC inspection","six exact passing physical QC checks",
  "v_latest_recipe is distinct from v_order_recipe",
  "v_latest_created<v_order_created","to service_role",
]);
requireTokens("supabase/migrations/20261111_delivery_idempotency.sql",[
  "production_delivery_request_receipts","pg_advisory_xact_lock",
  "production_order_set_status(p_order_id,'delivered',p_note)",
  "delivery key belongs to different instructions","to service_role",
]);

// M113: PostgreSQL now() is transaction-start time, not QC insertion order.
// An order-locked monotonically incremented sequence, including direct DB
// inserts under the trigger, is the authoritative latest physical receipt.
requireTokens("supabase/migrations/20261112_finished_garment_qc_sequence.sql",[
  "qc_latest_sequence bigint not null default 0",
  "inspection_sequence bigint",
  "finished_garment_qc_order_sequence_unique",
  "before insert on private.finished_garment_qc_inspections",
  "set qc_latest_sequence=qc_latest_sequence+1",
  "new.created_at:=clock_timestamp()",
]);
requireTokens("supabase/migrations/20261113_delivery_qc_sequence_gate.sql",[
  "inspection_sequence desc nulls last,created_at desc",
  "v_latest_sequence is null or v_latest_sequence is distinct from v_order_sequence",
  "fresh sequenced QC inspection required for delivery",
  "six exact passing physical QC checks required before delivery",
  "ambiguous latest QC inspection",
]);
requireTokens("scripts/ci/verify-production-create-idempotency.sh",[
  "m113-legacy-qc-fixture.sql",
  "20261112_finished_garment_qc_sequence.sql",
  "20261113_delivery_qc_sequence_gate.sql",
  "m113-qc-sequence-assertions.sql",
]);

// M114: advisory UI delivery option is sourced from a snapshot of the actual
// M113 SQL QC proof, never from independently capped timestamp-only histories.
// A missing/forged/old receipt hides the option; the write gate remains atomic.
requireTokens("supabase/migrations/20261114_delivery_eligibility_read.sql",[
  "production_delivery_eligibility_list", "q.inspection_sequence=o.qc_latest_sequence",
  '"recipe_match":true', '"clean_damage_free":true',
  "from public,anon,authenticated", "to service_role",
]);
// M118: verify every nested operator API keeps async session checks awaited.
// The new SQL eligibility endpoint previously treated Promise<boolean> as a
// truthy authorization guard. This audit scans all operator route.ts files.
requireTokens("tests/operator-async-auth-route-audit.test.ts",[
  'const ROOT="src/app/api/operator"',
  "async function", "unsafeOperatorAuthLines",
  "readdirSync", "line.matchAll", "const directAwait",
  "unawaited direct and wrapped guards",
]);

// M119: production history loads without awaiting optional SQL eligibility.
// Delivery remains hidden until newest-generation SQL receipt is validated.
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  'const response=await fetch("/api/operator/production",{cache:"no-store"})',
  'setOrders(data.orders as Order[])',
  'void (async()=>{',
  'fetch("/api/operator/production/delivery-eligibility",{cache:"no-store"})',
  'if(readVersion===ledgerReadVersion.current)setDeliveryEligibility(rows)',
  'setDeliveryEligibility([])',
]);
requireTokens("tests/production-nonblocking-qc-hint.test.ts",[
  "await Promise", "ledgerCommit", "hintFetch",
  "readVersion===ledgerReadVersion", "production_order_deliver_idempotent",
]);

// M122: physical QC rows are immutable evidence, including historic receipts.
// A new inspection is the only correction path; no backdated signoff edits.
requireTokens("supabase/migrations/20261115_finished_garment_qc_immutable.sql",[
  "before update or delete on private.finished_garment_qc_inspections",
  "before truncate on private.finished_garment_qc_inspections",
  "private.reject_finished_garment_qc_mutation()", "errcode='55000'",
]);
requireTokens("scripts/ci/verify-production-create-idempotency.sh",[
  "run_file supabase/migrations/20261115_finished_garment_qc_immutable.sql",
  "run_file scripts/ci/m122-qc-immutability-assertions.sql",
]);
requireTokens("tests/production-qc-immutability.test.ts",[
  "M122 physical QC evidence", "M122 disposable SQL tests",
  "M122 staging requires explicit owner approval",
]);

// M123: audit ACTUAL installed QC SQL and immutable trigger configuration,
// not only source files. The catalog probe runs within BEGIN READ ONLY.
requireTokens("scripts/ci/m122-qc-schema-readonly-preflight.sql",[
  "BEGIN READ ONLY;", "COMMIT;",
  "pg_attribute", "pg_constraint", "pg_index", "pg_trigger", "pg_proc",
  "p.prosecdef", "p.proconfig", "pg_get_functiondef",
  "t.tgenabled='O'", "t.tgfoid=v_trigger", "t.tgfoid=v_immutability",
  "finished_garment_qc_no_truncate", "finished_garment_qc_append_only",
  "has_function_privilege('anon'", "has_function_privilege('authenticated'",
  "has_function_privilege('service_role'", "relrowsecurity",
  "v_latest_sequence is distinct from v_order_sequence",
  "q.inspection_sequence=o.qc_latest_sequence",
]);
requireTokens("scripts/ci/verify-production-create-idempotency.sh",[
  "run_file supabase/migrations/20261115_finished_garment_qc_immutable.sql",
  "run_file scripts/ci/m122-qc-immutability-assertions.sql",
  "run_file scripts/ci/m122-qc-schema-readonly-preflight.sql",
]);
requireTokens("tests/titan-qc-staging-schema-preflight.test.ts",[
  "M123 preflight audits installed QC chronology",
  "M123 read-only installed-schema preflight",
]);

// M125: installed security checks are *challenged* under reversible,
// CI-only schema/role faults, not just observed on a known-good fixture.
requireTokens("scripts/ci/m125-qc-preflight-fault-injection.sh",[
  "GITHUB_ACTIONS", "titan_production_idempotency",
  "insert_trigger_off", "update_delete_off", "truncate_off",
  "missing_unique_index", "leaked_client_rpc", "missing_service_rpc",
  "BEGIN;", "ROLLBACK;", "not rolled back",
]);
requireTokens("scripts/ci/verify-production-create-idempotency.sh",[
  'bash scripts/ci/m125-qc-preflight-fault-injection.sh "$container" "$db"',
]);
requireTokens("tests/titan-qc-catalog-fault-injection.test.ts",[
  "M125 tries six real SQL/ACL faults",
  "M125 negative test never uses a real customer",
]);

// M126: idempotent delivery request receipts are an append-only ledger, not
// editable service-role cache. Reject privileged update/delete/truncate and
// require original same-key replay without a second event.
requireTokens("supabase/migrations/20261116_delivery_receipts_immutable.sql",[
  "private.reject_production_delivery_receipt_mutation()",
  "before update or delete on private.production_delivery_request_receipts",
  "before truncate on private.production_delivery_request_receipts",
  "errcode='55000'",
]);
requireTokens("scripts/ci/verify-production-create-idempotency.sh",[
  "run_file supabase/migrations/20261116_delivery_receipts_immutable.sql",
  "run_file scripts/ci/m126-delivery-receipt-immutability-assertions.sql",
]);
requireTokens("scripts/ci/m126-delivery-receipt-immutability-assertions.sql",[
  "update private.production_delivery_request_receipts",
  "delete from private.production_delivery_request_receipts",
  "truncate private.production_delivery_request_receipts",
  "M126 same-request replay not stable",
  "delivery key belongs to different instructions",
]);
requireTokens("scripts/ci/m122-qc-schema-readonly-preflight.sql",[
  "v_receipt_immutability", "production_delivery_receipt_append_only",
  "production_delivery_receipt_no_truncate", "BEGIN READ ONLY;",
]);
requireTokens("tests/production-delivery-receipt-immutability.test.ts",[
  "M126 delivery replay receipts are protected",
  "M126 atomic delivery replay survives",
  "M126 private replay cannot be altered",
]);

// M127: quote/order state event journals are append-only audit evidence too.
// Preserve old accepted/delivered events and still allow INSERT-only RPCs.
requireTokens("supabase/migrations/20261117_production_event_immutable.sql",[
  "private.reject_production_event_mutation()",
  "before update or delete on private.production_quote_events",
  "before truncate on private.production_quote_events",
  "before update or delete on private.production_order_events",
  "before truncate on private.production_order_events",
  "errcode='55000'",
]);
requireTokens("scripts/ci/verify-production-create-idempotency.sh",[
  "run_file supabase/migrations/20261117_production_event_immutable.sql",
  "run_file scripts/ci/m127-production-event-immutability-assertions.sql",
]);
requireTokens("scripts/ci/m127-production-event-immutability-assertions.sql",[
  "update private.production_order_events", "delete from private.production_order_events",
  "truncate private.production_order_events",
  "update private.production_quote_events", "delete from private.production_quote_events",
  "truncate private.production_quote_events",
  "M127 historical replay created duplicate delivered event",
]);
requireTokens("scripts/ci/m122-qc-schema-readonly-preflight.sql",[
  "v_event_immutability", "v_quote_events", "v_order_events",
  "production_quote_event_append_only", "production_order_event_no_truncate",
  "M127 production event append-only or TRUNCATE trigger missing or disabled",
]);
requireTokens("tests/production-event-immutability.test.ts",[
  "M127 immutable production event migration",
  "M127 real PostgreSQL assertions",
  "M127 read-only installed-schema preflight",
]);

// M128: non-delivery quote/order creation/status request UUID receipts must
// remain append-only even across a lost HTTP acknowledgement.
requireTokens("supabase/migrations/20261118_production_request_receipts_immutable.sql",[
  "private.reject_production_request_receipt_mutation()",
  "before update or delete on private.production_creation_request_receipts",
  "before truncate on private.production_creation_request_receipts",
  "before update or delete on private.production_quote_status_request_receipts",
  "before truncate on private.production_quote_status_request_receipts",
  "before update or delete on private.production_order_status_request_receipts",
  "before truncate on private.production_order_status_request_receipts",
  "errcode='55000'",
]);
requireTokens("scripts/ci/verify-production-create-idempotency.sh",[
  "run_file supabase/migrations/20261118_production_request_receipts_immutable.sql",
  "run_file scripts/ci/m128-production-request-receipt-immutability-assertions.sql",
]);
requireTokens("scripts/ci/m128-production-request-receipt-immutability-assertions.sql",[
  "production_quote_create_idempotent(", "production_quote_set_status_idempotent(",
  "production_order_set_status_idempotent(", "M128 replay created duplicate events",
  "M128 durable receipt table count changed",
]);
requireTokens("scripts/ci/m122-qc-schema-readonly-preflight.sql",[
  "v_request_receipt_immutability",
  "M128 request replay append-only trigger missing or disabled",
  "production_creation_receipt_no_truncate",
  "production_quote_status_receipt_no_truncate",
  "production_order_status_receipt_no_truncate",
]);
requireTokens("tests/production-request-receipt-immutability.test.ts",[
  "M128 three durable request-replay ledgers",
  "M128 live disposable SQL verifies",
  "M128 installed-schema catalog audit",
]);

// M129: don't trust a green installed-catalog audit alone. The same SQL DO
// must reject nine different trigger/ACL faults under rollback-only CI.
requireTokens("scripts/ci/m129-receipt-event-catalog-fault-injection.sh",[
  "GITHUB_ACTIONS", "titan_production_idempotency",
  "delivery_receipt_update_off", "delivery_receipt_truncate_off",
  "quote_event_update_off", "order_event_truncate_off",
  "create_receipt_update_off", "quote_status_receipt_truncate_off",
  "order_status_receipt_update_off", "client_receipt_read_grant",
  "client_event_function_execute_grant",
  "BEGIN;", "ROLLBACK;", "M129 FAIL: fault was not rolled back",
]);
requireTokens("scripts/ci/verify-production-create-idempotency.sh",[
  'bash scripts/ci/m129-receipt-event-catalog-fault-injection.sh "$container" "$db"',
]);
requireTokens("tests/titan-replay-event-fault-injection.test.ts",[
  "M129 nine real installed replay/event faults",
  "M129 fault challenges run only after",
  "M129 never calls a real Supabase database",
]);

// M130: an operator-created locked design and quoted prices must never be
// silently rewritten via privileged SQL, including after an audit receipt.
requireTokens("supabase/migrations/20261119_locked_production_identity_immutable.sql",[
 "private.reject_locked_production_identity_mutation()",
 "new.recipe_hash is distinct from old.recipe_hash",
 "new.line_items is distinct from old.line_items",
 "new.total is distinct from old.total",
 "new.quote_id is distinct from old.quote_id",
 "before update on private.production_quotes",
 "before update on private.production_orders",
 "errcode='55000'",
]);
requireTokens("scripts/ci/verify-production-create-idempotency.sh",[
 "run_file supabase/migrations/20261119_locked_production_identity_immutable.sql",
 "run_file scripts/ci/m130-locked-production-identity-assertions.sql",
]);
requireTokens("scripts/ci/m130-locked-production-identity-assertions.sql",[
 "M130 quote recipe hash rewrite succeeded",
 "M130 quote financial total rewrite succeeded",
 "M130 order quote relinking succeeded",
 "M130 valid production transitions were blocked",
 "M130 canonical order identity or normal QC sequencing incorrect",
]);
requireTokens("scripts/ci/m122-qc-schema-readonly-preflight.sql",[
 "v_locked_identity", "production_quote_locked_identity",
 "production_order_locked_identity",
 "M130 locked production quote/order identity trigger missing or disabled",
]);
requireTokens("tests/production-locked-identity-immutability.test.ts",[
 "M130 only immutable locked quote financial/design",
 "M130 disposable SQL rejects original quote/order rewrites",
 "M130 installed-schema audit checks both enabled lock triggers",
]);

// M131: operator forms do not permit manually retyping source-of-truth
// design IDs. Quote/order create POSTs use the verified vault revision.
requireTokens("src/app/operator/production/ProductionClient.tsx",[
 "lockedQuoteMatches", "lockedOrderMatches",
 "readOnly aria-readonly=\"true\"",
 "action:\"create_quote\",revisionId:loadedRevision?.revisionId,recipeHash:loadedRevision?.recipeHash",
 "action:\"create_order\",...order,revisionId:loadedRevision?.revisionId,recipeHash:loadedRevision?.recipeHash",
 "disabled={busy||!configured||requiresWriteReview||!lockedOrderMatches}",
]);
requireTokens("tests/operator-verified-lock-form.test.ts",[
 "M131 operator quote/order recipe identity",
 "M131 quote and order POST identities",
 "M131 verified identities retain independent editable quote prices",
]);
requireTokens("scripts/verify-production-qc-hint-browser.cjs",[
 "const immutableFields=page.locator",
 "lockedFieldsReadOnly:true",
 "No quote without verified locked design",
 "No order without verified locked design",
]);

requireTokens("docs/TITAN_QC_MIGRATION_STAGING_PLAN.md",[
 "20261119_locked_production_identity_immutable.sql",
 "Apply the eleven migrations",
]);


requireTokens("docs/TITAN_QC_MIGRATION_STAGING_PLAN.md",[
  "20261118_production_request_receipts_immutable.sql",
  "Apply the eleven migrations",
]);

requireTokens("docs/TITAN_QC_MIGRATION_STAGING_PLAN.md",[
  "20261117_production_event_immutable.sql",
  "Apply the eleven migrations", "Production quote and order state event journals",
]);

requireTokens("docs/TITAN_QC_MIGRATION_STAGING_PLAN.md",[
  "20261116_delivery_receipts_immutable.sql",
  "Apply the eleven migrations", "Already-issued delivery request keys",
]);




// M121: code-level staging rollout documentation is mandatory for the
// additive physical QC/delivery chain. No automated live schema migration.
requireTokens("docs/TITAN_QC_MIGRATION_STAGING_PLAN.md",[
  "Do not run these migrations in production",
  "20261110_delivery_qc_sql_gate.sql",
  "20261111_delivery_idempotency.sql",
  "20261112_finished_garment_qc_sequence.sql",
  "20261113_delivery_qc_sequence_gate.sql",
  "20261114_delivery_eligibility_read.sql",
  "Never backfill old approvals", "tested restore procedure",
  "stop operator delivery writes", "first-ten genuine deliveries",
]);
requireTokens("tests/titan-qc-migration-staging-plan.test.ts",[
  "M121 required QC migrations", "M121 rollout review",
  "M121 no CI job automatically applies",
]);

// M120: the UI order records must stay visible while the optional QC hint
// stalls, ignore an old positive hint after a newer 503 and only expose a
// delivery OPTION on a fresh matching synthetic read (write SQL still rules).
requireTokens("scripts/verify-production-qc-hint-browser.cjs",[
  "GITHUB_ACTIONS", "LINEN_BROWSER_QA_RUNTIME",
  "firstIntercepted", "firstRelease", 'status:503',
  "Refresh production history", "stale positive answer",
  'option[value="delivered"]', "deliveryPosted:false",
  "for(const width of [390,1440])",
]);
requireTokens("tests/production-qc-hint-browser-contract.test.ts",[
  "M120 real browser regression", "chromium",
  "M120 production UI browser check",
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  'className="productionRecordsToolbar"',
  "onClick={()=>void load()}>Refresh production history",
]);
requireTokens("src/app/operator/production/production.css",[
  ".productionRecordsToolbar button", "min-height:44px",
]);
requireTokens(".github/workflows/ci.yml",[
  "node scripts/verify-production-qc-hint-browser.cjs",
]);
requireTokens(".github/workflows/deep-engine-non3d.yml",[
  "node scripts/verify-production-qc-hint-browser.cjs",
]);


requireTokens("src/app/api/operator/production/delivery-eligibility/route.ts",[
  "if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value))", "production_delivery_eligibility_list",
  "parseProductionDeliveryEligibility(raw)", 'cache:"no-store"', "private, no-store",
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "hasVerifiedSqlDeliveryEligibility(deliveryEligibility,item)",
  "parseProductionDeliveryEligibility(payload.eligibility)??[]",
  "setDeliveryEligibility([])",
  'if(readVersion===ledgerReadVersion.current)setDeliveryEligibility(rows)',
  'status!=="delivered"||deliveryQcVerified',
]);
requireTokens("scripts/ci/verify-production-create-idempotency.sh",[
  "20261114_delivery_eligibility_read.sql",
  "m114-delivery-eligibility-assertions.sql",
]);
// M116 signed HTTP fail-closed eligibility boundary on integrated M115.

requireTokens("scripts/verify-production-delivery-eligibility-private-http.cjs",[
  "GITHUB_ACTIONS","LINEN_OPERATOR_SESSION_SECRET","signedCookie",
  "response.status,401","response.status,503","Delivery verification unavailable.",
  "ledger.status,200",'Object.hasOwn(data,"deliveryEligibility"),false',
]);

// M117: the same signed real HTTP route also accepts a strictly allowlisted
// synthetic positive SQL receipt while rejecting unexpected private QC fields.
// This is transport proof only; real physical inspection remains blocked.
requireTokens("scripts/verify-production-delivery-eligibility-private-http.cjs",[
  'await setMode("valid")',"approved.status,200","anonymousPositive.status,401",
  'await setMode("poisoned")',"poisoned.status,503",
  "Object.keys(hint).sort()","await setMode(\"absent\")",
]);
requireTokens("scripts/ci-verified-stock-fixture.cjs",[
  'let ciEligibilityMode="absent"',
  'req.url==="/__fixture/eligibility-mode"',
  "ciEligibilityMode", "CI_ELIGIBILITY_EXAMPLE",
]);
requireTokens(".github/workflows/ci.yml",[
  "node scripts/verify-production-delivery-eligibility-private-http.cjs",
]);
requireTokens(".github/workflows/deep-engine-non3d.yml",[
  "node scripts/verify-production-delivery-eligibility-private-http.cjs",
]);
requireTokens("scripts/ci/verify-production-create-idempotency.sh",[
  "20261110_delivery_qc_sql_gate.sql","m112-delivery-qc-gate-assertions.sql",
  "20261111_delivery_idempotency.sql",
]);


// M134: a recovery-token edit or new vault load must synchronously revoke the
// old displayed lock before React commits. No stale quote/order or production,
// tailor or tech-pack export may use a previous recovered revision.
requireTokens("src/lib/designer/verified-operator-lock.ts",[
  "displayed is T", "displayed !== null && displayed === verified",
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "const verifiedLockedRevision=useRef<LockedDesignRevision|null>(null)",
  "verifiedLockedRevision.current=null;",
  "verifiedLockedRevision.current=revision;",
  "isCurrentVerifiedOperatorLock(loadedRevision,verifiedLockedRevision.current)",
  "locked design changed during handoff export",
  "locked design changed during tech-pack export",
  "locked design changed during packet export",
]);
requireTokens("tests/verified-operator-lock.test.ts",[
  "same event turn", "before React rerender",
  "before React commits its new loadedRevision",
  "never exports stale handlers",
]);
requireTokens("scripts/verify-operator-verified-lock-export-race-browser.cjs",[
  "GITHUB_ACTIONS", "LINEN_BROWSER_QA_RUNTIME",
  "synthetic-shirt-A", "synthetic-shirt-B",
  "sameTurn", "staleExports:0", "for(const width of [390,1440])",
  "No production mutation is allowed",
]);
requireTokens(".github/workflows/ci.yml",[
  "node scripts/verify-operator-verified-lock-export-race-browser.cjs",
]);


// M137: localStorage read-then-write is not an atomic cross-tab claim.
// No potentially durable production POST without a same-origin Web Lock,
// unchanged pre-wait review snapshot and post-wait verified ledger.
requireTokens("src/lib/designer/production-write-hold.ts",[
  "PRODUCTION_WRITE_LOCK_NAME",
  "beginProductionWriteHoldAtomically",
  "productionWriteReviewSnapshotUnchanged(storage,expected)",
  "return beginProductionWriteHold(storage,token)",
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "function safeProductionWriteLock()",
  'locks.request(PRODUCTION_WRITE_LOCK_NAME,{mode:"exclusive"},claim)',
  "actionInFlight.current=true;",
  "const beforeLock=captureProductionWriteReviewSnapshot(storage)",
  "const claimed=await beginProductionWriteHoldAtomically(",
  "if(!claimed||!hasCurrentVerifiedLedger()",
  "if(claimed)releaseProductionWriteHold(storage,holdToken)",
]);
requireTokens("tests/production-write-hold.test.ts",[
  "M137 same-origin exclusive lock prevents two simultaneous production POST claims",
  "M137 unavailable, rejected or interrupted Web Lock fails closed before POST",
  "M137 browser uses origin-wide Web Locks and rechecks verified history after await",
]);

// M136: a cross-tab marker/epoch change revokes previously rendered history
// and manual acknowledgement must compare the exact marker from the newest
// verified GET, including a completed remote write with no remaining marker.
requireTokens("src/lib/designer/production-write-hold.ts",[
  "captureProductionWriteReviewSnapshot",
  "productionWriteReviewSnapshotUnchanged",
  "expectedToken===undefined||token===expectedToken",
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "const reviewSnapshot=captureProductionWriteReviewSnapshot(safeProductionHoldStorage())",
  "productionWriteReviewSnapshotUnchanged(safeProductionHoldStorage(),reviewSnapshot)",
  "verifiedWriteReviewSnapshot.current=data.configured?reviewSnapshot:null",
  "event.key===PRODUCTION_WRITE_HOLD_KEY||event.key===PRODUCTION_WRITE_EPOCH_KEY",
  "productionWriteReviewSnapshotUnchanged(storage,snapshot)",
  "snapshot.holdToken!==null&&!acknowledgeProductionWriteHold(storage,snapshot.holdToken)",
]);
requireTokens("tests/production-write-hold.test.ts",[
  "M136 a reviewed marker and epoch",
  "M136 unreadable or corrupted review marker",
  "M136 storage events synchronously revoke history review",
]);
requireTokens("scripts/verify-production-packet-cross-tab-browser.cjs",[
  "staleReviewBlocked:true",
  "completedRemoteReviewRecovered:true",
  "An acknowledgement from stale history must not erase",
]);
requireTokens("tests/production-packet-cross-tab-browser-contract.test.ts",[
  "staleReviewBlocked:true", "completedRemoteReviewRecovered:true",
]);

// M135: a packet's fresh SQL GET is not sufficient if another browser tab
// begins and confirms a write while packet construction is still in flight.
// The persisted anonymous epoch must be captured before GET and rechecked
// after await, with pending/invalid storage failing closed.
requireTokens("src/lib/designer/production-write-hold.ts",[
  "PRODUCTION_WRITE_EPOCH_KEY",
  "storage.setItem(PRODUCTION_WRITE_EPOCH_KEY,token)",
  "captureProductionWriteEpoch",
  "productionWriteEpochUnchanged",
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "const packetWriteEpoch=captureProductionWriteEpoch(safeProductionHoldStorage())",
  "if(packetWriteEpoch===null)",
  "productionWriteEpochUnchanged(safeProductionHoldStorage(),packetWriteEpoch)",
  "production writes changed in another tab during packet export",
]);
requireTokens("scripts/verify-production-packet-cross-tab-browser.cjs",[
  "GITHUB_ACTIONS", "LINEN_BROWSER_QA_RUNTIME",
  "syntheticRevision", "positivePacket:true",
  "localStorage.setItem(epochKey,token)",
  "localStorage.removeItem(holdKey)",
  "completedCrossTabWriteBlocked:true",
  "No production POST is allowed",
  "for(const width of [390,1440])",
]);
requireTokens(".github/workflows/ci.yml",[
  "node scripts/verify-production-packet-cross-tab-browser.cjs",
]);
requireTokens("tests/production-packet-cross-tab-browser-contract.test.ts",[
  "M135 signed Chromium tests a positive packet",
]);
requireTokens("tests/production-write-hold.test.ts",[
  "M135 packet snapshot detects cross-tab writes",
  "M135 malformed/unavailable write epochs fail closed",
  "M135 packet export checks the anonymous epoch",
]);

// M138: native signed Chromium must prove real two-tab Web Locks queueing,
// reject a stale claim even after the first synthetic POST completes, and
// permit a later claim only after capturing the fresh anonymous epoch.
requireTokens("scripts/verify-production-native-web-locks-browser.cjs",[
  "GITHUB_ACTIONS", "LINEN_BROWSER_QA_RUNTIME",
  "ts.transpileModule(source",
  "navigator.locks.request(helper.PRODUCTION_WRITE_LOCK_NAME",
  "navigator.locks.query()",
  "completedEpochBlocksStaleClaim:true",
  "syntheticPostsSecond:0",
  "freshRecovery:true",
  "unsupportedLockFailsClosed:true",
  "No real production POST in synthetic CI",
  "for(const width of [390,1440])",
]);
requireTokens(".github/workflows/ci.yml",[
  "node scripts/verify-production-native-web-locks-browser.cjs",
]);
requireTokens("tests/production-native-web-locks-browser-contract.test.ts",[
  "M138 signed Chromium executes the production helper",
  "completedEpochBlocksStaleClaim:true",
]);


// M139: a verified GET made during an active SQL write must never authorize
// cross-tab manual acknowledgement. Hold a second Web Lock for the full POST,
// then require an independently verified history GET under that lock and a
// separate deliberate click after the new history renders.
requireTokens("src/lib/designer/production-write-hold.ts",[
  "PRODUCTION_WRITE_SESSION_LOCK_NAME",
  "linen-earth:production:active-write-session:v1",
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  'locks.request(PRODUCTION_WRITE_SESSION_LOCK_NAME,{mode:"exclusive",ifAvailable:true},async lock=>',
  "await post(body,success,true)",
  "if(verifiedReviewSessionReadVersion.current!==ledgerReadVersion.current)",
  "const refreshed=await load();",
  "verifiedReviewSessionReadVersion.current=ledgerReadVersion.current",
  "Production history rechecked with no active browser write",
  "if(snapshot.holdToken!==null&&!acknowledgeProductionWriteHold(storage,snapshot.holdToken))",
]);
requireTokens("tests/production-write-hold.test.ts",[
  "M139 a full-request Web Lock prevents acknowledgement",
]);
requireTokens("scripts/verify-production-native-web-locks-browser.cjs",[
  "activeSessionAcknowledgementBlocked:true",
  "postSessionAcknowledgementRecovered:true",
  "Second tab must not acknowledge an actively in-flight production write",
]);
requireTokens("tests/production-native-web-locks-browser-contract.test.ts",[
  "M139 signed native Chromium rejects active-session review",
]);
requireTokens("scripts/verify-production-ledger-refresh-barrier-browser.cjs",[
  "postSessionRefreshAndSecondClickRequired:true",
  "First acknowledgement must not clear a marker before post-session history verification",
]);
requireTokens("scripts/verify-production-packet-cross-tab-browser.cjs",[
  "postSessionTwoStepReview:true",
  "Production history rechecked with no active browser write",
]);

// M142: exact committed status receipts survive capped production history.
// A missing row is not proof of noncommit; the lookup must never release a
// pending browser write without independently verified human review.
requireTokens("supabase/migrations/20261120_production_status_receipt_lookup.sql",[
  "production_quote_status_request_receipts",
  "production_order_status_request_receipts",
  "production_delivery_request_receipts",
  "revoke all on function public.production_status_request_receipt_lookup",
  "grant execute on function public.production_status_request_receipt_lookup",
]);
requireTokens("src/app/api/operator/production/route.ts",[
  'if(action==="status_receipt_lookup"){',
  'parseProductionStatusReceipts(rows)',
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  'async function lookupPendingStatusReceipt(){',
  'productionWriteReviewSnapshotUnchanged(safeProductionHoldStorage(),snapshot)',
  'Find original status receipt by request ID',
  'This is NOT proof that retrying is safe',
]);
requireTokens("scripts/ci/verify-production-create-idempotency.sh",[
  "m142-status-receipt-lookup-assertions.sql",
  "Status receipt lookup claimed noncommit while another SQL transaction was open",
]);
requireTokens("scripts/verify-production-status-receipt-private-http.cjs",[
  "Signed built-Next status receipt recovery HTTP PASS",
  "empty lookup is only an observation",
  "malformed","duplicate","missing","upstream","oversized",
  "assertPrivate(failed)",
]);
requireTokens(".github/workflows/ci.yml",[
  "node scripts/verify-production-status-receipt-private-http.cjs",
]);

requireTokens("src/lib/designer/production-status-receipt-lookup.ts",[
  "parseProductionStatusReceiptResponse",
  "return parseProductionStatusReceipts(sqlRows)",
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "parseProductionStatusReceiptResponse(data.receipts)",
]);
requireTokens("tests/production-status-receipt-lookup.test.ts",[
  "operator browser strictly accepts sanitized camelCase status receipts, not raw SQL",
]);


// The M109 creation receipt has the same safe API normalization boundary.
requireTokens("src/lib/designer/production-creation-receipt-lookup.ts",[
  "parseProductionCreationReceiptResponse",
  "return parseProductionCreationReceipts(sqlRows)",
]);
requireTokens("src/app/operator/production/ProductionClient.tsx",[
  "parseProductionCreationReceiptResponse(data.receipts)",
]);
requireTokens("tests/production-creation-receipt-lookup.test.ts",[
  "operator creation receipt API response accepts only normalized private-safe wire fields",
]);

// M144: SQL and private HTTP alone do not verify the actual operator React UI.
// A signed Chromium session must demonstrate that status receipts, absent rows,
// upstream failures and a changed browser marker NEVER unlock production writes.
requireTokens("scripts/verify-production-status-receipt-browser.cjs",[
  "M144 signed Chromium status-receipt UI hold and changed-marker veto PASS",
  "for(const width of [390,768,1440])",
  "committed status: accepted",
  "This is NOT proof that retrying is safe",
  "changedMarkerVeto:true",
  'productionPostActions.every(action=>action==="status_receipt_lookup")',
]);
requireTokens("tests/production-status-receipt-lookup.test.ts",[
  "M144 signed browser UI never treats a status receipt as permission to retry",
]);
requireTokens(".github/workflows/ci.yml",[
  "node scripts/verify-production-status-receipt-browser.cjs",
]);

if (failed) {
  console.error("\nLinen Earth release is NOT ready.");
  process.exit(1);
}

console.log("\nLinen Earth release foundation is ready.");


// M140: the native helper alone is insufficient. The signed two-tab browser
// must drive the actual React order-status handler with a deferred, intercepted
// POST and prove another tab cannot acknowledge it while the session is active.
requireTokens("scripts/verify-production-native-web-locks-browser.cjs",[
  "statusSelect.selectOption(\"cloth_reserved\")",
  "window.__titanUiDeferredPost=state",
  "Actual React production handler must hold the native session lock",
  "Real React review must not clear a different tab",
  "Exactly one synthetic UI POST was intercepted",
  "Real UI contention test must never send a production POST over HTTP",
]);
requireTokens("tests/production-native-web-locks-browser-contract.test.ts",[
  "M140 signed browser drives real operator POST while second tab attempts review",
]);
