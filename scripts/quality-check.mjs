import fs from "node:fs";
import "./check-designer.mjs";

const required = [
  "src/lib/fashion-intelligence.ts",
  "src/lib/designer-engine.ts",
  "src/lib/designer/garment-spec.ts",
  "src/lib/refinement-engine.ts",
  "src/lib/visualization-engine.ts",
  "src/lib/handoff.ts",
  "src/lib/quality-lab.ts",
  "src/app/designer/page.tsx",
  "src/app/designs/page.tsx",
  "src/app/atelier/page.tsx",
  "src/app/quality/page.tsx",
  "src/components/MeasurementStudio.tsx",
  "src/app/measurements/scale-selector.css",
  "src/app/measurements/measurements.css",
  "src/app/measurements/page.tsx",
  "src/app/real-model/page.tsx",
  "public/designer/studio-tucked.webp",
  "src/lib/designer/photo-preview.ts",
  "src/lib/designer/block-strategy.ts",
  "src/lib/designer/fit-construction.ts",
  "src/lib/designer/tailor-observations.ts",
  "src/lib/designer/fit-outcomes.ts",
  "src/lib/designer/constraint-negotiation.ts",
  "src/lib/designer/outcome-learning.ts",
  "src/lib/designer/brand-language.ts",
  "src/components/PhotoOutfitPreview.tsx",
  "src/app/designer-studio/page.tsx",
  "src/lib/designer/search.ts",
  "src/app/api/designer/casebook/route.ts",
  "src/app/api/designer/creative-inspect/route.ts",
  "src/app/api/designer/creative-generate/route.ts",
  "src/app/api/operator/designer-research/discover/route.ts",
  "src/app/api/operator/designer-research/analyze/route.ts",
  "src/app/api/operator/designer-research/analyze-batch/route.ts",
  "src/lib/designer/research-source-discovery.ts",
  "src/lib/designer/research-source-analysis.ts",
  "src/lib/designer/casebook.ts",
  "src/app/brand/linen-earth-logo.png/route.ts",
];

for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Missing required Phase 0–9 file: ${file}`);
}

function sourceFiles(dir) {
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap((entry)=>{
    const full=`${dir}/${entry.name}`;
    if(entry.isDirectory()) return sourceFiles(full);
    return /\.(?:ts|tsx|js|mjs|css|json|md|yml|yaml|toml|sql|example)$/.test(entry.name) ? [full] : [];
  });
}
const brandTypo=("l"+"linen").toLowerCase();
const repoBrandFiles=[
  ...sourceFiles("src"),
  ...sourceFiles("scripts"),
  ...sourceFiles("desktop"),
  ...sourceFiles(".github"),
  ...sourceFiles("supabase"),
  ".env.example","package.json","package-lock.json",
].filter((file)=>fs.existsSync(file));
const typoHits=repoBrandFiles.filter((file)=>fs.readFileSync(file,"utf8").toLowerCase().includes(brandTypo));
const typoPaths=repoBrandFiles.filter((file)=>file.toLowerCase().includes(brandTypo));
if(typoHits.length || typoPaths.length) {
  throw new Error(`Linen Earth brand spelling regression: double-L typo remains in ${[...new Set([...typoHits,...typoPaths])].join(", ")}`);
}
console.log("Linen Earth brand spelling gate passed: no double-L typo remains in current repo text or tracked product paths.");

const vercelConfig = JSON.parse(fs.readFileSync("vercel.json","utf8"));
if (vercelConfig.ignoreCommand !== "node scripts/vercel-ignore.mjs") throw new Error("Vercel duplicate-build guard regression: ignoreCommand changed.");
const vercelIgnore = fs.readFileSync("scripts/vercel-ignore.mjs","utf8");
for (const token of ["VERCEL_PROJECT_ID","prj_b3rwwOl5OI0VV3qYyKXPFOloCllT","process.exit(0)","process.exit(1)"]) {
  if (!vercelIgnore.includes(token)) throw new Error(`Vercel duplicate-build guard regression: missing ${token}`);
}
console.log("Vercel duplicate-build guard passed: only the primary Linen Earth web project is allowed to build from Git.");


const intelligence = fs.readFileSync("src/lib/fashion-intelligence.ts","utf8");
const wearIds = [...intelligence.matchAll(/id:\s*"(?:SH|TR|JK|SU|IN)-[^"]+"/g)].length;
const fabricIds = [...intelligence.matchAll(/id:\s*"(?:linen|linen-cotton|cotton-poplin|oxford-cotton|cotton-twill|tr-pv|tr-wool|tropical-wool|hopsack-wool|wool-flannel|seersucker|denim|corduroy|velvet|silk-blend)"/g)].length;

if (wearIds < 27) throw new Error(`Fashion Brain regression: expected at least 27 wear types, found ${wearIds}`);
if (fabricIds < 15) throw new Error(`Fashion Brain regression: expected at least 15 fabric families, found ${fabricIds}`);
for (const token of ["TR / Poly-Viscose Suiting","TR-Wool","Bandhgala","Sherwani","Dinner Suit / Tuxedo","judgeFabricForBrief"]) {
  if (!intelligence.includes(token)) throw new Error(`Fashion Brain regression: missing ${token}`);
}

const designer = fs.readFileSync("src/lib/designer-engine.ts","utf8");
for (const token of ["Safe","Elevated","Statement","fabricJudgement"]) {
  if (!designer.includes(token)) throw new Error(`Designer regression: missing ${token}`);
}

console.log(`Quality gate passed: ${wearIds} wear types, ${fabricIds} fabric families, complete Phase 0–9 route contract.`);


const securityContracts = [
  ["src/middleware.ts", ["verifyOperatorSession","/operator/login","X-Frame-Options","Content-Security-Policy"]],
  ["src/app/api/memory/event/route.ts", ["verifyMemorySessionToken","getSupabaseAdminConfig","PUBLIC_TYPES","OPERATOR_TYPES"]],
  ["src/app/api/operator/sync/route.ts", ["timingSafeEqual","supabaseAdminHeaders","received_at.asc,id.asc","cleanOperatorPayload","schemaVersion","measurements_updated","payment_logged","appointment_updated"]],
  ["src/lib/browser-style-memory.ts", ["x-linen-memory-token","/api/memory/session"]],
  ["src/lib/supabase-admin.ts", ["SUPABASE_SECRET_KEY","SUPABASE_SERVICE_ROLE_KEY","sb_secret_"]],
  ["src/app/operator/page.tsx", ["verifyOperatorSession","redirect","force-dynamic"]],
  ["supabase/migrations/20260920_style_events_hardening.sql", ["linen_cloud_health","select 5;","revoke all on table public.style_events from anon","grant select, insert on table public.style_events to service_role"]],
];

for (const [file,tokens] of securityContracts) {
  const content = fs.readFileSync(file,"utf8");
  for (const token of tokens) {
    if (!content.includes(token)) throw new Error(`Security regression: ${file} missing ${token}`);
  }
}

const envExample = fs.readFileSync(".env.example","utf8");
for (const secretName of [
  "SUPABASE_SECRET_KEY",
  "LINEN_OPERATOR_SYNC_TOKEN",
  "LINEN_OPERATOR_PASSWORD_HASH",
  "LINEN_OPERATOR_SESSION_SECRET",
  "LINEN_MEMORY_SESSION_SECRET",
]) {
  if (!envExample.includes(`${secretName}=`)) throw new Error(`Deployment regression: .env.example missing ${secretName}`);
  if (envExample.includes(`NEXT_PUBLIC_${secretName}`)) throw new Error(`Secret exposure regression: ${secretName} must remain server-only`);
}

console.log("Security gate passed: operator auth, signed public memory, Supabase admin isolation, deterministic sync cursor.");


const desktopOperationalContracts = [
  ["desktop/src-tauri/src/main.rs", [
    "LOCK_KEYRING_USER",
    "SyncLock",
    "save_measurements",
    "record_payment",
    "set_appointment",
    "export_job_card",
    "invalid_event_line_count",
    "latest_file_modified_at",
    "latest_backup_verified",
    "auto_backup_today",
  ]],
  ["desktop/src/App.tsx", [
    "STAFF PRIORITY BOARD",
    "DO NEXT",
    "staffNext",
    "MEASUREMENT PASSPORT",
    "PAYMENT HISTORY",
    "NEXT APPOINTMENT",
    "Export job card",
    "desktopLockScreen",
    "sync_from_cloud",
  ]],
  ["desktop/src/ErrorBoundary.tsx", ["export_system_report","Restart interface","No customer data is sent automatically"]],
  ["desktop/src/app.css", [
    "staffPriorityCard",
    "staffNext",
    "measurementPassport",
    "paymentLedger",
    "appointmentPanel",
    "desktopLockScreen",
  ]],
];

for (const [file,tokens] of desktopOperationalContracts) {
  const content = fs.readFileSync(file,"utf8");
  for (const token of tokens) {
    if (!content.includes(token)) throw new Error(`Desktop regression: ${file} missing ${token}`);
  }
}

console.log("Desktop gate passed: action-first Today board, lock, sync serialization, tailoring workflow, finance, appointments, job cards and vault health checks.");


const restoredStudio = fs.readFileSync("src/components/StudioDashboard.tsx","utf8");
for (const token of ["AtelierMannequin","/style-director","FABRIC_STOCK","tucked","TUCKED SHIRT CONSTRUCTION"]) {
  if (!restoredStudio.includes(token)) throw new Error(`Restored Designer regression: StudioDashboard missing ${token}`);
}
for (const forbidden of ["LNL-2024-09","Fabric Catalogue","Classic Designer","Saved Designs","Fashion Brain"]) {
  if (restoredStudio.includes(forbidden)) throw new Error(`Restored Designer regression: StudioDashboard reintroduced ${forbidden}`);
}

const restoredShell = fs.readFileSync("src/components/AppShell.tsx","utf8");
for (const forbidden of ["[\"Catalog\",","[\"Live Visual\",","[\"Classic Designer\",","[\"Saved Designs\",","[\"Fashion Brain\",","[\"Atelier\","]) {
  if (restoredShell.includes(forbidden)) throw new Error(`Navigation regression: public shell reintroduced ${forbidden}`);
}
for (const requiredLink of ["[\"Real Model Designer\", \"/real-model\"]","[\"Style Director\", \"/style-director\"]","[\"Measurements\", \"/measurements\"]"]) {
  if (!restoredShell.includes(requiredLink)) throw new Error(`Navigation regression: public shell missing ${requiredLink}`);
}

const restoredMannequin = fs.readFileSync("src/components/AtelierMannequin.tsx","utf8");
for (const token of ["tucked = true","const waistband","Split trouser construction","Hands must remain uncovered","shirtBottom = tucked"]) {
  if (!restoredMannequin.includes(token)) throw new Error(`Tucked mannequin regression: missing ${token}`);
}

const restoredAi = fs.readFileSync("src/lib/ai-visualization.ts","utf8");
for (const token of ["fabric must never spill","waistband in front of it","distinct trouser crotch seam"]) {
  if (!restoredAi.includes(token)) throw new Error(`Photoreal garment-boundary regression: missing ${token}`);
}

console.log("Restored Designer model gate passed: Style Director visible, public nav cleaned, tucked garment boundaries protected.");


const photoPreview = fs.readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
for (const token of ["PHOTO_TUCKED_SHIRT_CLIP","PHOTO_TUCKED_TROUSER_CLIP","PHOTO_TUCKED_SHIRT_BODY_CLIP","PHOTO_TUCKED_LEFT_SLEEVE_CLIP","PHOTO_TUCKED_RIGHT_SLEEVE_CLIP","PHOTO_TUCKED_LEFT_TROUSER_CLIP","PHOTO_TUCKED_RIGHT_TROUSER_CLIP","destination-in","masks.shirt","masks.pant","featherMaskInside","featheredMasks","patternScaleForFabric","placement.offsetX","soft-light","Zoom fit","Compare","Boundary QA"]) {
  if (!photoPreview.includes(token)) throw new Error(`Real photographic Designer regression: PhotoOutfitPreview missing ${token}`);
}
const photoGeometry = fs.readFileSync("src/lib/designer/photo-preview.ts","utf8");
for (const token of ["PHOTO_TUCKED_SHIRT_CLIP","PHOTO_TUCKED_SHIRT_BODY_CLIP","PHOTO_TUCKED_LEFT_SLEEVE_CLIP","PHOTO_TUCKED_RIGHT_SLEEVE_CLIP","PHOTO_TUCKED_TROUSER_CLIP","PHOTO_TUCKED_LEFT_TROUSER_CLIP","PHOTO_TUCKED_RIGHT_TROUSER_CLIP","PHOTO_TUCKED_NECK_CLEAR","/designer/studio-tucked.webp"]) {
  if (!photoGeometry.includes(token)) throw new Error(`Real photographic Designer regression: photo-preview missing ${token}`);
}
console.log("Real photographic Designer gate passed: hard garment boundaries, neck clear zone and tucked layering protected.");


const realDesignerModule = fs.readFileSync("src/components/DesignerModule.tsx","utf8");
for (const token of ["linen-earth:real-designer-draft:v2","draftReady","localStorage.setItem(DRAFT_KEY","creative:activeCreative","parsed?.creative","creativeStillMatches","resetDraft",">Reset<"]) {
  if (!realDesignerModule.includes(token)) throw new Error(`Real Designer draft regression: missing ${token}`);
}
console.log("Real Designer draft gate passed: fabric, context and tailoring state persist safely across refresh.");


const publicHome = fs.readFileSync("src/app/page.tsx","utf8");
for (const token of ["/real-model","Open Real Model Designer","photographic studio form","Linen Earth"]) {
  if (!publicHome.includes(token)) throw new Error(`Real Designer public-route regression: homepage missing ${token}`);
}
console.log("Real Designer route gate passed: public navigation points to the photographic Designer while the legacy dashboard remains available separately.");


const styleDirectorPage = fs.readFileSync("src/app/style-director/page.tsx","utf8");
for (const token of ["designerHandoff","/designer-studio?","Open Linen Earth Real Model Designer","from:\"style-director\""]) {
  if (!styleDirectorPage.includes(token)) throw new Error(`Style Director handoff regression: missing ${token}`);
}
for (const token of ["URLSearchParams(window.location.search)","routedShirt","routedPant","routedStyle","directorHandoff","STYLE DIRECTOR HANDOFF"]) {
  if (!realDesignerModule.includes(token)) throw new Error(`Real Designer handoff regression: missing ${token}`);
}
console.log("Style Director handoff gate passed: context, resolved stock pair and cut transfer into photographic Designer.");


for (const token of ["matchPhotographedOfficeModel","Point (Standard) Collar","Barrel Cuff (1-button)","Pleated Trouser","Belt Loops","Office preset"]) {
  if (!realDesignerModule.includes(token)) throw new Error(`Photographed office preset regression: missing ${token}`);
}
console.log("Photographed office preset gate passed: the selected cut can be aligned exactly to the tucked model template.");


const styleDirectorAgentHandoff = fs.readFileSync("src/lib/style-director-agent.ts","utf8");
for (const token of ["StyleDirectorRealModelSpec","buildRealModelSpec","DESIGNER_SHIRTS","DESIGNER_PANTS","evaluateDesignerCombo","shirtName","pantName","style: best.style"]) {
  if (!styleDirectorAgentHandoff.includes(token)) throw new Error(`Style Director real-model spec regression: missing ${token}`);
}
const styleDirectorUiHandoff = fs.readFileSync("src/app/style-director/page.tsx","utf8");
for (const token of ["selectedLook.realModel","Open Linen Earth Real Model Designer","sourceTitle","sourceTier","sourceReason","#designerPhotoTitle","REAL MODEL OUTFIT"]) {
  if (!styleDirectorUiHandoff.includes(token)) throw new Error(`Style Director real-model handoff regression: missing ${token}`);
}
const realModelDesignerHandoff = fs.readFileSync("src/components/DesignerModule.tsx","utf8");
for (const token of ['params.get("shirt")','params.get("pant")','params.get("style")',"sourceTitle","sourceTier","sourceReason","requestLookAssessment({","STYLE DIRECTOR"]) {
  if (!realModelDesignerHandoff.includes(token)) throw new Error(`Real-model Director loading regression: missing ${token}`);
}
console.log("Style Director real-model spec gate passed: full pair, cut, context and auto-assessment handoff protected.");

const styleDirectorRealModelPreview = fs.readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
for (const token of ["StyleDirectorRealModelPreview","Existing Linen Earth real model","composePhotoOutfit","DESIGNER_PHOTO_TEMPLATES"]) {
  if (!styleDirectorRealModelPreview.includes(token)) throw new Error(`Style Director existing-model preview regression: missing ${token}`);
}
for (const token of ["StyleDirectorRealModelPreview","shirtFabric","pantFabric","Existing real model · live outfit"]) {
  if (!styleDirectorUiHandoff.includes(token)) throw new Error(`Style Director existing-model UI regression: missing ${token}`);
}
console.log("Style Director existing-model gate passed: results reuse the same photographic model and selected outfit without creating a new model.");

const designerBriefRoute = fs.readFileSync("src/app/api/designer/brief/route.ts","utf8");
const designerBriefEngine = fs.readFileSync("src/lib/designer/brief.ts","utf8");
const designerSearch = fs.readFileSync("src/lib/designer/search.ts","utf8");
for (const token of ["parseDesignerBrief","searchDesignerCatalogue","scope:\"open\"","tierOrder"]) {
  if (!designerBriefRoute.includes(token)) throw new Error(`One-line Designer route regression: missing ${token}`);
}
for (const token of ["occasionFrom","climateFrom","intentionFrom","colorPreferences","preferredTier","semi[-\\s]?formal","\\bformal\\b"]) {
  if (!designerBriefEngine.includes(token)) throw new Error(`One-line Designer interpretation regression: missing ${token}`);
}
for (const token of ["occasionFabricAlignment","formal shirting","printed linen blend","occasionScore","occasionPreferredShirts","strictOccasionFit","openShirts"]) {
  if (!designerSearch.includes(token)) throw new Error(`One-line Designer occasion separation regression: missing ${token}`);
}
for (const token of ["/api/designer/brief","newDesignerBrief","Create 3 directions","one_line_designer_brief","StyleDirectorRealModelPreview","newDesignerBriefModel","SAME LINEN EARTH MODEL","newDesignerBriefCut","Occasion match:"]) {
  if (!realDesignerModule.includes(token)) throw new Error(`One-line Designer UI regression: missing ${token}`);
}
for (const token of ["fabricPairDiffers","Prefer genuinely different fabric pairs","occasionPreferredShirts"]) {
  if (!designerSearch.includes(token)) throw new Error(`One-line Designer diversity regression: missing ${token}`);
}
console.log("One-line Designer gate passed: natural brief, stock search, fit context and three-direction handoff protected.");
const browserTasteMemory = fs.readFileSync("src/lib/browser-style-memory.ts","utf8");
for (const token of ["readLocalDesignerTasteProfile","evidence<4","preferredTier","preferredShirtWear","preferredTrouser"]) {
  if (!browserTasteMemory.includes(token)) throw new Error(`Local Designer taste-profile regression: missing ${token}`);
}
for (const token of ["safeTasteProfile","personalizeBrief","learned preference:","linen-designer-brief-v2"]) {
  if (!designerBriefRoute.includes(token)) throw new Error(`Personalized one-line Designer regression: missing ${token}`);
}
console.log("Local taste-profile gate passed: repeated non-sensitive Designer choices can personalize future briefs only after conservative evidence thresholds.");

for (const token of ["fitAdaptedStyle","Fit-aware adjustment:","suggestedPatch","fitAdaptation"]) {
  if (!designerSearch.includes(token)) throw new Error(`Measurement-to-cut intelligence regression: missing ${token}`);
}
const blockStrategySource = fs.readFileSync("src/lib/designer/block-strategy.ts","utf8");
for (const token of ['patch.shirtFit = "Regular / Classic Fit"','patch.trouser = "Pleated Trouser"',"BLOCK-TORSO-STRAIGHT","BLOCK-SEAT-FLATFRONT"]) {
  if (!blockStrategySource.includes(token)) throw new Error(`Fit patch regression: missing ${token}`);
}
for (const token of ["fitAdaptation","newDesignerBriefFit","FIT-AWARE"]) {
  if (!realDesignerModule.includes(token)) throw new Error(`Fit-aware Designer UI regression: missing ${token}`);
}
console.log("Measurement-to-cut gate passed: saved proportions and tailor observations can alter the recommended starting cut, with the adjustment shown to the customer.");

const designerEngineFabricIntelligence = fs.readFileSync("src/lib/designer/engine.ts","utf8");
for (const token of ["catalogueStyleFormality","formal shirting","printed linen blend"]) {
  if (!designerEngineFabricIntelligence.includes(token)) throw new Error(`Catalogue fabric intelligence regression: missing ${token}`);
}
if (!designerEngineFabricIntelligence.includes('roleTags: fabric.roleTags?.length ? [...fabric.roleTags] : null')) {
  throw new Error("Catalogue fabric intelligence regression: verified accent-role uncertainty must remain intact.");
}
console.log("Catalogue fabric intelligence gate passed: formal/casual catalogue role influences Designer ranking without inventing physical GSM, drape or accent safety.");

const fabricAnalyzerSource = fs.readFileSync("src/lib/fabric-analyzer.ts","utf8");
const fabricAnalyzerTaxonomy = fs.readFileSync("src/lib/fabric-analyzer-taxonomy.ts","utf8");
for (const token of ['import "server-only"',"analyzeMenswearFabric","verifiedFacts","visualObservations","uncertainClaims","FABRIC_ANALYZER_EVIDENCE_RULES.join","Never claim exact fibre composition"]) {
  if (!fabricAnalyzerSource.includes(token)) throw new Error(`Private Fabric Analyzer regression: missing ${token}`);
}
for (const token of ["MENSWEAR_MATERIAL_TAXONOMY","MENSWEAR_PATTERN_TAXONOMY","MENSWEAR_COLOR_TAXONOMY","FABRIC_ANALYZER_EVIDENCE_RULES"]) {
  if (!fabricAnalyzerTaxonomy.includes(token)) throw new Error(`Private Fabric Analyzer taxonomy regression: missing ${token}`);
}
if (realDesignerModule.includes("fabric-analyzer")) throw new Error("Fabric Analyzer privacy regression: customer Designer UI must not import the backend analyzer.");
console.log("Private Fabric Analyzer gate passed: server-only visual analysis and menswear taxonomy remain backend-only.");

const analyzerOperatorPage=fs.readFileSync("src/app/operator/fabric-analyzer/page.tsx","utf8");
const analyzerOperatorClient=fs.readFileSync("src/app/operator/fabric-analyzer/FabricAnalyzerClient.tsx","utf8");
for(const token of ["verifyOperatorSession","/operator/login?next=/operator/fabric-analyzer","FabricAnalyzerClient"]) {
  if(!analyzerOperatorPage.includes(token)) throw new Error(`Fabric Analyzer operator-page privacy regression: missing ${token}`);
}
for(const token of ["/api/operator/fabric-analyzer/analyze","macroImageUrl","foldImageUrl","verifiedGsm","verifiedDrape","Approve profile","BACKEND ONLY"]) {
  if(!analyzerOperatorClient.includes(token)) throw new Error(`Fabric Analyzer operator workflow regression: missing ${token}`);
}
for(const token of ['Photo protocol image order is FLAT','Use MACRO only for texture/weave appearance','Use FOLD only for visual structure/fall appearance','input.macroImageUrl','input.foldImageUrl']) {
  if(!fabricAnalyzerSource.includes(token)) throw new Error(`Fabric Analyzer capture-protocol regression: missing ${token}`);
}
console.log("Fabric Analyzer operator gate passed: private capture protocol and review workflow remain authenticated and backend-only.");

const fabricReferenceIndex = fs.readFileSync("src/lib/fabric-analyzer-reference-index.ts","utf8");
for (const token of ["REAL_MENSWEAR_MATERIAL_TERMS","REAL_MENSWEAR_PATTERN_TERMS","STANDARD_COLOR_REFERENCE_TERMS","FABRIC_REFERENCE_SOURCES","real-reference-v3"]) {
  if (!fabricReferenceIndex.includes(token)) throw new Error(`Real-reference Fabric Analyzer regression: missing ${token}`);
}
const fabricAnalyzerExamples = fs.readFileSync("src/lib/fabric-analyzer-real-examples.ts","utf8");
for (const token of ["fabric-analyzer-v4","FABRIC_REFERENCE_COUNTS","retainKnown","references:{","Retrieved real-reference subset","REAL_MENSWEAR_FABRIC_EXAMPLES","REAL_MENSWEAR_FABRIC_EXAMPLE_COUNT","Never transfer composition","Closed output IDs","colorFamilies.map","collarOptions.map"]) {
  if (!fabricAnalyzerSource.includes(token)) throw new Error(`Fabric Analyzer V4 provenance regression: missing ${token}`);
}
for (const token of ["REAL_MENSWEAR_FABRIC_EXAMPLES","REAL_MENSWEAR_FABRIC_EXAMPLE_COUNT","AUTO-GENERATED","source_id","composition","pattern_name"]) {
  if (!fabricAnalyzerExamples.includes(token)) throw new Error(`Real fabric-example corpus regression: missing ${token}`);
}
const fabricAnalyzerProvenance = fs.readFileSync("src/lib/fabric-analyzer-provenance-map.ts","utf8");
for (const token of ["FABRIC_REFERENCE_PROVENANCE","AUTO-GENERATED provenance map","source_id","materials","patterns","colors"]) {
  if (!fabricAnalyzerProvenance.includes(token)) throw new Error(`Fabric reference provenance regression: missing ${token}`);
}
for (const token of ["FABRIC_REFERENCE_PROVENANCE","sourceIdsForReferences","backend derives source IDs"]) {
  if (!fabricAnalyzerSource.includes(token)) throw new Error(`Fabric Analyzer provenance enforcement regression: missing ${token}`);
}
if (realDesignerModule.includes("fabric-analyzer-reference-index") || realDesignerModule.includes("fabric-analyzer-real-examples")) {
  throw new Error("Fabric Analyzer privacy regression: real reference corpus must remain server-only.");
}
console.log("Real-reference Fabric Analyzer gate passed: source-backed corpus and closed-vocabulary V4 analysis remain backend-only.");

const fabricAnalyzerStore = fs.readFileSync("src/lib/fabric-analyzer-store.ts","utf8");
for (const token of ["fabricAnalysisFingerprint","loadStoredFabricAnalysis","storeFabricAnalysis","recordFabricAnalyzerCorrection","loadFabricAnalyzerLearningHints","fabric_analyzer_learning_summary","SUPABASE_SECRET_KEY"]) {
  if (!fabricAnalyzerStore.includes(token)) throw new Error(`Fabric Analyzer private-store regression: missing ${token}`);
}
for (const token of ["analyzeMenswearFabricWithStore","loadFabricAnalyzerLearningHints","Reviewed correction learning:","reviewed corrections","Explicit supplier/owner facts outrank learned hints"]) {
  if (!fabricAnalyzerSource.includes(token)) throw new Error(`Fabric Analyzer learning-loop regression: missing ${token}`);
}
if (realDesignerModule.includes("fabric-analyzer-store")) throw new Error("Fabric Analyzer privacy regression: profile storage/learning must remain server-only.");
console.log("Fabric Analyzer learning gate passed: reviewed corrections can feed aggregate backend guidance without exposing the analyzer in customer UI.");

const fabricIntelligenceTypes=fs.readFileSync("src/lib/fabric-intelligence-types.ts","utf8");
const fabricIntelligenceServer=fs.readFileSync("src/lib/fabric-intelligence-server.ts","utf8");
for(const token of ["DesignerFabricIntelligence","trust:\"reviewed\"|\"high-confidence\"|\"provisional\"","recommendedConstruction","pairing"]) {
  if(!fabricIntelligenceTypes.includes(token)) throw new Error(`Fabric Intelligence type regression: missing ${token}`);
}
for(const token of ['import "server-only"',"loadDesignerFabricIntelligence","loadFabricAnalysesForFabricIds","high-confidence","reviewed"]) {
  if(!fabricIntelligenceServer.includes(token)) throw new Error(`Fabric Intelligence server regression: missing ${token}`);
}
for(const token of ["fabricIntelligenceAlignment","fabricIntelligence?: Record<string,DesignerFabricIntelligence>","intelligenceScore"]) {
  if(!designerSearch.includes(token)) throw new Error(`Designer Fabric Intelligence ranking regression: missing ${token}`);
}
for(const path of ["src/app/api/designer/brief/route.ts","src/app/api/designer/search/route.ts","src/app/api/style-director/route.ts"]) {
  const source=fs.readFileSync(path,"utf8");
  if(!source.includes("loadDesignerFabricIntelligence") && !source.includes("enrichDesignerFabricsWithIntelligence")) {
    throw new Error(`Private Fabric Intelligence integration regression: ${path} no longer loads/enriches server-side intelligence.`);
  }
}
const styleDirectorAgentIntelligence=fs.readFileSync("src/lib/style-director-agent.ts","utf8");
for(const token of ["directorIntelligenceScore","directorPairIntelligenceScore","DesignerFabricIntelligence"]) {
  if(!styleDirectorAgentIntelligence.includes(token)) throw new Error(`Style Director Fabric Intelligence regression: missing ${token}`);
}
for(const path of ["src/components/DesignerModule.tsx","src/app/style-director/page.tsx"]) {
  const source=fs.readFileSync(path,"utf8");
  if(source.includes("fabric-intelligence-server") || source.includes("fabric-analyzer-store") || source.includes("fabric-analyzer-reference-index")) {
    throw new Error(`Fabric Intelligence privacy regression: backend internals leaked into customer UI at ${path}.`);
  }
}
console.log("Fabric Intelligence integration gate passed: Analyzer output affects Designer ranking server-side without entering customer payloads.");

const analyzerReviewResetMigration=fs.readFileSync("supabase/migrations/20260930_fabric_analyzer_reanalysis_review_reset.sql","utf8");
for(const token of ["fabric_analyzer_profile_upsert","review_status='unreviewed'","review_notes=''","prior human approval"]) {
  if(!analyzerReviewResetMigration.includes(token)) throw new Error(`Fabric Analyzer re-analysis review-reset regression: missing ${token}`);
}
console.log("Fabric Analyzer re-analysis gate passed: changed model output cannot inherit an older human approval.");

const analyzerStoreSource=fs.readFileSync("src/lib/fabric-analyzer-store.ts","utf8");
for(const token of ["fabric_analyzer_profile_bind","fabric_analyzer_profiles_for_fabrics","fabric_analyzer_profile_review","fabric_analyzer_feedback_apply","loadFabricAnalyzerProfilesForReview","enqueueFabricAnalyzerBatch","claimFabricAnalyzerJobs","finishFabricAnalyzerJob","loadFabricAnalyzerStats","canonicalUrlIdentity"]) {
  if(!analyzerStoreSource.includes(token)) throw new Error(`Fabric Analyzer workflow regression: missing ${token}`);
}
const analyzerOperatorRoutes=[
  "src/app/api/operator/fabric-analyzer/analyze/route.ts",
  "src/app/api/operator/fabric-analyzer/batch/route.ts",
  "src/app/api/operator/fabric-analyzer/review/route.ts",
  "src/app/api/operator/fabric-analyzer/stats/route.ts",
  "src/app/api/operator/fabric-analyzer/calibrate/route.ts",
  "src/app/api/operator/fabric-analyzer/queue/route.ts",
  "src/app/api/operator/fabric-analyzer/process/route.ts",
];
for(const path of analyzerOperatorRoutes) {
  if(!fs.existsSync(path)) throw new Error(`Private Fabric Analyzer operator route missing: ${path}`);
  const source=fs.readFileSync(path,"utf8");
  if(!source.includes("verifyOperatorSession")) throw new Error(`Fabric Analyzer operator auth regression: ${path}`);
}
const legacyFabricAnalyze=fs.readFileSync("src/app/api/fabric/analyze/route.ts","utf8");
for(const token of ["verifyOperatorSession","OPERATOR_COOKIE","Not found.","sameOrigin"]) {
  if(!legacyFabricAnalyze.includes(token)) throw new Error(`Legacy fabric analysis privacy regression: missing ${token}`);
}
console.log("Fabric Analyzer privacy gate passed: legacy and advanced analysis endpoints require operator authentication.");
const directCaptureInput=fs.readFileSync("src/lib/fabric-capture-input.ts","utf8");
const directCapturePicker=fs.readFileSync("src/app/operator/fabric-analyzer/FabricCapturePicker.tsx","utf8");
const directCaptureRoute=fs.readFileSync("src/app/api/operator/fabric-analyzer/analyze/route.ts","utf8");
for(const token of ["directFabricCaptureBytes","DIRECT_FABRIC_CAPTURE_MAX_BYTES","operator-direct-capture"]) {
  if(!directCaptureInput.includes(token)) throw new Error(`Direct Fabric Analyzer capture regression: missing ${token}`);
}
for(const token of ["createImageBitmap","image/jpeg","850_000","Use photo from device"]) {
  if(!directCapturePicker.includes(token)) throw new Error(`Direct Fabric Analyzer capture UI regression: missing ${token}`);
}
for(const token of ["DIRECT_FABRIC_CAPTURE_MAX_CHARS","isDirectFabricCapture","3_800_000"]) {
  if(!directCaptureRoute.includes(token)) throw new Error(`Direct Fabric Analyzer route regression: missing ${token}`);
}
console.log("Direct Fabric Analyzer capture gate passed: authenticated local photos are compressed, bounded and never persisted as raw payloads.");
const analyzerOperatorClient=fs.readFileSync("src/app/operator/fabric-analyzer/FabricAnalyzerClient.tsx","utf8");
for(const token of ["approveAndNext","Approve + next fabric","evidence?.priority","/operator/designer-data"]) {
  if(!analyzerOperatorClient.includes(token)) throw new Error(`Analyzer evidence-session regression: missing ${token}`);
}
console.log("Analyzer evidence-session gate passed: approved profiles can advance directly to the next priority fabric.");
const fabricStudioMounts=sourceFiles("src").filter((path)=>path!=="src/components/FabricStudio.tsx")
  .filter((path)=>fs.readFileSync(path,"utf8").includes("FabricStudio"));
if(fabricStudioMounts.length) throw new Error(`Fabric Analyzer privacy regression: legacy FabricStudio is mounted by ${fabricStudioMounts.join(", ")}`);
console.log("Fabric Analyzer UI gate passed: legacy FabricStudio remains unmounted from customer routes.");

const calibrationSource=fs.readFileSync("src/lib/fabric-analyzer-calibration.ts","utf8");
for(const token of ["runFabricAnalyzerCalibration","loadFabricAnalyzerCalibrationCases","recordFabricAnalyzerCalibration","formality range"]) {
  if(!calibrationSource.includes(token)) throw new Error(`Fabric Analyzer calibration regression: missing ${token}`);
}
console.log("Fabric Analyzer calibration gate passed: source-backed reference cases can continuously measure Analyzer accuracy.");
for(const token of ["reviewPriority","reviewReasons","reviewPriorityFor","No real-reference material or pattern term was matched"]) {
  if(!fabricAnalyzerSource.includes(token)) throw new Error(`Fabric Analyzer review-priority regression: missing ${token}`);
}
const referenceSyncScript=fs.readFileSync("scripts/sync-fabric-reference-index.mjs","utf8");
for(const token of ["fabric_analyzer_reference_snapshot","fabric-analyzer-reference-index.ts","fabric-analyzer-provenance-map.ts","fabric-analyzer-real-examples.ts"]) {
  if(!referenceSyncScript.includes(token)) throw new Error(`Fabric reference sync regression: missing ${token}`);
}
for(const token of ["OCCASION_INTELLIGENCE_IDS","intelOccasionMatch","patternSupportScore","colorFamilyPairSignal","optionIdForLabel","bothHighContrast","bothBold"]) {
  if(!designerSearch.includes(token)) throw new Error(`Analyzer pairing intelligence regression: missing ${token}`);
}
if(designerSearch.includes("containsLoose(")) throw new Error("Phase 10 vocabulary regression: Designer search reintroduced substring intelligence matching.");
console.log("Fabric Analyzer completion gate passed: durable queueing, review priority, repeatable source sync and deep Designer pairing are protected.");
for(const path of [
  "src/lib/vocab/types.ts",
  "src/lib/vocab/normalization.ts",
  "src/lib/vocab/color-distance.ts",
  "src/lib/vocab/colors.ts",
  "src/lib/vocab/patterns.ts",
  "src/lib/vocab/styling.ts",
  "src/lib/vocab/designer-options.ts",
  "src/lib/vocab/intelligence.ts",
  "src/lib/fabric-intelligence-adapter.ts",
  "tests/phase10-vocab.test.ts",
]) {
  if(!fs.existsSync(path)) throw new Error(`Phase 10 vocabulary foundation missing: ${path}`);
}
const vocabNormalize=fs.readFileSync("src/lib/vocab/normalization.ts","utf8");
for(const token of ["normalizeToken","normalizeArray","reviewNeeded"]) if(!vocabNormalize.includes(token)) throw new Error(`Phase 10 vocab regression: missing ${token}`);
const fabricAdapter=fs.readFileSync("src/lib/fabric-intelligence-adapter.ts","utf8");
for(const token of ["fabric-analyzer-v3","fabric-analyzer-v4","adaptFabricProfileToV4","reviewNeeded"]) if(!fabricAdapter.includes(token)) throw new Error(`Phase 10 v3 adapter regression: missing ${token}`);
const legacyDesignerEngine=fs.readFileSync("src/lib/designer-engine.ts","utf8");
if(legacyDesignerEngine.includes('family.includes("tr")')) throw new Error("Phase 10 regression: legacy Designer reintroduced broad TR substring matching.");
console.log("Phase 10A gate passed: closed vocabularies, exact-id pairing, v3 compatibility and legacy-family cleanup are protected.");
const fabricAnalyzerMigration="supabase/migrations/20260929_fabric_analyzer_private_backend.sql";
if(!fs.existsSync(fabricAnalyzerMigration)) throw new Error("Fabric Analyzer backend migration is missing.");
const fabricAnalyzerMigrationSource=fs.readFileSync(fabricAnalyzerMigration,"utf8");
for(const token of ["private.fabric_analysis_profiles","private.fabric_analysis_bindings","fabric_analyzer_feedback_apply","fabric_analyzer_profiles_for_fabrics","fabric_analyzer_calibration_cases_get","service_role"]) {
  if(!fabricAnalyzerMigrationSource.includes(token)) throw new Error(`Fabric Analyzer migration regression: missing ${token}`);
}
console.log("Fabric Analyzer migration gate passed: private corpus/profile/review/calibration backend is reproducible.");


const photoPreviewMultiView = fs.readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
const selectedLookRenderRoute = fs.readFileSync("src/app/api/designer/look-render/route.ts","utf8");
for (const token of ["PhotorealView","choosePhotorealView","three-quarter","Generate 3/4","photorealViews"]) {
  if (!photoPreviewMultiView.includes(token)) throw new Error(`Photoreal multi-view UI regression: missing ${token}`);
}
for (const token of ["renderSelectedLookFashnView","frontImage","three-quarter","side","back"]) {
  if (!selectedLookRenderRoute.includes(token)) throw new Error(`Photoreal multi-view route regression: missing ${token}`);
}
console.log("Photoreal multi-view gate passed: front, three-quarter, side and back generation paths protected.");

const selectedLookQaRoute = fs.readFileSync("src/app/api/designer/look-inspect/route.ts","utf8");
const selectedLookRenderEngine = fs.readFileSync("src/lib/ai-visualization.ts","utf8");
for (const token of ["inspectSelectedLookFashnOutput","SelectedLookVisualCheck","repairSelectedLookFashnFront","assertFashnRepairRateLimit"]) {
  if (!selectedLookRenderEngine.includes(token)) throw new Error(`Selected-look render QA regression: missing ${token}`);
}
for (const token of ["inspectSelectedLookFashnOutput","cache-control","no-store"]) {
  if (!selectedLookQaRoute.includes(token)) throw new Error(`Selected-look QA route regression: missing ${token}`);
}
for (const token of ["/api/designer/look-inspect","selectedCheck","Repair once","repairSelectedLook"]) {
  if (!photoPreviewMultiView.includes(token)) throw new Error(`Selected-look QA UI regression: missing ${token}`);
}
console.log("Selected-look render QA gate passed: normal photoreal looks are inspected and allow one targeted repair without redesign.");
for (const token of ["view:SelectedLookView=\"front\"","Expected camera/view:","three-quarter","side","back"]) {
  if (!selectedLookRenderEngine.includes(token)) throw new Error(`Multi-view photoreal QA regression: missing ${token}`);
}
for (const token of ["activeSelectedCheck","inspectSelectedLook(data.result,view)","This camera view needs review"]) {
  if (!photoPreviewMultiView.includes(token)) throw new Error(`Multi-view QA UI regression: missing ${token}`);
}
console.log("Photoreal multi-view QA gate passed: generated three-quarter, side and back views are checked for model, cloth and construction consistency.");
const selectedLookDownload = fs.readFileSync("src/app/api/designer/look-download/route.ts","utf8");
for (const token of ["OFFICIAL_FASHN_OUTPUT","content-disposition","private, no-store"]) {
  if (!selectedLookDownload.includes(token)) throw new Error(`Photoreal download regression: missing ${token}`);
}
for (const token of ["/api/designer/look-download","activeImage","encodeURIComponent(activeImage)"]) {
  if (!photoPreviewMultiView.includes(token)) throw new Error(`Photoreal save UI regression: missing ${token}`);
}
console.log("Photoreal save gate passed: Save exports the active trusted photoreal view instead of the hidden instant canvas.");


const measurementPage = fs.readFileSync("src/app/measurements/page.tsx","utf8");
for (const token of ["MEASUREMENT STUDIO","See exactly where","MeasurementStudio","blueprint"]) {
  if (!measurementPage.includes(token)) throw new Error(`Measurement blueprint page regression: missing ${token}`);
}
const measurementStudio = fs.readFileSync("src/components/MeasurementStudio.tsx","utf8");
for (const token of ["SHIRT BLUEPRINT","TROUSER BLUEPRINT","guide active","active===id","NECK","CHEST","INSEAM","OUTSEAM","/designer-studio"]) {
  if (!measurementStudio.includes(token)) throw new Error(`Measurement blueprint interaction regression: missing ${token}`);
}
const measurementCss = fs.readFileSync("src/app/measurements/measurements.css","utf8");
for (const token of [".measurementIntroBlueprint",".blueprintGrid",".draftDepth",".draftGarment",".guide.active",".measureBlueprintLegend"]) {
  if (!measurementCss.includes(token)) throw new Error(`Measurement blueprint styling regression: missing ${token}`);
}
const realModelShortcut = fs.readFileSync("src/app/real-model/page.tsx","utf8");
for (const token of ["redirect","/designer-studio"]) {
  if (!realModelShortcut.includes(token)) throw new Error(`Real Model shortcut regression: missing ${token}`);
}
console.log("Measurement blueprint gate passed: the existing Measurements page now uses garment-specific blueprint guidance; Real Model remains a separate direct entry.");


const realDesignerMeasurements = fs.readFileSync("src/components/DesignerModule.tsx","utf8");
for (const token of ["MEASUREMENT_STORAGE_KEY","measurementCoverage","measurementFitGuidance","newDesignerFitCompact","Fit details","MEASUREMENTS","FIT PROFILE ·"]) {
  if (!realDesignerMeasurements.includes(token)) throw new Error(`Designer measurement-fit regression: missing ${token}`);
}
const realDesignerMeasurementCss = fs.readFileSync("src/app/designer-studio/designer-light.css","utf8");
for (const token of [".newDesignerFitProfile",".newDesignerMeasureChips",".newDesignerFitNotes",".newDesignerFitModelNote"]) {
  if (!realDesignerMeasurementCss.includes(token)) throw new Error(`Designer measurement-fit styling regression: missing ${token}`);
}
console.log("Designer measurement-fit gate passed: saved blueprint measurements surface as tailoring guidance without pretending to resize the photographic model.");


const fitConstructionV2 = fs.readFileSync("src/lib/designer/fit-construction.ts","utf8");
for (const token of ["fit-construction-provisional-1","SHIRT_EASE","TROUSER_EASE","assessFitConstruction","Finished collar circumference","Finished trouser seat","FIT-TROUSER-SEAT","CONTEXT-EASE","FABRIC-DRAPE-TROUSER","provisional_house_defaults"]) {
  if (!fitConstructionV2.includes(token)) throw new Error(`Fit Construction V2 regression: missing ${token}`);
}
const plannerV2 = fs.readFileSync("src/lib/designer/planner.ts","utf8");
for (const token of ["MeasurementProfile","FitConstructionAssessment","assessFitConstruction","fitConstruction","item.recommendation.designFitScore * .50","item.fitConstruction?.fitScore ?? 70) * .25","item.blockStrategy?.score ?? 70) * .15"]) {
  if (!plannerV2.includes(token)) throw new Error(`Fit-aware Designer planner regression: missing ${token}`);
}
const designerV2 = fs.readFileSync("src/components/DesignerModule.tsx","utf8");
for (const token of ["fitConstruction=assessment?.fitConstruction","Tailoring checks are active","Fit/construction:","measurementProfile","newDesignerTechnicalDrawer","requestLookAssessment"]) {
  if (!designerV2.includes(token)) throw new Error(`Fit Construction V2 UI regression: missing ${token}`);
}
console.log("Fit Construction V2 gate passed: provisional ease ranges, finished-garment targets, construction checks and measurement-aware cut ranking protected.");


const designerNegotiation = fs.readFileSync("src/lib/designer/constraint-negotiation.ts","utf8");
for (const token of ["designer-negotiation-v1","buildDesignerNegotiation","hard_blocker","fit_tradeoff","actions","TRY-PLEATED-BLOCK","MEASURE-SHIRT-LENGTH","VERIFY-TROUSER-DRAPE"]) {
  if (!designerNegotiation.includes(token)) throw new Error(`Designer negotiation regression: missing ${token}`);
}
const designerNegotiationUi = fs.readFileSync("src/components/DesignerModule.tsx","utf8");
for (const token of ["negotiation=assessment?.negotiation","negotiation?.blockers","newDesignerAdvancedResult","Technical details"]) {
  if (!designerNegotiationUi.includes(token)) throw new Error(`Designer negotiation UI regression: missing ${token}`);
}
console.log("Designer negotiation gate passed: blockers, verification gaps, fit trade-offs and smallest corrective actions protected.");


const outcomeLearning = fs.readFileSync("src/lib/designer/outcome-learning.ts","utf8");
for (const token of ["DESIGNER_FEEDBACK_REASONS","summarizeDesignerOutcomes","sufficientForLearning","topReason","too_bold","fit_cut","construction"]) {
  if (!outcomeLearning.includes(token)) throw new Error(`Designer outcome learning regression: missing ${token}`);
}
const memoryEventRoute = fs.readFileSync("src/app/api/memory/event/route.ts","utf8");
for (const token of ["DESIGNER_FEEDBACK_REASONS","payload.reason","shirtId:text(payload.shirtId","styleInput"]) {
  if (!memoryEventRoute.includes(token)) throw new Error(`Structured Designer feedback API regression: missing ${token}`);
}
const outcomeDesignerUi = fs.readFileSync("src/components/DesignerModule.tsx","utf8");
for (const token of ["giveFeedback","recommendationId","newDesignerFeedbackCompact","Like this direction?"]) {
  if (!outcomeDesignerUi.includes(token)) throw new Error(`Structured Designer feedback UI regression: missing ${token}`);
}
const cloudSummaryLearning = fs.readFileSync("src/app/api/operator/cloud-summary/route.ts","utf8");
for (const token of ["summarizeDesignerOutcomes","designerLearning"]) {
  if (!cloudSummaryLearning.includes(token)) throw new Error(`Designer learning cloud summary regression: missing ${token}`);
}
const operatorLearning = fs.readFileSync("src/app/operator/OperatorClient.tsx","utf8");
for (const token of ["DESIGNER LEARNING","Why directions are being rejected.","sufficientForLearning","designerLearningReasons"]) {
  if (!operatorLearning.includes(token)) throw new Error(`Operator Designer learning regression: missing ${token}`);
}
console.log("Designer outcome learning gate passed: structured rejection reasons, outfit snapshots and conservative operator learning summaries protected.");


const brandLanguage = fs.readFileSync("src/lib/designer/brand-language.ts","utf8");
for (const token of ["linen-earth-brand-language-provisional-1","evaluateLinenEarthBrandLanguage","One garment carries the visual interest","soft ranking signal","Keep one visual hero"]) {
  if (!brandLanguage.includes(token)) throw new Error(`Linen Earth brand language regression: missing ${token}`);
}
const brandPlanner = fs.readFileSync("src/lib/designer/planner.ts","utf8");
for (const token of ["BrandLanguageEvaluation","evaluateLinenEarthBrandLanguage","brandLanguage","item.recommendation.designFitScore * .50","item.fitConstruction?.fitScore ?? 70) * .25","item.blockStrategy?.score ?? 70) * .15","item.brandLanguage?.score ?? 70) * .10"]) {
  if (!brandPlanner.includes(token)) throw new Error(`Brand-aware Designer ranking regression: missing ${token}`);
}
const brandDesignerUi = fs.readFileSync("src/components/DesignerModule.tsx","utf8");
for (const token of ["brandLanguage=assessment?.brandLanguage","brandLanguage","newDesignerResultChips","brandLanguage.mode"]) {
  if (!brandDesignerUi.includes(token)) throw new Error(`Linen Earth brand read UI regression: missing ${token}`);
}
const brandCss = fs.readFileSync("src/app/designer-studio/designer-light.css","utf8");
for (const token of [".newDesignerResultChips",".newDesignerOutcomeCompact"]) {
  if (!brandCss.includes(token)) throw new Error(`Linen Earth brand read styling regression: missing ${token}`);
}
console.log("Linen Earth brand language gate passed: soft taste remains visible and capped at 10% of alternative-cut ranking.");


const canonicalGarmentSpecSource = fs.readFileSync("src/lib/designer/garment-spec.ts","utf8");
for (const token of ["linen-earth-garment-spec-v1","buildCanonicalGarmentSpec","finishedTargets","ready_for_tailor_review","visual_review_required","verification_required","not a cutting pattern"]) {
  if (!canonicalGarmentSpecSource.includes(token)) throw new Error(`Canonical garment spec regression: missing ${token}`);
}
const canonicalDesignerUi = fs.readFileSync("src/components/DesignerModule.tsx","utf8");
for (const token of ["garmentSpec=assessment?.garmentSpec","downloadGarmentSpec","Export garment spec","canonicalGarmentSpecSummary"]) {
  if (!canonicalDesignerUi.includes(token)) throw new Error(`Canonical garment spec UI regression: missing ${token}`);
}
const memoryEventSanitizer = fs.readFileSync("src/app/api/memory/event/route.ts","utf8");
for (const token of ["garmentSpecInput","fitConstructionScore","brandLanguageScore","materialVerification"]) {
  if (!memoryEventSanitizer.includes(token)) throw new Error(`Garment spec telemetry regression: missing ${token}`);
}
const designerRecommendationSanitizer = memoryEventSanitizer.slice(
  memoryEventSanitizer.indexOf('if (type === "designer_recommendation")'),
  memoryEventSanitizer.indexOf('if (type === "designer_preview_opened")')
);
if (designerRecommendationSanitizer.includes("finishedTargets") || designerRecommendationSanitizer.includes("bodyCm")) {
  throw new Error("Privacy regression: designer recommendation telemetry must not persist body or finished garment measurements.");
}
console.log("Canonical garment spec quality gate passed: one synchronized spec drives Designer output while measurement ranges stay local unless explicitly exported.");
const creativeGarmentSpec=fs.readFileSync("src/lib/designer/garment-spec.ts","utf8");
for(const token of ["creative: {","conceptId:string","treatments:Array","pattern: {","Creative treatments are design instructions","creativeVisualReviewRequired","passing photoreal visual review"]) {
  if(!creativeGarmentSpec.includes(token)) throw new Error(`Creative garment spec regression: missing ${token}`);
}
const designerAssessmentRoute = fs.readFileSync("src/app/api/designer/assess/route.ts","utf8");
for(const token of ["buildCanonicalGarmentSpec","creative","visualReview","fitConstruction","brandLanguage","blockStrategy"]) {
  if(!designerAssessmentRoute.includes(token)) throw new Error(`Creative garment assessment regression: missing ${token}`);
}
for(const token of ["activeCreative","creativeTreatmentCount","creativePatternId","garmentSpec=assessment?.garmentSpec"]) {
  if(!realDesignerModule.includes(token)) throw new Error(`Creative garment export regression: missing ${token}`);
}
console.log("Creative garment spec gate passed: selected V5 treatments and pattern instructions survive export and event memory.");
for(const token of ["CanonicalCreativeVisualReview","visualReview:CanonicalCreativeVisualReview","creativeVisualReview"]) {
  if(!creativeGarmentSpec.includes(token)) throw new Error(`Creative visual-review export regression: missing ${token}`);
}
for(const token of ["creativeVisualReview","setCreativeVisualReview(check)","creativeVisualReview?: CreativeVisualCheck","creativeVisualReview }","activeCreative, creativeVisualReview"]) {
  if(!realDesignerModule.includes(token)) throw new Error(`Creative render-QA persistence regression: missing ${token}`);
}
console.log("Creative render-QA export gate passed: visual inspection stays attached to the selected creative spec across refresh and export.");


const advancedSearch = fs.readFileSync("src/lib/designer/search.ts","utf8");
for (const token of [
  "DesignerSearchScope","keep_shirt","keep_trouser","open",
  "DesignerSearchTier","Safe","Elevated","Statement",
  "searchDesignerCatalogue","explainWhyNotCurrentPair",
  "hardBlocked","fitConstruction","brandLanguage","noveltyScore",
  "comparisonFor","More of the material decision is supported by verified cloth metadata."
]) {
  if (!advancedSearch.includes(token)) throw new Error(`Designer advanced-search regression: missing ${token}`);
}
const advancedSearchRoute = fs.readFileSync("src/app/api/designer/search/route.ts","utf8");
for (const token of ["searchDesignerCatalogue","loadDesignerEvidenceContext","loadDesignerFabricMetadata","safeMeasurements","safeObservations","results.slice(0,3)","__linenDesignerSearchRate"]) {
  if (!advancedSearchRoute.includes(token)) throw new Error(`Designer server-search regression: missing ${token}`);
}
const designerEvidenceContext = fs.readFileSync("src/lib/designer/evidence-context.ts","utf8");
for (const token of ["server-only","aggregateDesignerCasebook","aggregateFitOutcomes","loadDesignerEvidenceContext"]) {
  if (!designerEvidenceContext.includes(token)) throw new Error(`Designer evidence-context regression: missing ${token}`);
}
const advancedSearchUi = fs.readFileSync("src/components/DesignerModule.tsx","utf8");
for (const token of ["OPTIONAL","Try a different fabric pairing","Show 3 options","Keep shirt","Keep trouser","Change both","Use look","newDesignerOptionalSearch","/api/designer/search","searchLoading","Finding…"]) {
  if (!advancedSearchUi.includes(token)) throw new Error(`Designer advanced-search UI regression: missing ${token}`);
}
const advancedSearchCss = fs.readFileSync("src/app/designer-studio/designer-light.css","utf8");
for (const token of [".newDesignerOptionalSearch",".newDesignerQuickResults",".newDesignerSearchScopes",".newDesignerOptionalSearchRun"]) {
  if (!advancedSearchCss.includes(token)) throw new Error(`Designer advanced-search styling regression: missing ${token}`);
}
if (advancedSearchUi.includes("searchDesignerCatalogue(") || advancedSearchUi.includes("casebookSignal") || advancedSearchUi.includes("fitOutcomeSignal")) {
  throw new Error("Designer V4 architecture regression: ranking evidence or scoring returned to the customer UI.");
}
console.log("Designer advanced-search V4 gate passed: decision matrix and reviewed evidence stay server-side behind a simplified visual surface.");

const retailDesignerUi = fs.readFileSync("src/components/DesignerModule.tsx","utf8");
for (const token of [
  "newDesignerFabricFilters","newDesignerFabricChoices","Plain","Print","Blend","Formal",
  "customerFabricLine","Fabric specs","Creative Lab","designerWhatsAppHref","WhatsApp this exact look","Creative details:","Pattern concept:",
  "Final colour, drape and fit still need physical fabric and sample verification in store.",
  'loading="lazy"'
]) {
  if (!retailDesignerUi.includes(token)) throw new Error(`Designer retail UX regression: missing ${token}`);
}
const retailDesignerCss = fs.readFileSync("src/app/designer-studio/designer-light.css","utf8");
for (const token of [".newDesignerFabricFilters",".newDesignerFabricChoices",".newDesignerCreativeTeaser",".newDesignerTruthNearCta",".newDesignerWhatsAppLook"]) {
  if (!retailDesignerCss.includes(token)) throw new Error(`Designer retail UX styling regression: missing ${token}`);
}
const whatsappHelper = fs.readFileSync("src/lib/whatsapp.ts","utf8");
if (!whatsappHelper.includes("Hi Linen Earth")) throw new Error("WhatsApp brand regression: enquiry copy is not using Linen Earth.");
console.log("Designer retail UX gate passed: filtered visual fabric browsing, retail labels, creative teaser, dynamic WhatsApp context and nearby verification note protected.");

const contactDockCss=fs.readFileSync("src/app/contact-dock.css","utf8");
for(const token of ["@media(max-width:760px)",".floatingInstagram,.floatingContactDock .floatingLocation{display:none}","bottom:78px"]) {
  if(!contactDockCss.includes(token)) throw new Error(`Mobile contact-dock regression: missing ${token}`);
}
const measurementUnitPage=fs.readFileSync("src/app/measurements/page.tsx","utf8");
if(!measurementUnitPage.includes("All measurement entries use <b>inches</b>")) throw new Error("Measurement-unit regression: inches are no longer explicit.");
const layoutSource=fs.readFileSync("src/app/layout.tsx","utf8");
for(const token of ["/brand/linen-earth-logo.png","SITE_URL","alternates: { canonical: SITE_URL }"]) {
  if(!layoutSource.includes(token)) throw new Error(`Metadata/brand asset regression: missing ${token}`);
}
console.log("Designer trust/mobile gate passed: measurement units, corrected social metadata/logo path and mobile dock separation protected.");

const phase10DesignerUi=fs.readFileSync("src/components/DesignerModule.tsx","utf8");
for(const token of ["styleSpec","mergeLegacyIntoStyleSpec","validateStyleSpecV2","LiveConstructionPreview","Studio preview","Live cut study","bodyProfile","bodyProfileFromMeasurements"]) {
  if(!phase10DesignerUi.includes(token)) throw new Error(`Phase 10 canonical Designer regression: missing ${token}`);
}
const phase10StyleSpec=fs.readFileSync("src/lib/designer/style-spec-v2.ts","utf8");
for(const token of ["STYLE_SCHEMA_VERSION=2","mergeLegacyIntoStyleSpec","validateStyleSpecV2","styleSpecRenderSummary"]) {
  if(!phase10StyleSpec.includes(token)) throw new Error(`Phase 10 StyleSpec regression: missing ${token}`);
}
const phase10LivePreview=fs.readFileSync("src/components/LiveConstructionPreview.tsx","utf8");
for(const token of ["onSpecChange","bodyProfile","onBodyProfileChange","BODY_HEIGHT_OPTIONS","BODY_SKIN_TONES"]) {
  if(!phase10LivePreview.includes(token)) throw new Error(`Phase 10 live-preview regression: missing ${token}`);
}
const phase10Body=fs.readFileSync("src/lib/designer/body-profile.ts","utf8");
for(const token of ["BodyPreviewProfile","bodyProfileFromMeasurements","validBodyPreviewProfile","bodyProfileRenderSummary"]) {
  if(!phase10Body.includes(token)) throw new Error(`Phase 10 body-profile regression: missing ${token}`);
}
const phase10RenderRoute=fs.readFileSync("src/app/api/designer/look-render/route.ts","utf8");
for(const token of ["resolved.locked!==true","getCachedSelectedLookRender","loadDurableSelectedLookRender","storeDurableSelectedLookRender","resolveSelectedLookRequest","x-linen-render-cache"]) {
  if(!phase10RenderRoute.includes(token)) throw new Error(`Phase 10 final-render regression: missing ${token}`);
}
const phase10RenderCache=fs.readFileSync("src/lib/designer/render-cache.ts","utf8");
for(const token of ["designer_render_cache_get","designer_render_cache_upsert_v2","loadDesignerRenderCacheStats","loadPopularDesignerRenderPairs"]) {
  if(!phase10RenderCache.includes(token)) throw new Error(`Phase 10 render-cache regression: missing ${token}`);
}
const phase10SelectedLook=fs.readFileSync("src/lib/designer/selected-look-server.ts","utf8");
for(const token of ["resolveSelectedLookRequest","enrichSelectedLookEvidence","loadDesignerFabricMetadata","loadDesignerFabricIntelligence"]) {
  if(!phase10SelectedLook.includes(token)) throw new Error(`Phase 10 canonical selected-look regression: missing ${token}`);
}
const renderCacheMigration=fs.readFileSync("supabase/migrations/20260930_designer_render_cache_observability.sql","utf8");
for(const token of ["private.designer_render_cache","designer_render_cache_upsert_v2","designer_render_cache_stats","designer_render_cache_popular","service_role"]) {
  if(!renderCacheMigration.includes(token)) throw new Error(`Phase 10 render-cache migration regression: missing ${token}`);
}
const phase10Analyzer=fs.readFileSync("src/lib/fabric-analyzer.ts","utf8");
for(const token of ["macroImageUrl","foldImageUrl","Photo protocol image order is FLAT","Macro capture missing","Fold capture missing","captureMeasurements"]) {
  if(!phase10Analyzer.includes(token)) throw new Error(`Phase 10 photo-protocol regression: missing ${token}`);
}
const phase10AnalyzerStore=fs.readFileSync("src/lib/fabric-analyzer-store.ts","utf8");
for(const token of ["macroContentSha256","foldContentSha256","macroImageUrl","foldImageUrl"]) {
  if(!phase10AnalyzerStore.includes(token)) throw new Error(`Phase 10 Analyzer fingerprint regression: missing ${token}`);
}
const analyzerMigration=fs.readFileSync("supabase/migrations/20260929_fabric_analyzer_private_backend.sql","utf8");
for(const token of ["fabric-analyzer-v4","macroImageUrl","foldImageUrl","swatchRealWidthMm","repeatRealMm"]) {
  if(!analyzerMigration.includes(token)) throw new Error(`Phase 10 Analyzer migration regression: missing ${token}`);
}
if(/\bas \$\s*(?:\n|$)/m.test(analyzerMigration) || /\n\$;/.test(analyzerMigration)) {
  throw new Error("Phase 10 Analyzer migration regression: malformed single-dollar function quoting remains.");
}
console.log("Phase 10 destination gate passed: canonical StyleSpec, live cut preview, measurement-aware body profile, final-only FASHN and flat/macro/fold Analyzer protocol are protected.");



const creativeEngine = fs.readFileSync("src/lib/designer/creative-engine.ts","utf8");
for (const token of [
  "generateCreativeDirections","CreativeCriticId","aesthetic","originality","brand","menswear","construction",
  "facets","Proportion","Hierarchy","Rhythm","Harmony","creativeLearningSignalFor","creativeResearch",
  "researchSeed","researchMutationSeeds","ResearchMutationOperator","hybridResearchSeed","researchFreedom","maximum","researchUtilization","explorationClass",
  "maya-apparel-typicality-novelty","constraints-creative-patternmaking","engineered-print-3d-2d",
  "design-fixation-examples","divergent-design-thinking","creative-design-coevolving-spaces",
  "frontierCrossZoneSeed","wrongness-tailoring-2026","tactile-dimensionality-2026","quiet-wild-balance-2026","formless-form-2026","craft-deviation-2026",
  "criticFacetScore","revisionMerit","redesignLoop","Visual critic protected one hero move",
  "sourceDistance","Source distance","too close to a single source mechanism",
  "chooseCreativeRedesign","creativeSeedFamily","repairFamilyBonus","visual_balance","render_mismatch",
  "absoluteFeasibilityBlock","literally unavailable or physically impossible",
  "pairwisePreference","pairwiseTournament","A tiny difference is not meaningful enough",
  "refinementShortlist","sourceDistance","const shortlist=refinementShortlist","directionDiversity","diversityBonus","freshResearch","family:\"tonal\"","Shadow Weft"
]) {
  if (!creativeEngine.includes(token)) throw new Error(`Designer V5 creative-engine regression: missing ${token}`);
}
const creativeLearning = fs.readFileSync("src/lib/designer/creative-learning.ts","utf8");
for (const token of ["designer-creative-learning-v1","creativeFamilyFromConceptId","total<3","Math.max(-5","render_mismatch","renderMismatchReviews","review.reason===\"render_mismatch\"","renderImproved","renderSame","renderWorse","repairFailures","repairSuccess"]) {
  if (!creativeLearning.includes(token)) throw new Error(`Designer V5 creative-learning regression: missing ${token}`);
}
const creativeResearch = fs.readFileSync("src/lib/designer/creative-research.ts","utf8");
for (const token of ["designer-creative-research-v1","designer_creative_research","transformedIdea","patternFamily","active"]) {
  if (!creativeResearch.includes(token)) throw new Error(`Designer V5 creative-research regression: missing ${token}`);
}
const researchPool = fs.readFileSync("src/lib/designer/fashion-research-source-pool.ts","utf8");
for (const token of ["FASHION_RESEARCH_SOURCES","FASHION_RESEARCH_TOPICS","FASHION_RESEARCH_TARGETS","buildFashionResearchTargets","highAuthorityWebsites"]) {
  if (!researchPool.includes(token)) throw new Error(`Designer V5 research-pool regression: missing ${token}`);
}
const sourceRows = (researchPool.match(/\{id:"[^"]+",name:/g) || []).length;
const topicRows = (researchPool.match(/\{id:"[^"]+",query:/g) || []).length;
if (sourceRows * topicRows < 1000) throw new Error(`Designer V5 research pool regression: expected >=1000 source-topic targets, found ${sourceRows * topicRows}`);
const creativeUi = fs.readFileSync("src/components/DesignerModule.tsx","utf8");
for (const token of ["03 / CREATE","Imagine new designs","Create ideas ✦","newDesignerCreativeVisual","newDesignerMiniScores","Fashion research runs quietly in the background.","FRONTIER IDEA","Design reasoning","/api/designer/creative-generate","requestCreativeDirections(12","creativeAutoNote","render_mismatch","onCreativeInspection","severeHeuristicFailure","reliableReview","executionFailure","repairing the same design once","creativeAutoRetryCount>=2"]) {
  if (!creativeUi.includes(token)) throw new Error(`Designer V5 creative UI regression: missing ${token}`);
}
const creativePreview = fs.readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
for (const token of ["creativeDirection","drawCreativePattern","DOES IT WORK?","CREATIVE_FEEDBACK_REASONS","Preview tools","VISUAL CHECK PASSED","onCreativeInspection","newDesignerRenderCheck"]) {
  if (!creativePreview.includes(token)) throw new Error(`Designer V5 visual loop regression: missing ${token}`);
}
if(!creativePreview.includes("Render selected idea ✦") || !creativePreview.includes("Final photoreal ✦") || !creativePreview.includes("Lock final design")) {
  throw new Error("Designer two-tier render regression: creative render and locked final-render controls must stay present.");
}
const aiVisualization = fs.readFileSync("src/lib/ai-visualization.ts","utf8");
for (const token of ["inspectCreativeRender","heroVisibility","boundaryIntegrity","protectedChange","CREATIVE_ZONE_BOXES","PROTECTED_RENDER_BOXES","Visual hierarchy contract","semanticCreativeRenderCheck","ai-gateway.vercel.sh/v1/responses","LINEN_VISUAL_CRITIC_MODEL","openai/gpt-5.4","redesignReason","referenceDataUri","fabricContext","heroAccuracy","fabricFidelity","supportCompetition","Compare them rather than judging","renderCaution","learnedRenderEdit","visualCriticModels","google/gemini-3-flash","semanticCheckNeedsReview","semanticCheckSevere","A second independent visual critic","Visual critics disagreed","previousOutputUrl","improvement","PREVIOUS FAILED/REVIEW RENDER"]) {
  if (!aiVisualization.includes(token)) throw new Error(`Designer V5 render-inspection regression: missing ${token}`);
}
const creativeGenerateRoute = fs.readFileSync("src/app/api/designer/creative-generate/route.ts","utf8");
for (const token of ["generateCreativeDirections","chooseCreativeRedesign","researchFreedom:\"maximum\"","loadDesignerFabricMetadata","loadDesignerCreativeContext","__linenCreativeGenerateRate","contentLength>650_000"]) {
  if (!creativeGenerateRoute.includes(token)) throw new Error(`Designer V5 server-generation route regression: missing ${token}`);
}
if (realDesignerModule.includes("generateCreativeDirections({") || realDesignerModule.includes("chooseCreativeRedesign(") || realDesignerModule.includes("creativeLearning") || realDesignerModule.includes("creativeResearch")) {
  throw new Error("Designer V5 architecture regression: creative intelligence returned to the customer UI bundle.");
}
const creativeContextLoader=fs.readFileSync("src/lib/designer/creative-context.ts","utf8");
for(const token of ["server-only","aggregateCreativeLearning","aggregateCreativeResearch","source:\"eq.operator\"","source:\"eq.style-director\"","loadDesignerCreativeContext"]) {
  if(!creativeContextLoader.includes(token)) throw new Error(`Designer creative-context regression: missing ${token}`);
}
const creativeRenderRoute = fs.readFileSync("src/app/api/designer/creative-render/route.ts","utf8");
for (const token of ["renderCreativeFashnFront","assertFashnRateLimit","CreativeFashnRequest"]) {
  if (!creativeRenderRoute.includes(token)) throw new Error(`Designer V5 photoreal route regression: missing ${token}`);
}
const creativeInspectRoute = fs.readFileSync("src/app/api/designer/creative-inspect/route.ts","utf8");
for (const token of ["inspectCreativeFashnOutput","inspectRateLimited","__linenCreativeInspectRate","temporarily rate limited","previousImage"]) {
  if (!creativeInspectRoute.includes(token)) throw new Error(`Designer V5 visual-inspection route regression: missing ${token}`);
}
const researchDesk = fs.readFileSync("src/app/operator/designer-research/DesignerResearchClient.tsx","utf8");
for (const token of ["Creative Research Desk","RESEARCH → DESIGN TRANSLATOR","Save research signal","Allow this reviewed signal to influence V5 now"]) {
  if (!researchDesk.includes(token)) throw new Error(`Designer V5 research desk regression: missing ${token}`);
}
console.log(`Designer V5 creative-research gate passed: ${sourceRows * topicRows} source-topic discovery targets, maximum-freedom research synthesis, simplified visual UI, photoreal review and capped learning protected.`);

const researchDiscovery=fs.readFileSync("src/lib/designer/research-source-discovery.ts","utf8");
for(const token of ["discoverFashionWebsites","Q3661311","Q11828862","Q607081","Q1505660","Q6297581","Q5436782","Q3501317","Q29583","Promise.allSettled","discoverRoute","All Wikidata fashion research discovery routes failed","slice(0,requested)","wikidata-fashion-magazine","wikidata-fashion-museum"]) {
  if(!researchDiscovery.includes(token)) throw new Error(`Research website discovery regression: missing ${token}`);
}
const researchAnalysis=fs.readFileSync("src/lib/designer/research-source-analysis.ts","utf8");
for(const token of ["analyzeFashionResearchSource","analyzeFashionResearchBatch","offset+=4","Math.min(8","safePublicUrl","resolvePublicAddress","pinnedPageRequest","node:https","node:dns/promises","Research source resolves to a private or local network address","Private or local research URLs are not allowed","linen_research_signal","Do not copy a finished garment","LINEN_RESEARCH_MODEL","google/gemini-3-flash"]) {
  if(!researchAnalysis.includes(token)) throw new Error(`Research synthesis regression: missing ${token}`);
}
const researchDeskUi=fs.readFileSync("src/app/operator/designer-research/DesignerResearchClient.tsx","utf8");
for(const token of ["Discover up to 1,000 websites","discover1000","Analyze source ✦","analyzeCurrentSource","Synthesize 8 diverse sources ✦","analyzeResearchBatch","NEW SYNTHESIS / REVIEW BEFORE ACTIVATING"]) {
  if(!researchDeskUi.includes(token)) throw new Error(`Research desk discovery regression: missing ${token}`);
}
console.log("Designer research-scale gate passed: live discovery can retrieve up to 1,000 distinct official fashion/textile sites and synthesize reviewed principles safely.");



const designerCasebook = fs.readFileSync("src/lib/designer/casebook.ts","utf8");
for (const token of [
  "designer-casebook-v1","designer_case_review","operator_note","event.source!==\"operator\"",
  "total>=3","scale=6","signalFromCounts","casebookSignalFor",
  "Casebook is still collecting reviewed outcomes."
]) {
  if (!designerCasebook.includes(token)) throw new Error(`Designer casebook regression: missing ${token}`);
}
const designerCasebookApi = fs.readFileSync("src/app/api/designer/casebook/route.ts","utf8");
for (const token of ["aggregateDesignerCasebook","source:\"eq.operator\"","type:\"eq.operator_note\"","select:\"type,source,payload\"","cache-control","No raw"]) {
  if (!designerCasebookApi.includes(token)) throw new Error(`Designer casebook API regression: missing ${token}`);
}
for (const forbidden of ["session_id","sessionId","customerName","phone","email"]) {
  if (designerCasebookApi.includes(forbidden)) throw new Error(`Designer casebook privacy regression: aggregate API contains ${forbidden}`);
}
const designerCaseSanitizer = fs.readFileSync("src/app/api/memory/event/route.ts","utf8");
for (const token of ['subtype === "designer_case_review"',"recommendationId","approved","rejected","material_unknown"]) {
  if (!designerCaseSanitizer.includes(token)) throw new Error(`Designer case-review sanitizer regression: missing ${token}`);
}
const designerCaseOperator = fs.readFileSync("src/app/operator/OperatorClient.tsx","utf8");
for (const token of ["DESIGNER CASE REVIEW","Approve case","Reject case","designer_case_review","Only explicit operator reviews become Casebook evidence"]) {
  if (!designerCaseOperator.includes(token)) throw new Error(`Designer case-review operator regression: missing ${token}`);
}
const designerCaseSearch = fs.readFileSync("src/lib/designer/search.ts","utf8");
for (const token of ["casebookSignalFor","casebookSignal.score","Math.max(-6","Operator-reviewed casebook"]) {
  if (!designerCaseSearch.includes(token)) throw new Error(`Designer casebook search regression: missing ${token}`);
}
console.log("Designer casebook gate passed: operator-reviewed cases are aggregate-only, thresholded and capped below hard Designer constraints.");


const fitOutcomeModel = fs.readFileSync("src/lib/designer/fit-outcomes.ts","utf8");
for (const token of ["designer-fit-outcomes-v1","clean_first_fit","minor_alteration","major_alteration","aggregateFitOutcomes","fitOutcomeSignalFor","total>=4"]) {
  if (!fitOutcomeModel.includes(token)) throw new Error(`Designer first-fit outcome regression: fit-outcomes missing ${token}`);
}
const fitOutcomeMemory = fs.readFileSync("src/app/api/memory/event/route.ts","utf8");
for (const token of ['subtype === "designer_fit_outcome"',"allowedAreas","clean_first_fit","major_alteration"]) {
  if (!fitOutcomeMemory.includes(token)) throw new Error(`Designer first-fit outcome regression: memory route missing ${token}`);
}
const fitOutcomeApi = fs.readFileSync("src/app/api/designer/casebook/route.ts","utf8");
for (const token of ["aggregateFitOutcomes","fitOutcomes","No raw"]) {
  if (!fitOutcomeApi.includes(token)) throw new Error(`Designer first-fit outcome regression: aggregate API missing ${token}`);
}
const fitOutcomeSearch = fs.readFileSync("src/lib/designer/search.ts","utf8");
for (const token of ["fitOutcomeSignalFor","fitOutcomeProportionFromMeasurements","fitOutcomeSignal.score","Reviewed first-fit"]) {
  if (!fitOutcomeSearch.includes(token)) throw new Error(`Designer first-fit outcome regression: search missing ${token}`);
}
const fitOutcomeOperator = fs.readFileSync("src/app/operator/OperatorClient.tsx","utf8");
for (const token of ["FIRST-FITTING OUTCOME","saveFitOutcome","designer_fit_outcome","Clean first fit","Learning stores the cut/result category"]) {
  if (!fitOutcomeOperator.includes(token)) throw new Error(`Designer first-fit outcome regression: operator UI missing ${token}`);
}
console.log("Designer first-fit outcome gate passed: reviewed post-fitting evidence is aggregate-only, privacy-preserving and capped below hard constraints.");


const tailorObservations = fs.readFileSync("src/lib/designer/tailor-observations.ts","utf8");
for (const token of ["linen-earth-tailor-observations-v1","ShoulderBalance","PostureBalance","SeatBalance","MobilityPriority","tailorObservationCoverage"]) {
  if (!tailorObservations.includes(token)) throw new Error(`Tailor observation regression: model missing ${token}`);
}
const tailorFit = fs.readFileSync("src/lib/designer/fit-construction.ts","utf8");
for (const token of ["observations?: TailorObservationProfile","OBS-SHOULDER-SLOPING","OBS-POSTURE-FORWARD","OBS-SEAT-FULL","OBS-MOBILITY"]) {
  if (!tailorFit.includes(token)) throw new Error(`Tailor observation regression: fit engine missing ${token}`);
}
const tailorPlanner = fs.readFileSync("src/lib/designer/planner.ts","utf8");
for (const token of ["TailorObservationProfile","observations?: TailorObservationProfile","observations })"]) {
  if (!tailorPlanner.includes(token)) throw new Error(`Tailor observation regression: planner missing ${token}`);
}
const tailorSearch = fs.readFileSync("src/lib/designer/search.ts","utf8");
for (const token of ["observations?: TailorObservationProfile","observations:input.observations"]) {
  if (!tailorSearch.includes(token)) throw new Error(`Tailor observation regression: search missing ${token}`);
}
const tailorMeasurementUi = fs.readFileSync("src/components/MeasurementStudio.tsx","utf8");
for (const token of ["OPTIONAL / TAILOR OBSERVATIONS","Shoulder balance","Posture balance","Seat balance","Movement priority","MANUAL INPUT ONLY","TAILOR_OBSERVATION_STORAGE_KEY"]) {
  if (!tailorMeasurementUi.includes(token)) throw new Error(`Tailor observation regression: Measurements UI missing ${token}`);
}
const tailorDesignerUi = fs.readFileSync("src/components/DesignerModule.tsx","utf8");
for (const token of ["TAILOR_OBSERVATION_STORAGE_KEY","tailorObservationSummary","observationCoverage","observations:tailorObservations"]) {
  if (!tailorDesignerUi.includes(token)) throw new Error(`Tailor observation regression: Designer UI missing ${token}`);
}
console.log("Tailor observation gate passed: manual shoulder/posture/seat/mobility observations feed fit, planning and search without photo inference.");


const blockStrategyEngine = fs.readFileSync("src/lib/designer/block-strategy.ts","utf8");
for (const token of ["block-strategy-provisional-1","assessBlockStrategy","shaped-shirt","roomy-seat-block","mobility-shirt","suggestedPatch","Block strategy chooses a provisional starting block"]) {
  if (!blockStrategyEngine.includes(token)) throw new Error(`Designer block-strategy regression: missing ${token}`);
}
const designerPlannerBlocks = fs.readFileSync("src/lib/designer/planner.ts","utf8");
for (const token of ["DesignerBlockStrategy","selectedBlock","blockStrategy:selectedBlock","item.blockStrategy?.score"]) {
  if (!designerPlannerBlocks.includes(token)) throw new Error(`Designer block planning regression: missing ${token}`);
}
const designerSearchBlocks = fs.readFileSync("src/lib/designer/search.ts","utf8");
for (const token of ["blockStrategy: DesignerBlockStrategy","assessBlockStrategy","blockStrategy:block","block.score"]) {
  if (!designerSearchBlocks.includes(token)) throw new Error(`Designer block-search regression: missing ${token}`);
}
const designerBlockUi = fs.readFileSync("src/components/DesignerModule.tsx","utf8");
for (const token of ["blockStrategy=assessment?.blockStrategy","blockStrategy.shirtBlock","blockStrategy.trouserBlock","Starting block:","requestLookAssessment"]) {
  if (!designerBlockUi.includes(token)) throw new Error(`Designer block UI regression: missing ${token}`);
}
const garmentSpecBlocks = fs.readFileSync("src/lib/designer/garment-spec.ts","utf8");
for (const token of ["blockStrategyVersion","blockStrategyScore","blockStrategy: block ?","shirtBlock","trouserBlock"]) {
  if (!garmentSpecBlocks.includes(token)) throw new Error(`Garment-spec block regression: missing ${token}`);
}
console.log("Designer block-strategy gate passed: measurements and manual observations now guide provisional shirt/trouser starting blocks without creating a cutting pattern.");
