import fs from "node:fs";
import "./check-designer.mjs";

const required = [
  "src/lib/fashion-intelligence.ts",
  "src/lib/designer-engine.ts",
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
  "src/lib/designer/fit-construction.ts",
  "src/components/PhotoOutfitPreview.tsx",
  "src/app/designer-studio/page.tsx",
];

for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Missing required Phase 0–9 file: ${file}`);
}

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
  ["src/lib/browser-style-memory.ts", ["x-llinen-memory-token","/api/memory/session"]],
  ["src/lib/supabase-admin.ts", ["SUPABASE_SECRET_KEY","SUPABASE_SERVICE_ROLE_KEY","sb_secret_"]],
  ["src/app/operator/page.tsx", ["verifyOperatorSession","redirect","force-dynamic"]],
  ["supabase/migrations/20260920_style_events_hardening.sql", ["llinen_cloud_health","select 5;","revoke all on table public.style_events from anon","grant select, insert on table public.style_events to service_role"]],
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
  "LLINEN_OPERATOR_SYNC_TOKEN",
  "LLINEN_OPERATOR_PASSWORD_HASH",
  "LLINEN_OPERATOR_SESSION_SECRET",
  "LLINEN_MEMORY_SESSION_SECRET",
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
for (const token of ["PHOTO_TUCKED_SHIRT_CLIP","PHOTO_TUCKED_TROUSER_CLIP","PHOTO_TUCKED_SHIRT_BODY_CLIP","PHOTO_TUCKED_LEFT_SLEEVE_CLIP","PHOTO_TUCKED_RIGHT_SLEEVE_CLIP","PHOTO_TUCKED_LEFT_TROUSER_CLIP","PHOTO_TUCKED_RIGHT_TROUSER_CLIP","destination-in","masks.shirt","masks.pant","featherMaskInside","featheredMasks","patternScaleForFabric","placement.offsetX","soft-light","Inspect fit","Original model","Boundary QA"]) {
  if (!photoPreview.includes(token)) throw new Error(`Real photographic Designer regression: PhotoOutfitPreview missing ${token}`);
}
const photoGeometry = fs.readFileSync("src/lib/designer/photo-preview.ts","utf8");
for (const token of ["PHOTO_TUCKED_SHIRT_CLIP","PHOTO_TUCKED_SHIRT_BODY_CLIP","PHOTO_TUCKED_LEFT_SLEEVE_CLIP","PHOTO_TUCKED_RIGHT_SLEEVE_CLIP","PHOTO_TUCKED_TROUSER_CLIP","PHOTO_TUCKED_LEFT_TROUSER_CLIP","PHOTO_TUCKED_RIGHT_TROUSER_CLIP","PHOTO_TUCKED_NECK_CLEAR","/designer/studio-tucked.webp"]) {
  if (!photoGeometry.includes(token)) throw new Error(`Real photographic Designer regression: photo-preview missing ${token}`);
}
console.log("Real photographic Designer gate passed: hard garment boundaries, neck clear zone and tucked layering protected.");


const realDesignerModule = fs.readFileSync("src/components/DesignerModule.tsx","utf8");
for (const token of ["linen-earth:real-designer-draft:v2","draftReady","localStorage.setItem(DRAFT_KEY","resetDraft","Reset design"]) {
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


for (const token of ["matchPhotographedOfficeModel","Point (Standard) Collar","Barrel Cuff (1-button)","Pleated Trouser","Belt Loops","Match photographed office model"]) {
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
for (const token of ['params.get("shirt")','params.get("pant")','params.get("style")',"sourceTitle","sourceTier","sourceReason","planDesignerDirections(routedShirtFabric","STYLE DIRECTOR RESULT"]) {
  if (!realModelDesignerHandoff.includes(token)) throw new Error(`Real-model Director loading regression: missing ${token}`);
}
console.log("Style Director real-model spec gate passed: full pair, cut, context and auto-assessment handoff protected.");


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
for (const token of ["MEASUREMENT_STORAGE_KEY","measurementCoverage","measurementFitGuidance","FIT PROFILE / MEASUREMENTS","Update measurements","photographic mannequin is a fixed visual reference","FIT PROFILE LOADED"]) {
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
for (const token of ["MeasurementProfile","FitConstructionAssessment","assessFitConstruction","fitConstruction","item.recommendation.designFitScore * .68"]) {
  if (!plannerV2.includes(token)) throw new Error(`Fit-aware Designer planner regression: missing ${token}`);
}
const designerV2 = fs.readFileSync("src/components/DesignerModule.tsx","utf8");
for (const token of ["FIT + CONSTRUCTION V2","formatFinishedRange","newDesignerGarmentSpec","newDesignerDirectionFit","measurementProfile)"]) {
  if (!designerV2.includes(token)) throw new Error(`Fit Construction V2 UI regression: missing ${token}`);
}
console.log("Fit Construction V2 gate passed: provisional ease ranges, finished-garment targets, construction checks and measurement-aware cut ranking protected.");
