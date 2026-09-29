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
]) requireFile(path);

requireTokens("src/app/page.tsx", ["/api/homepage-model", "/style-director", "/visual", "/real-model", "Open Real Model Designer"]);
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
  "SHIRT_EASE",
  "TROUSER_EASE",
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
requireTokens("src/lib/designer/search.ts", ["occasionFabricAlignment","formal shirting","printed linen blend","occasionScore","occasionPreferredShirts","strictOccasionFit","openShirts"]);
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
requireTokens(".env.example", [
  "FASHN_API_KEY=",
  "SUPABASE_URL=",
  "SUPABASE_SECRET_KEY=",
  "LINEN_OPERATOR_SYNC_TOKEN=",
  "LINEN_OPERATOR_PASSWORD_HASH=",
  "LINEN_OPERATOR_SESSION_SECRET=",
  "LINEN_MEMORY_SESSION_SECRET=",
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
