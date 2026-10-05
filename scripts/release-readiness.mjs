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
  "src/lib/designer/garment-category-library.ts",
  "src/lib/designer/future-garment-options.ts",
  "src/components/DesignerModule.tsx",
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

requireTokens("src/app/page.tsx", ["/api/homepage-model", "/style-director", "/designer-studio", "/real-model", "Open Real Model Designer"]);
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
requireTokens("src/app/api/measurements/vault/route.ts", ["getCustomerIdentity","listOwned","loadOwned","deleteOwned","action===\"claim\""]);
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
requireTokens("src/lib/designer/style-director-handoff.ts", ["linen-earth-style-director-handoff-v1","createStyleDirectorHandoffToken","verifyStyleDirectorHandoffToken","styleDirectorHandoffMatches"]);
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
requireTokens("src/app/operator/launch-readiness/LaunchReadinessClient.tsx", ["LOCK → VERIFIED SHARE/ENQUIRY","record_verified_beta","Verified action","share_audit_confirmed","enquiry_audit_confirmed"]);
requireTokens("src/app/api/designer/share/route.ts", ["design_share_audit_record","p_revision_id:revision.revisionId","audited"]);
requireTokens("src/app/api/designer/enquiry/route.ts", ["verifyLockedDesignRevision","design_enquiry_audit_record","Locked Designer look","audited"]);
requireTokens("src/components/DesignerModule.tsx", ["verified share audit recorded","beta audit unavailable"]);
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
requireTokens("src/app/api/operator/fabric-analyzer/queue/route.ts", ["validateVerifiedPhysicalEvidence","enqueueFabricAnalyzerBatch"]);
requireTokens("src/app/api/operator/fabric-analyzer/process/route.ts", ["verifiedPhysicalEvidenceNote"]);
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
requireTokens("src/components/DesignerModule.tsx", ["DesignerAdvisorPanel","one_line_designer_brief","expectedIdentity","styleSpec:fromLegacyStyle(result.style)"]);
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
requireTokens("src/app/api/designer/creative-generate/route.ts", ["generateCreativeDirections","chooseCreativeRedesign","researchFreedom:\"maximum\"","loadDesignerFabricMetadata","loadDesignerCreativeContext","__linenCreativeGenerateRate"]);
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
requireTokens("src/lib/designer/tailor-observations.ts", ["linen-earth-tailor-observations-v1","ShoulderBalance","PostureBalance","SeatBalance"]);
requireTokens("src/components/MeasurementStudio.tsx", ["OPTIONAL / TAILOR OBSERVATIONS","MANUAL INPUT ONLY","TAILOR_OBSERVATION_STORAGE_KEY"]);
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
requireTokens("src/lib/designer/render-cache-key.ts", ["linen-final-render-cache-v2-locked-preview-source","function lockedPreviewIdentity",'createHash("sha256").update(raw).digest("hex")','lockedPreview:view==="front"?lockedPreviewIdentity(input.lockedPreviewImage):""']);
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
requireTokens("src/components/MeasurementStudio.tsx", ["Secure measurement copy","/api/measurements/vault","Recovery token"]);
requireTokens("src/lib/designer/production-handoff.ts", ["linen-earth-production-handoff-v1","stockReservation","clothEstimate","quote"]);
requireTokens("src/lib/designer/tech-pack.ts", ["linen-earth-tech-pack-v1","Tailor Tech Pack","not a cutting pattern"]);
requireTokens("src/lib/designer/production-quote.ts", ["normalizeProductionQuoteDraft","Quote total cannot be negative"]);
requireTokens("src/lib/designer/production-state.ts", ["ORDER_TRANSITIONS","QUOTE_TRANSITIONS","cloth_reserved","delivered"]);
requireTokens("src/lib/designer/production-delivery-evidence.ts", ["evidenceReference","legacyOrUnverifiedCount","provenanceReady","gateComplete:firstTarget.length>=target"]);
requireTokens("src/app/api/operator/production-evidence/route.ts", ["production_delivery_evidence_record_v2","p_evidence_reference"]);
requireTokens("src/app/operator/production-evidence/ProductionEvidenceClient.tsx", ["Production-flow evidence reference","legacy audits without provenance","evidenceReference"]);
requireTokens("supabase/migrations/20261026_production_delivery_evidence_provenance.sql", ["evidence_reference","production_delivery_evidence_record_v2","named operator or checker is required","production-flow evidence reference is required","service_role"]);
requireTokens("src/lib/designer/production-packet.ts", ["packetBuiltFromLockedRevision:true","noDesignDataReEntry:false","deliveryAuditRequired:true","verified separately after real delivery"]);
requireTokens("src/lib/designer/production-packet.ts", ["linen-earth-production-packet-v1","noDesignDataReEntry"]);
requireTokens("src/lib/designer/stock-ledger.ts", ["stockSnapshot","normalizeManualStockEvent","normalizeStockReservation","normalizeStockConsumption","normalizeStockRelease","recordedBy","requestedBy","checkedBy","releasedBy","sourceReference","reservedMetres","availableMetres"]);
requireTokens("src/lib/fabric-stock.ts", ["availabilityVerified?: boolean"]);
requireTokens("src/lib/designer/stock-availability.ts", ["verifiedStockAvailabilityMap","provenance_ready","availabilityVerified:true","fabric.inStock&&verified.get(fabric.id)===true"]);
requireTokens("src/lib/designer/engine.ts", ["availabilityVerified?: boolean","verified physical stock status","provenance-ready positive stock status"]);
requireTokens("tests/stock-availability.test.ts", ["availabilityVerified,true","availabilityVerified,undefined"]);
requireTokens("src/lib/designer/stock-availability-server.ts", ["fabric_stock_snapshot_v2","applyLiveVerifiedStockAvailability","cache:\"no-store\""]);
requireTokens("src/lib/designer/catalog-stock-server.ts", ["loadDesignerFabricMetadata","applyDesignerFabricMetadataToStock","applyLiveVerifiedStockAvailability","verifiedStockFabrics"]);
requireTokens("src/app/api/designer/catalog/route.ts", ["loadActiveDesignerFabricStock","verifiedStockFabrics"]);
requireTokens("src/lib/designer/garment-category-library.ts", ["shirt","trouser","blazer","suit","typeExamples","detailFamilies","status:\"planned\""]);
requireTokens("src/components/DesignerModule.tsx", ["newDesignerGarmentScope","newDesigner3dBridge","Open this shirt + trouser recipe in 3D","/lab/garment-viewer?from=designer&shirt="]);
requireTokens("src/components/GarmentViewer.tsx", ["validateStyleSpecV2","parsed.shirtId","parsed.pantId","params.get(\"shirt\")","params.get(\"pant\")","routedShirt&&shirtFabrics.some","routedPant&&trouserFabrics.some","optionLabel(designerDraftRecipe.styleSpec.shirt.type","optionLabel(designerDraftRecipe.styleSpec.pant.type","The 3D Lab now opens on the same saved shirt and trouser fabrics as Designer"]);
requireTokens("src/lib/garment-viewer-model-contract.ts", ["linen-earth-garment-viewer-v2","REQUIRED_GARMENT_VIEWER_MATERIALS","approvedGarmentViewerModelSource","validateGarmentViewerModelManifest"]);
requireTokens("src/lib/garment-viewer-glb.ts", ["parseGarmentViewerGlbJson","externalGlbUri","performanceBudgetReady","structuralReady"]);
requireTokens("src/lib/garment-viewer-readiness.ts", ["garmentViewerPromotionReadiness","GARMENT_VIEWER_REALISM_RUBRIC_VERSION","ROADMAP_SCALE_TOLERANCE_PCT"]);
requireTokens("src/components/GarmentViewer.tsx", ["sampler?.setScale","sampler?.setOffset","sampler?.setRotation","GARMENT_VIEWER_LATENCY_STORAGE_KEY","studio-tucked.webp"]);
requireTokens("src/app/operator/garment-viewer/page.tsx", ["CUSTOMER PROMOTION GATE","GarmentViewerEvidenceForm","loadLatestGarmentViewerReadiness"]);
requireTokens("src/app/operator/phase10-readiness/Phase10ReadinessClient.tsx", ["garment-viewer-m2","Reusable 3D GarmentViewer production gate","/api/operator/garment-viewer"]);
requireTokens("src/app/api/designer/search/route.ts", ["applyLiveVerifiedStockAvailability","liveStock.stock.filter((fabric)=>fabric.inStock)"]);
requireTokens("src/app/api/designer/brief/route.ts", ["applyLiveVerifiedStockAvailability","liveStock.stock.filter((fabric)=>fabric.inStock)"]);
requireTokens("src/app/api/designer/assess/route.ts", ["applyLiveVerifiedStockAvailability","liveStock.stock.filter((fabric)=>fabric.inStock)"]);
requireTokens("src/app/api/style-director/route.ts", ["applyLiveVerifiedStockAvailability","verifiedStockFabrics"]);
requireTokens("src/app/style-director/page.tsx", ["verified ledger availability enforced where recorded"]);
requireTokens("src/app/operator/production/ProductionClient.tsx", ["Load locked design","New quotes and production orders are blocked","Quote created from verified locked revision","Production order created from verified locked revision","durable design context","learningContexts","Outcome lineage","context missing","CUSTOMER OUTCOME","not automatically applied to Designer ranking","/operator/customer-outcomes","Outcome Review"]);
requireTokens("src/app/api/operator/stock/route.ts", ["fabric_stock_snapshot_v2","fabric_stock_record_v2","fabric_stock_reserve_v2","fabric_stock_release_v2","fabric_stock_consume_reservation_v2","p_recorded_by","p_requested_by","p_released_by","p_checked_by","p_source_reference"]);
requireTokens("src/app/operator/stock/StockClient.tsx", ["Fabric Stock Ledger","Physical source reference","Reservation quantity source","Close action source","PHYSICAL PROVENANCE","provenance_ready","Create reservation","Consume","Release"]);
requireTokens("supabase/migrations/20261001_fabric_stock_ledger.sql", ["fabric_stock_snapshot","fabric_stock_reserve","request_key","service_role"]);
requireTokens("supabase/migrations/20261028_fabric_stock_provenance.sql", ["fabric_stock_record_v2","fabric_stock_snapshot_v2","recorded_by","source_reference","legacy_unverified_event_count","provenance_ready","service_role"]);
requireTokens("supabase/migrations/20261029_stock_reservation_provenance.sql", ["fabric_stock_reserve_v2","p_requested_by","p_source_reference","reservation quantity evidence reference is required","service_role"]);
requireTokens("supabase/migrations/20261030_stock_consumption_provenance.sql", ["fabric_stock_consume_reservation_v2","p_checked_by","p_source_reference","actual cloth-usage evidence reference is required","service_role"]);
requireTokens("supabase/migrations/20261031_stock_reservation_concurrency_provenance.sql", ["stock-request:","stock-reservation:","fabric_stock_release_v2","fabric_stock_reserve_v2","fabric_stock_consume_reservation_v2","reservation release reference is required","service_role"]);
requireTokens("supabase/migrations/20261001_production_quotes_orders.sql", ["production_quote_create","production_order_create","invalid order transition","service_role"]);
requireTokens("supabase/migrations/20261002_finished_garment_qc.sql", ["finished_garment_qc_record","finished_garment_qc_list","finished-garment QC approval is required before delivery","service_role"]);
requireTokens("supabase/migrations/20261027_finished_garment_qc_provenance.sql", ["inspection_reference","finished_garment_qc_record_v2","provenance-backed finished-garment QC approval is required before delivery","service_role"]);
requireTokens("src/lib/designer/finished-garment-qc.ts", ["inspectionReference","Named inspector / checker is required","Physical inspection reference is required"]);
requireTokens("src/app/api/operator/garment-qc/route.ts", ["finished_garment_qc_record_v2","p_inspection_reference"]);
requireTokens("src/app/operator/garment-qc/GarmentQcClient.tsx", ["Finished Garment QC","Physical inspection reference","provenanceReady","Legacy inspection · provenance not recorded","Approve for delivery","Record rework","PHYSICAL CHECKS"]);
requireTokens("src/app/api/operator/production/route.ts", ["finished_garment_qc_list","Finished-garment QC approval is required before delivery.","Provenance-backed finished-garment QC approval is required before delivery.","production_customer_outcome_list","customerOutcomes","production_order_learning_context_list","learningContexts","loadVerifiedLockedRevision","A valid locked-design recovery token is required","verified locked design does not match the quote revision/hash","verified locked design does not match the order revision/hash","parseDesignVaultRecoveryToken","verifyLockedDesignRevision","buildProductionLearningContext","production_order_create_with_context","learningContextAttached","lockedRevisionVerified"]);
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
        if (!health?.configured) fail("FASHN_API_KEY is not configured in the live deployment.");
        else ok(`FASHN live route configured (${health.provider || "provider"} / ${health.model || "model"}).`);
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
  warn("Live FASHN + Supabase checks are skipped. Run npm run release:check:live with RELEASE_URL and production env vars before launch.");
}


requireTokens("src/components/CreativeStudioPanel.tsx",["03 / CREATE","Create ideas ✦","creativePlacementSvg","PLACEMENT ILLUSTRATION · SCALE PROPOSED","Reasoning and sample checks","Reset creative learning"]);
requireTokens("src/app/api/designer/creative-profile/route.ts",["getCustomerIdentity","body.owner!==identity.id","resetAt","context.preferences.enabled"]);
requireTokens("src/lib/designer/research-refresh-server.ts",["claim.duplicate","paidModelCalls:0","contentHash:hash","pending_review"]);
requireTokens("src/app/api/cron/designer-research/route.ts",["CRON_SECRET","timingSafeEqual"]);

if (failed) {
  console.error("\nLinen Earth release is NOT ready.");
  process.exit(1);
}

console.log("\nLinen Earth release foundation is ready.");
