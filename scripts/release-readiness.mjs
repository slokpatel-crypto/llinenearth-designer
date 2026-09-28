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

console.log(`LLinen Earth release readiness${live ? " (live)" : " (static)"}\n`);

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
  "src/app/api/designer/casebook/route.ts",
  "src/lib/designer/casebook.ts",
  "src/lib/designer/garment-spec.ts",
  "desktop/src/App.tsx",
  "desktop/src-tauri/tauri.conf.json",
  ".github/workflows/build-llinen-earth-os.yml",
  "supabase/migrations/20260920_style_events_hardening.sql",
  ".env.example",
  "package-lock.json",
]) requireFile(path);

requireTokens("src/app/page.tsx", ["/api/homepage-model", "/style-director", "/visual", "/real-model", "Open Real Model Designer"]);
requireTokens("src/lib/designer/block-strategy.ts", ["block-strategy-provisional-1","assessBlockStrategy","shaped-shirt","roomy-seat-block","suggestedPatch"]);
requireTokens("src/lib/designer/planner.ts", ["DesignerBlockStrategy","blockStrategy:selectedBlock","item.blockStrategy?.score"]);
requireTokens("src/lib/designer/search.ts", ["blockStrategy: DesignerBlockStrategy","assessBlockStrategy","block.score"]);
requireTokens("src/components/DesignerModule.tsx", ["PATTERN BLOCK / V1","Try safer starting block","result.blockStrategy.score"]);
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
requireTokens("src/components/DesignerModule.tsx", ['params.get("shirt")','params.get("pant")','params.get("style")',"STYLE DIRECTOR RESULT"]);
requireTokens("src/lib/designer/garment-spec.ts", ["linen-earth-garment-spec-v1","buildCanonicalGarmentSpec","finishedTargets","ready_for_tailor_review","not a cutting pattern"]);
requireTokens("src/components/DesignerModule.tsx", ["GARMENT SPEC / V1","Export spec JSON","downloadGarmentSpec"]);
requireTokens("src/app/api/memory/event/route.ts", ["garmentSpecInput","fitConstructionScore","brandLanguageScore","materialVerification"]);
requireTokens("src/lib/designer/search.ts", [
  "DesignerSearchScope","keep_shirt","keep_trouser","open",
  "DesignerSearchTier","Safe","Elevated","Statement",
  "searchDesignerCatalogue","explainWhyNotCurrentPair","hardBlocked","comparisonFor"
]);
requireTokens("src/components/DesignerModule.tsx", [
  "DESIGNER SEARCH / V4","Search catalogue","Keep shirt","Keep trouser","Open search","Why over my current choice?","Use this direction",
  "CREATIVE DESIGNER / V5","MAXIMUM DIVERGENCE","DIRECT + MUTATE + HYBRID + RADICAL","TOP 5","researchFreedom:\"maximum\"","RESEARCH USE"
]);
requireTokens("src/lib/designer/creative-engine.ts", [
  "generateCreativeDirections","researchMutationSeeds","hybridResearchSeed","researchFreedom","maximum","researchUtilization","explorationClass"
]);
requireTokens("src/lib/designer/fashion-research-source-pool.ts", [
  "FASHION_RESEARCH_SOURCES","FASHION_RESEARCH_TOPICS","FASHION_RESEARCH_TARGETS","buildFashionResearchTargets"
]);
requireTokens("src/app/api/designer/creative-render/route.ts", ["renderCreativeFashnFront","CreativeFashnRequest"]);
requireTokens("src/app/operator/designer-research/DesignerResearchClient.tsx", ["Creative Research Desk","Save research signal"]);
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
requireTokens("src/components/DesignerModule.tsx", ["tailorObservationSummary","newDesignerTailorObservations","observations:tailorObservations"]);
requireTokens("src/app/api/homepage-model/route.ts", [
  "FASHN_API_KEY",
  "model-create",
  "status",
  "X-LLinen-Render",
  "/editorial/suit.webp",
]);
requireTokens("desktop/src-tauri/tauri.conf.json", ["\"version\": \"1.0.0\"", "\"productName\": \"LLinen Earth OS\""]);
requireTokens("desktop/package.json", ["\"version\": \"1.0.0\""]);
requireTokens("desktop/src-tauri/Cargo.toml", ["version = \"1.0.0\""]);
requireTokens("desktop/src/App.tsx", [
  "Ctrl K",
  "+ New walk-in",
  "operatorTour",
  "MEASUREMENT PASSPORT",
  "PAYMENT HISTORY",
]);
requireTokens(".github/workflows/build-llinen-earth-os.yml", [
  "npm run desktop:build",
  "SHA256SUMS.txt",
  "actions/upload-artifact@v4",
  "nsis/*.exe",
]);
requireTokens("supabase/migrations/20260920_style_events_hardening.sql", [
  "enable row level security",
  "grant select, insert on table public.style_events to service_role",
  "select 5;",
  "llinen_cloud_health",
]);
requireTokens(".env.example", [
  "FASHN_API_KEY=",
  "SUPABASE_URL=",
  "SUPABASE_SECRET_KEY=",
  "LLINEN_OPERATOR_SYNC_TOKEN=",
  "LLINEN_OPERATOR_PASSWORD_HASH=",
  "LLINEN_OPERATOR_SESSION_SECRET=",
  "LLINEN_MEMORY_SESSION_SECRET=",
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
  console.error("\nLLinen Earth release is NOT ready.");
  process.exit(1);
}

console.log("\nLLinen Earth release foundation is ready.");
