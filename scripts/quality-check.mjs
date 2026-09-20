import fs from "node:fs";

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
  ["src/app/api/operator/sync/route.ts", ["timingSafeEqual","supabaseAdminHeaders","received_at.asc,id.asc"]],
  ["src/lib/browser-style-memory.ts", ["x-llinen-memory-token","/api/memory/session"]],
  ["src/lib/supabase-admin.ts", ["SUPABASE_SECRET_KEY","SUPABASE_SERVICE_ROLE_KEY","sb_secret_"]],
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
