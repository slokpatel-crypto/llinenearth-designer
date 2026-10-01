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
  "src/lib/designer/block-strategy.ts",
  "src/lib/designer/fit-construction.ts",
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
  "src/lib/designer/style-director-validation.ts",
  "src/app/api/operator/style-director-validation/route.ts",
  "src/app/operator/style-director-validation/page.tsx",
  "src/app/operator/style-director-validation/StyleDirectorValidationClient.tsx",
  "supabase/migrations/20261009_style_director_user_validation.sql",
  "src/lib/designer/ease-calibration.ts",
  "src/lib/designer/preview-option-coverage.ts",
  "src/lib/designer/novice-designer-study.ts",
  "src/app/api/operator/novice-designer-study/route.ts",
  "src/app/operator/novice-designer-study/page.tsx",
  "src/app/operator/novice-designer-study/NoviceDesignerStudyClient.tsx",
  "supabase/migrations/20261012_designer_novice_study.sql",
  "src/lib/designer/preview-option-reviews.ts",
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
  "src/app/recover-design/page.tsx",
  "src/app/operator/stock/page.tsx",
  "src/app/operator/production/page.tsx",
  "src/app/operator/garment-qc/page.tsx",
  "src/lib/designer/finished-garment-qc.ts",
  "supabase/migrations/20261002_finished_garment_qc.sql",
  "src/app/operator/production-evidence/page.tsx",
  "src/lib/designer/production-delivery-evidence.ts",
  "supabase/migrations/20261003_production_delivery_evidence.sql",
  "src/app/operator/meterage-model/page.tsx",
  "src/lib/designer/meterage-calibration.ts",
  "supabase/migrations/20261004_meterage_calibration_registry.sql",
  "src/app/operator/launch-readiness/page.tsx",
  "src/lib/designer/launch-readiness-evidence.ts",
  "supabase/migrations/20261005_launch_readiness_evidence.sql",
  "src/app/operator/production-calibration/page.tsx",
  "supabase/migrations/20261001_designer_locked_revision_vault.sql",
  "supabase/migrations/20261001_measurement_profile_vault.sql",
  "supabase/migrations/20261001_fabric_stock_ledger.sql",
  "supabase/migrations/20261001_production_quotes_orders.sql",
  "supabase/migrations/20261001_render_outcomes.sql",
  "src/lib/designer/render-outcomes.ts",
  "src/lib/designer/render-outcome-metrics.ts",
  "src/app/operator/render-qa/page.tsx",
  "src/lib/designer/render-release-evidence.ts",
  "supabase/migrations/20261007_render_release_evidence.sql",
]) requireFile(path);

requireTokens("src/app/page.tsx", ["/api/homepage-model", "/style-director", "/visual", "/real-model", "Open Real Model Designer"]);
requireTokens("src/lib/designer/proof-scale.ts", ["evaluateRecordedPhase1ProofEvidence","validateVerifiedPhysicalEvidence","physicalEvidenceReady","PHASE1_PROOF_EVIDENCE_VERSION","PHASE1_PROOF_PHOTO_COORDINATE_SYSTEM","summarizeIndependentRealism","PHASE1_PROOF_MIN_REALISM_VIEWERS","PHASE1_PROOF_MIN_STRONG_REALISM","phase1ProofAcceptance"]);
requireTokens("src/components/PremiumShirtProof.tsx", ["linen-earth-phase1-proof-v2","Anonymous viewer code","realismAssessments","uniqueRealismViewers","physicalEvidenceNote","WAITING FOR PROVENANCE","photoReferenceMm","photoReferencePx","pxPerMmFromMarker","photo-1024x1536-fixture"]);
requireTokens("src/app/operator/phase10-readiness/Phase10ReadinessClient.tsx", ["proofMobileAccepted","target-mobile acceptance","mobile ${proofMobileAccepted?"]);
requireTokens("src/app/api/operator/phase1-proof/route.ts", ["evaluateRecordedPhase1ProofEvidence","coreAccepted","physicalEvidenceReady","physicalEvidenceNote","uniqueRealismViewers","photoReferenceMm","photoReferencePx","photoPxPerMm","scaleCoordinateSystem"]);
requireTokens("src/app/api/memory/event/route.ts", ["linen-earth-phase1-proof-v2","photoReferenceMm","photoReferencePx","realismAssessments","uniqueRealismViewers"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["PhotoPreviewCalibration","photoPxPerMm","photoFabricPatternScale"]);
requireTokens("src/lib/designer/live-preview.ts", ["photoFabricPatternScale","photoExpectedRepeatPx","photoPxPerMm"]);
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
requireTokens("src/lib/designer/customer-outcome-learning.ts", ["normalizeCustomerOutcomeReview","normalizeCustomerOutcomePolicy","summarizeCustomerOutcomeLearning","learningEligible","gateComplete"]);
requireTokens("src/app/api/operator/customer-outcomes/route.ts", ["verifyOperatorSession","production_customer_outcome_learning_list","production_customer_outcome_review_record","production_customer_outcome_policy_record","summarizeCustomerOutcomeLearning"]);
requireTokens("src/app/operator/customer-outcomes/CustomerOutcomesClient.tsx", ["Customer Outcome Review","Human evidence threshold","LEARNING ELIGIBLE","Durable design context","cannot be approved as learning evidence","Designer ranking remains unchanged"]);
requireTokens("src/lib/fabric-color-calibration.ts", ["deltaE2000","evidenceGateComplete","calibrated_capture","spectrophotometer"]);
requireTokens("src/app/api/operator/fabric-color-calibration/route.ts", ["verifyOperatorSession","fabric_physical_color_check_record","summarizeFabricPhysicalColorChecks"]);
requireTokens("src/app/operator/fabric-color-calibration/FabricColorCalibrationClient.tsx", ["Physical Colour Calibration","MEDIAN ΔE","descriptive only","Save append-only colour evidence"]);
requireTokens("supabase/migrations/20261008_fabric_physical_color_checks.sql", ["fabric_physical_color_checks","fabric_physical_color_check_record","fabric_physical_color_check_list","service_role"]);
requireTokens("src/lib/designer/style-director-validation.ts", ["directionsUnderstandable","directionsDistinct","stockHandoffWorked","validationComplete"]);
requireTokens("src/app/api/operator/style-director-validation/route.ts", ["style_director_user_test_record","style_director_validation_signoff_record","verifyOperatorSession"]);
requireTokens("src/app/operator/style-director-validation/StyleDirectorValidationClient.tsx", ["Style Director Validation","materially distinct","Record user-test evidence","Record approved"]);
requireTokens("supabase/migrations/20261009_style_director_user_validation.sql", ["style_director_user_tests","style_director_validation_signoffs","record real-user validation evidence before sign-off","service_role"]);
requireTokens("src/lib/designer/ease-calibration.ts", ["requiredEaseEvidenceKeys","evidenceCoverageComplete","normalizeHouseEaseCalibrationDraft","SHIRT_EASE_CLASSES","TROUSER_EASE_CLASSES"]);
requireTokens("src/lib/designer/preview-option-coverage.ts", ["fullyCleared","constructionBlocked","noPreviewSupport","gateComplete"]);
requireTokens("src/lib/designer/novice-designer-study.ts", ["durationSeconds","likedDesignCompleted","targetSeconds","withinTargetCases","gateComplete"]);
requireTokens("src/app/api/operator/novice-designer-study/route.ts", ["designer_novice_attempt_record","designer_novice_study_decision_record","verifyOperatorSession"]);
requireTokens("src/app/operator/novice-designer-study/NoviceDesignerStudyClient.tsx", ["Novice Designer Completion Study","documented roadmap target","Record observed attempt","Approve five-case gate"]);
requireTokens("supabase/migrations/20261012_designer_novice_study.sql", ["designer_novice_attempts","designer_novice_study_decisions","five novice liked-design completions within the documented target","service_role"]);
requireTokens("src/lib/designer/preview-option-reviews.ts", ["DESIGNER_STYLE_CHOICES","designer_preview_option_review","customerPreviewCoverageRows","constructionStatus"]);
requireTokens("src/app/api/operator/preview-option-coverage/route.ts", ["verifyOperatorSession","customerPreviewCoverageRows","summarizePreviewOptionCoverage"]);
requireTokens("src/app/operator/preview-option-coverage/PreviewOptionCoverageClient.tsx", ["Customer Preview Coverage","Approve customer preview","Reject preview support","Approximate"]);
requireTokens("src/app/api/operator/ease-calibration/route.ts", ["house_ease_evidence_record","house_ease_model_create","house_ease_model_approve","evidenceCoverageComplete"]);
requireTokens("src/app/operator/ease-calibration/EaseCalibrationClient.tsx", ["House Ease Calibration","35 cells","runtime not auto-switched","Register evidence-backed draft"]);
requireTokens("supabase/migrations/20261010_house_ease_calibration_registry.sql", ["house_ease_evidence","house_ease_models","real finished-garment evidence is required for every house-ease cell","service_role"]);
requireTokens("supabase/migrations/20261011_launch_beta_flow_detail.sql", ["design_locked","share_or_enquiry_completed","launch_beta_attempt_record_v2","share/enquiry completion cannot precede a locked design"]);
requireTokens("src/lib/designer/launch-readiness-evidence.ts", ["designLocked","shareOrEnquiryCompleted","row.design_locked===true","row.share_or_enquiry_completed===true"]);
requireTokens("src/lib/designer/block-strategy.ts", ["block-strategy-provisional-1","assessBlockStrategy","shaped-shirt","roomy-seat-block","suggestedPatch"]);
requireTokens("src/lib/designer/planner.ts", ["DesignerBlockStrategy","blockStrategy:selectedBlock","item.blockStrategy?.score"]);
requireTokens("src/lib/designer/search.ts", ["blockStrategy: DesignerBlockStrategy","assessBlockStrategy","block.score"]);
requireTokens("src/components/DesignerModule.tsx", ["blockStrategy=assessment?.blockStrategy","Starting block:","newDesignerTechnicalDrawer","requestLookAssessment"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", [
  "PHOTO_TUCKED_SHIRT_CLIP",
  "PHOTO_TUCKED_TROUSER_CLIP",
  "PHOTO_TUCKED_NECK_CLEAR",
  "masks.shirt",
  "masks.pant",
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
  "assessFitConstruction",
  "HOUSE_SHIRT_EASE",
  "HOUSE_TROUSER_EASE",
  "HOUSE_EASE_TABLE_VERSION",
  "provisional_house_defaults",
]);
requireTokens("src/lib/designer/planner.ts", [
  "FitConstructionAssessment",
  "assessFitConstruction",
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
requireTokens("src/app/style-director/page.tsx", ["StyleDirectorRealModelPreview","shirtFabric","pantFabric","Existing real model · live outfit"]);
requireTokens("src/components/DesignerModule.tsx", ['params.get("shirt")','params.get("pant")','params.get("style")',"STYLE DIRECTOR"]);
requireTokens("src/lib/designer/garment-spec.ts", ["linen-earth-garment-spec-v1","buildCanonicalGarmentSpec","finishedTargets","ready_for_tailor_review","not a cutting pattern","conceptId:string","treatments:Array","Creative treatments are design instructions","CanonicalCreativeVisualReview","visualReview:CanonicalCreativeVisualReview"]);
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
requireTokens("src/components/DesignerModule.tsx", ["/api/designer/brief","Create 3 directions","one_line_designer_brief","newDesignerBrief","StyleDirectorRealModelPreview","newDesignerBriefModel","SAME LINEN EARTH MODEL","newDesignerBriefCut","Occasion match:"]);
requireTokens("src/lib/browser-style-memory.ts", ["readLocalDesignerTasteProfile","evidence<4","preferredTier","preferredShirtWear","preferredTrouser"]);
requireTokens("src/app/api/designer/brief/route.ts", ["safeTasteProfile","personalizeBrief","learned preference:","linen-designer-brief-v2"]);
requireTokens("src/lib/designer/search.ts", ["fitAdaptedStyle","Fit-aware adjustment:","suggestedPatch","fitAdaptation"]);
requireTokens("src/lib/designer/block-strategy.ts", ['patch.shirtFit = "Regular / Classic Fit"','patch.trouser = "Pleated Trouser"',"BLOCK-TORSO-STRAIGHT","BLOCK-SEAT-FLATFRONT"]);
requireTokens("src/components/DesignerModule.tsx", ["fitAdaptation","newDesignerBriefFit","FIT-AWARE"]);
requireTokens("src/lib/designer/search.ts", ["fabricPairDiffers","Prefer genuinely different fabric pairs","occasionPreferredShirts"]);
requireTokens("src/app/api/designer/look-render/route.ts", ["renderSelectedLookFashnFront","renderSelectedLookFashnView","frontImage","three-quarter","side","back"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["PhotorealView","choosePhotorealView","Generate 3/4","photorealViews"]);
requireTokens("src/lib/ai-visualization.ts", ["SelectedLookVisualCheck","inspectSelectedLookFashnOutput","repairSelectedLookFashnFront","assertFashnRepairRateLimit"]);
requireTokens("src/app/api/designer/look-inspect/route.ts", ["inspectSelectedLookFashnOutput","cache-control","no-store"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["/api/designer/look-inspect","selectedCheck","Repair once","repairSelectedLook"]);
requireTokens("src/lib/ai-visualization.ts", ['view:SelectedLookView="front"',"Expected camera/view:","three-quarter","side","back"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["activeSelectedCheck","inspectSelectedLook(data.result,view)","This camera view needs review"]);
requireTokens("src/app/api/designer/look-download/route.ts", ["OFFICIAL_FASHN_OUTPUT","content-disposition","private, no-store"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["/api/designer/look-download","activeImage","encodeURIComponent(activeImage)"]);
requireTokens("src/components/DesignerModule.tsx", [
  "OPTIONAL","Try a different fabric pairing","Show 3 options","Keep shirt","Keep trouser","Change both","Use look","newDesignerOptionalSearch","/api/designer/search","Finding…",
  "03 / CREATE","Create ideas ✦","newDesignerCreativeVisual","Design reasoning","FRONTIER IDEA",
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
requireTokens("src/components/DesignerModule.tsx", ["styleSpec","LiveConstructionPreview","Studio preview","Live cut study","bodyProfileFromMeasurements"]);
requireTokens("src/components/PhotoOutfitPreview.tsx", ["Lock final design","Final photoreal ✦","selectedLookSessionCache","styleSpec","bodyProfile"]);
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
requireTokens("src/lib/designer/production-packet.ts", ["linen-earth-production-packet-v1","noDesignDataReEntry"]);
requireTokens("src/lib/designer/stock-ledger.ts", ["stockSnapshot","reservedMetres","availableMetres"]);
requireTokens("src/app/operator/production/ProductionClient.tsx", ["Load locked design","Export production packet","Create production order","durable design context","outcome lineage","learningContexts","Outcome lineage","context missing","CUSTOMER OUTCOME","not automatically applied to Designer ranking","/operator/customer-outcomes","Outcome Review"]);
requireTokens("src/app/operator/stock/StockClient.tsx", ["Fabric Stock Ledger","Create reservation","Consume"]);
requireTokens("supabase/migrations/20261001_fabric_stock_ledger.sql", ["fabric_stock_snapshot","fabric_stock_reserve","request_key","service_role"]);
requireTokens("supabase/migrations/20261001_production_quotes_orders.sql", ["production_quote_create","production_order_create","invalid order transition","service_role"]);
requireTokens("supabase/migrations/20261002_finished_garment_qc.sql", ["finished_garment_qc_record","finished_garment_qc_list","finished-garment QC approval is required before delivery","service_role"]);
requireTokens("src/app/operator/garment-qc/GarmentQcClient.tsx", ["Finished Garment QC","Approve for delivery","Record rework","PHYSICAL CHECKS"]);
requireTokens("src/app/api/operator/production/route.ts", ["finished_garment_qc_list","Finished-garment QC approval is required before delivery.","production_customer_outcome_list","customerOutcomes","production_order_learning_context_list","learningContexts","parseDesignVaultRecoveryToken","verifyLockedDesignRevision","buildProductionLearningContext","production_order_create_with_context","learningContextAttached"]);
requireTokens("supabase/migrations/20261003_production_delivery_evidence.sql", ["production_delivery_evidence_record","production_delivery_evidence_list","delivery evidence can only be recorded for a delivered order","service_role"]);
requireTokens("src/lib/designer/production-delivery-evidence.ts", ["PRODUCTION_REENTRY_FIELDS","summarizeProductionDeliveryEvidence","gateComplete","reentryIncidentCount"]);
requireTokens("src/app/operator/production-evidence/ProductionEvidenceClient.tsx", ["Zero-Reentry Proof","FIRST 10 AUDITED","ZERO RE-ENTRY","Save immutable completion audit"]);
requireTokens("supabase/migrations/20261004_meterage_calibration_registry.sql", ["production_meterage_model_create","production_meterage_model_approve","at least 20 real cut cases are required before approval","service_role"]);
requireTokens("src/lib/designer/meterage-calibration.ts", ["normalizeMeterageCalibrationDraft","meterageForWidth","canApproveMeterageModel"]);
requireTokens("src/app/operator/meterage-model/MeterageModelClient.tsx", ["Meterage Registry","Register draft from real evidence","Approve + activate","requires ≥20 real"]);
requireTokens("src/app/api/operator/meterage-model/route.ts", ["evidenceCaseIds","At least 20 valid real cut cases","production_meterage_model_create","production_meterage_model_approve"]);
requireTokens("supabase/migrations/20261005_launch_readiness_evidence.sql", ["launch_beta_attempt_record","launch_checklist_event_record","No customer names","service_role"]);
requireTokens("src/lib/designer/launch-readiness-evidence.ts", ["LAUNCH_BETA_TARGET=5","LAUNCH_CHECKLIST_ITEMS","summarizeLaunchReadiness","launchEvidenceComplete"]);
requireTokens("src/app/operator/launch-readiness/LaunchReadinessClient.tsx", ["Launch Evidence","PRIVATE BETA","HUMAN LAUNCH CHECKLIST","deployment readiness is still a separate gate"]);
requireTokens("src/app/api/operator/launch-readiness/route.ts", ["normalizeBetaAttempt","normalizeLaunchChecklistDecision","launch_beta_attempt_record","launch_checklist_event_record"]);
requireTokens("src/app/operator/phase10-readiness/Phase10ReadinessClient.tsx", ["private-beta-launch-signoff","/operator/launch-readiness","human sign-offs remain"]);
requireTokens("next.config.ts", ["Strict-Transport-Security","X-Frame-Options","Cross-Origin-Opener-Policy"]);
requireTokens("src/app/api/designer/look-render/route.ts", ["recordRenderOutcome","repair:true"]);
requireTokens("src/app/api/designer/look-inspect/route.ts", ["attachRenderQa","jobId"]);
requireTokens("src/lib/designer/render-outcome-metrics.ts", ["summarizeRenderOutcomes","creditsPerApproved","approvalRate","summarizeRenderPatternCalibrations","scale_error_pct"]);
requireTokens("src/app/operator/render-qa/RenderQaClient.tsx", ["Final Render QA","Add measured pattern check","APPROVAL RATE","CREDITS / APPROVED","PATTERN SCALE QA","CROSS-VIEW IDENTITY","Record owner-approved credit cap"]);
requireTokens("supabase/migrations/20261001_render_outcomes.sql", ["designer_render_outcome_record","designer_render_outcome_review","designer_render_pattern_calibration_record","service_role"]);
requireTokens("src/lib/designer/render-release-evidence.ts", ["summarizeCrossViewIdentity","evaluateRenderCreditCap","evaluateFinalRenderReleaseEvidence","FINAL_RENDER_REVIEW_TARGET","FINAL_RENDER_APPROVAL_TARGET_PERCENT","eligibleConcepts","withinCap"]);
requireTokens("src/app/operator/phase10-readiness/Phase10ReadinessClient.tsx", ["Final render release evidence","evaluateFinalRenderReleaseEvidence","identitySummary","creditCapSummary"]);
requireTokens("supabase/migrations/20261007_render_release_evidence.sql", ["designer_render_identity_review_record","designer_render_credit_cap_record","at least two rendered views","service_role"]);


requireTokens("src/app/api/homepage-model/route.ts", [
  "FASHN_API_KEY",
  "model-create",
  "status",
  "X-Linen-Render",
  "/editorial/suit.webp",
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
  "production_quote_list",
  "production_order_list",
  "production_delivery_evidence_list",
  "production_meterage_model_list",
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

if (failed) {
  console.error("\nLinen Earth release is NOT ready.");
  process.exit(1);
}

console.log("\nLinen Earth release foundation is ready.");
