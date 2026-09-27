import fs from "node:fs";

const required = [
  "src/lib/fashion-intelligence.ts",
  "src/lib/designer-engine.ts",
  "src/lib/shirt-pant-designer.ts",
  "src/lib/llinen-earth-taste.ts",
  "src/app/designer-lab/page.tsx",
  "src/components/DesignerLab.tsx",
  "src/app/designer-lab/designer-lab.css",
  "src/lib/designer-safe-fallback.ts",
  "src/lib/designer-telemetry.ts",
  "src/lib/refinement-engine.ts",
  "src/lib/visualization-engine.ts",
  "src/lib/handoff.ts",
  "src/lib/quality-lab.ts",
  "src/app/designer/page.tsx",
  "src/app/designs/page.tsx",
  "src/app/atelier/page.tsx",
  "src/app/quality/page.tsx",
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

const phase1Designer = fs.readFileSync("src/lib/shirt-pant-designer.ts","utf8");
for (const token of [
  "SHIRT_PANT_RULESET_VERSION",
  "LOW_CONFIDENCE_THRESHOLD",
  '"CR-1"',
  '"CR-2"',
  '"CR-3"',
  '"CR-4"',
  '"CR-5"',
  '"CR-6"',
  '"CR-7"',
  "evaluateStockPairByIds",
  "approveHumanFallback",
  "brandSeedAffinity",
  "rankStockPairings",
  "scoreLlinenEarthPairing",
]) {
  if (!phase1Designer.includes(token)) throw new Error(`Phase-1 Designer regression: missing ${token}`);
}

const tasteModel = fs.readFileSync("src/lib/llinen-earth-taste.ts","utf8");
for (const token of ["Safe","Elevated","Statement","contextBias","brandSeedAffinity","scoreLlinenEarthPairing"]) {
  if (!tasteModel.includes(token)) throw new Error(`LLinen Earth taste regression: missing ${token}`);
}

const designerDirectionsUi = fs.readFileSync("src/components/DesignDirections.tsx","utf8");
for (const token of ["stockPairings","REAL LLINEN EARTH STOCK · RANKED DESIGNER DIRECTIONS","Three ways to wear the fabric."]) {
  if (!designerDirectionsUi.includes(token)) throw new Error(`Ranked stock UI regression: missing ${token}`);
}

const phase1Fallback = fs.readFileSync("src/lib/designer-safe-fallback.ts","utf8");
for (const token of ["designer_pairing_review","safe_fallback","SHIRT_PANT_RULESET_VERSION","hasBlockingRule"]) {
  if (!phase1Fallback.includes(token)) throw new Error(`Phase-1 fallback regression: missing ${token}`);
}

const phase1Telemetry = fs.readFileSync("src/lib/designer-telemetry.ts","utf8");
for (const token of ["designer-phase1-shirt-pant","rulesVersion","reasoningText","confidenceScore"]) {
  if (!phase1Telemetry.includes(token)) throw new Error(`Phase-1 telemetry regression: missing ${token}`);
}

const operatorDesk = fs.readFileSync("src/app/operator/OperatorClient.tsx","utf8");
for (const token of ["DESIGNER PHASE 1 REVIEW","Approve pairing","Flag wrong","Set safe fallback","designer_pairing_review"]) {
  if (!operatorDesk.includes(token)) throw new Error(`Operator review regression: missing ${token}`);
}

console.log("Phase-1 Designer gate passed: CR-1–CR-7, low-confidence guard, audit trace, operator overrides and version-scoped safe fallbacks.");

const fabricStock = fs.readFileSync("src/lib/fabric-stock.ts","utf8");
for (const token of ["weightGsm","weightClass","seasonTags","formalityScore","yarnCountLea","Lea yarn count must not be treated as fabric weight"]) {
  if (!fabricStock.includes(token)) throw new Error(`Fabric intelligence regression: missing ${token}`);
}

const refinementEngine = fs.readFileSync("src/lib/refinement-engine.ts","utf8");
for (const token of ["stockPairing","shirtId","trouserId","specHash"]) {
  if (!refinementEngine.includes(token)) throw new Error(`Stock-pair refinement regression: missing ${token}`);
}

const visualizationEngine = fs.readFileSync("src/lib/visualization-engine.ts","utf8");
for (const token of ["stockPairing","shirtColor","trouserColor"]) {
  if (!visualizationEngine.includes(token)) throw new Error(`Stock-pair visualization regression: missing ${token}`);
}

const aiVisualization = fs.readFileSync("src/lib/ai-visualization.ts","utf8");
for (const token of ["stockPairingContextDataUri","TOP HALF","BOTTOM HALF","pair.shirt.swatchImageUrl","pair.trouser.swatchImageUrl"]) {
  if (!aiVisualization.includes(token)) throw new Error(`Two-fabric FASHN regression: missing ${token}`);
}

console.log("Stock-pair continuity gate passed: verified-data schema, refinement lock, spec hash, preview colors and two-swatch FASHN context.");

const designerLab = fs.readFileSync("src/components/DesignerLab.tsx","utf8");
for (const token of ["DESIGNER LAB","Choose the cloth","Give it a situation","Designer output","stockPairings","Ask the Designer","FABRIC_STOCK"]) {
  if (!designerLab.includes(token)) throw new Error(`Designer Lab regression: missing ${token}`);
}
const designerLabPage = fs.readFileSync("src/app/designer-lab/page.tsx","utf8");
if (!designerLabPage.includes("DesignerLab")) throw new Error("Designer Lab route regression: page is not wired to the Lab component.");
console.log("Designer Lab gate passed: isolated stock browser, compact brief and shared ranked Designer output.");




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
