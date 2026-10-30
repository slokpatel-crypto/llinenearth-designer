import test from "node:test";
import assert from "node:assert/strict";
import type { LockedDesignRevision } from "../src/lib/designer/design-lock.ts";
import { createDesignShareToken, sharePayloadFromRevision, verifyDesignShareToken } from "../src/lib/designer/design-share.ts";

process.env.LINEN_DESIGN_SHARE_SECRET="test-secret-for-design-share-links-1234567890";

const revision={
  version:"linen-earth-design-lock-v1",
  revisionId:"LE-LOCK-20261001090000-ABCDEF123456",
  parentRevisionId:null,
  recipeHash:"a".repeat(64),
  lockedAt:"2026-10-01T09:00:00.000Z",
  garmentSpec:{
    version:"linen-earth-garment-spec-v1",
    status:"draft",
    source:{designerRuleSetVersion:"v",fitConstructionVersion:null,fitEaseSource:null,fitEaseTableVersion:null,measurementProfileVersion:null,blockStrategyVersion:null,styleSchemaVersion:null},
    styleSpec:null,
    bodyProfile:{version:1,build:"regular",heightCm:178,skinTone:"medium",source:"measurements",silhouette:{shoulderScale:1.02,chestScale:1.03,waistScale:.95,seatScale:1.01,thighScale:1,legLengthScale:1.04,evidenceCount:6}},
    context:{occasion:"Semi-Formal",climate:"Not specified",intention:"Balanced"},
    fabrics:{
      shirt:{id:"s1",name:"Sky Blue",line:"Linen Plain",source:"catalogue",verifiedMaterialFacts:1},
      trouser:{id:"p1",name:"Beige",line:"Linen Suiting",source:"catalogue",verifiedMaterialFacts:1},
    },
    shirt:{fit:"Regular",wear:"Tucked",collar:"Point",collarFinish:"Self-fabric",cuff:"Barrel",placket:"Standard",button:"Corozo",finishedTargets:[{label:"Finished shirt chest",bodyCm:100,easeCm:{min:10,max:14},finishedCm:{min:110,max:114},basis:"body_plus_ease"}]},
    trouser:{shape:"Pleated",rise:"Mid Rise",waistband:"Side Adjuster",break:"Slight Break",finishedTargets:[]},
    creative:null,
    decision:{designFitScore:80,confidenceScore:70,fitConstructionScore:null,brandLanguageScore:null,blockStrategyScore:null},
    blockStrategy:null,
    constructionChecks:[],
    unresolved:["Verify cloth"],
    readiness:{visualization:"supported_with_current_template",tailoring:"insufficient_measurements",materialVerification:"verification_required"},
    caveats:["Tailor review required"],
  },
} satisfies LockedDesignRevision;

test("shared design payload excludes body and measurement data",()=>{
  const payload=sharePayloadFromRevision(revision,1_000);
  assert.equal("bodyProfile" in payload,false);
  assert.equal(JSON.stringify(payload).includes("heightCm"),false);
  assert.equal(JSON.stringify(payload).includes("silhouette"),false);
  assert.equal(JSON.stringify(payload).includes("bodyCm"),false);
  assert.equal(payload.fabrics.shirt.id,"s1");
  assert.equal(payload.shirt.collar,"Point");
});

test("signed share token round-trips and expires",()=>{
  const now=1_000;
  const token=createDesignShareToken(revision,now);
  assert.ok(token);
  const payload=verifyDesignShareToken(token as string,now+10);
  assert.ok(payload);
  assert.equal(payload?.revisionId,revision.revisionId);
  assert.equal(verifyDesignShareToken(token as string,now+31*24*60*60*1000),null);
});

test("tampered share token is rejected",()=>{
  const token=createDesignShareToken(revision,1_000) as string;
  const parts=token.split(".");
  parts[1]=parts[1].slice(0,-1)+(parts[1].endsWith("A")?"B":"A");
  assert.equal(verifyDesignShareToken(parts.join("."),1_010),null);
});


test("public bearer share pages have route-specific no-referrer, noindex and no-store protections",async()=>{
  const {default:nextConfig}=await import("../next.config.ts");
  const routes=await nextConfig.headers?.();
  assert.ok(routes,"Next.js response headers must be configured");
  const globalIndex=routes.findIndex(route=>route.source==="/:path*");
  const shareIndex=routes.findIndex(route=>route.source==="/share/:token");
  assert.ok(globalIndex>=0 && shareIndex>globalIndex,"share header policy must override the global route");
  const share=routes[shareIndex];
  const header=(key:string)=>share.headers.find(item=>item.key.toLowerCase()===key.toLowerCase())?.value;
  assert.equal(header("Referrer-Policy"),"no-referrer");
  assert.equal(header("X-Robots-Tag"),"noindex, nofollow, noarchive");
  assert.match(header("Cache-Control")||"",/private/);
  assert.match(header("Cache-Control")||"",/no-store/);

  const {readFileSync}=await import("node:fs");
  const page=readFileSync("src/app/share/[token]/page.tsx","utf8");
  assert.match(page,/export const dynamic="force-dynamic"/);
  assert.match(page,/robots:\{index:false,follow:false\}/);
  assert.match(page,/referrer:"no-referrer"/);
});

test("both CI lanes exercise actual signed and invalid share HTTP privacy responses",async()=>{
  const {readFileSync}=await import("node:fs");
  const script=readFileSync("scripts/verify-share-response-headers.cjs","utf8");
  assert.match(script,/fixtureToken\(\)/);
  assert.match(script,/good\.status,200/);
  assert.match(script,/invalid\.status,404/);
  assert.match(script,/assertPrivateShareHeaders\(good/);
  assert.match(script,/assertPrivateShareHeaders\(invalid/);
  assert.match(script,/strict-origin-when-cross-origin/);
  for(const workflow of [".github/workflows/ci.yml",".github/workflows/deep-engine-non3d.yml"]){
    const text=readFileSync(workflow,"utf8");
    assert.match(text,/LINEN_DESIGN_SHARE_SECRET:/,workflow);
    assert.match(text,/node scripts\/verify-share-response-headers\.cjs/,workflow);
  }
});
