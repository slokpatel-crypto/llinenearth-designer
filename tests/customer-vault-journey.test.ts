import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import { createRequire } from "node:module";
import { lockGarmentSpec } from "../src/lib/designer/design-lock.ts";
const {load}=createRequire(import.meta.url)("../scripts/designer-test-loader.cjs");
const {DESIGNER_PANTS,DESIGNER_SHIRTS,designerStyleForOccasion}=load("src/lib/designer/engine.ts") as typeof import("../src/lib/designer/engine.ts");
const {fromLegacyStyle}=load("src/lib/designer/style-spec-v2.ts") as typeof import("../src/lib/designer/style-spec-v2.ts");
const {allowLocalFitHydration,ownedDesignResumePath,ownedRevisionToDraft,readSharedDesignDraft}=load("src/lib/designer/customer-vault-journey.ts") as typeof import("../src/lib/designer/customer-vault-journey.ts");
import type { CanonicalGarmentSpec } from "../src/lib/designer/garment-spec.ts";

const shirt=DESIGNER_SHIRTS[0];
const pant=DESIGNER_PANTS[0];
const style=designerStyleForOccasion("Semi-Formal");
const base={
  version:"linen-earth-garment-spec-v1",status:"draft",
  context:{occasion:"Semi-Formal",climate:"Hot / humid",intention:"Balanced"},
  source:{designerRuleSetVersion:"v1",fitConstructionVersion:null,fitEaseSource:null,fitEaseTableVersion:null,measurementProfileVersion:null,blockStrategyVersion:null,styleSchemaVersion:2},
  styleSpec:fromLegacyStyle(style),bodyProfile:null,
  fabrics:{
    shirt:{id:shirt.id,name:shirt.name,line:shirt.line,source:shirt.source,verifiedMaterialFacts:0},
    trouser:{id:pant.id,name:pant.name,line:pant.line,source:pant.source,verifiedMaterialFacts:0},
  },
  shirt:{fit:style.shirtFit,wear:style.shirtWear,collar:style.collar,collarFinish:style.collarFinish,cuff:style.cuff,placket:style.placket,button:style.button,finishedTargets:[]},
  trouser:{shape:style.trouser,rise:style.rise,waistband:style.waistband,break:style.break,finishedTargets:[]},
  creative:null,
  decision:{designFitScore:70,confidenceScore:70,fitConstructionScore:null,brandLanguageScore:null,blockStrategyScore:null},
  blockStrategy:null,constructionChecks:[],unresolved:[],
  readiness:{visualization:"supported_with_current_template",tailoring:"insufficient_measurements",materialVerification:"verification_required"},caveats:[],
} as CanonicalGarmentSpec;

test("vault resume URL accepts only UUID, never recovery secrets or arbitrary URLs",()=>{
  assert.equal(ownedDesignResumePath("550e8400-e29b-41d4-a716-446655440000"),"/designer-studio?resumeVault=550e8400-e29b-41d4-a716-446655440000");
  for(const id of ["lev1.private.secret","../other","not-a-uuid","550e8400-e29b-41d4-a716-446655440000&from=other",null])
    assert.equal(ownedDesignResumePath(id),null);
});

test("verified owned revision reconstructs editable v2 recipe with correct lineage",async()=>{
  const original=await lockGarmentSpec(base,{lockedAt:"2026-11-20T08:00:00.000Z"});
  const draft=await ownedRevisionToDraft(original,DESIGNER_SHIRTS,DESIGNER_PANTS);
  assert.ok(draft);
  assert.equal(draft.parentRevisionId,original.revisionId);
  assert.equal(draft.shirtId,shirt.id);
  assert.equal(draft.pantId,pant.id);
  assert.equal(draft.styleSpec.shirt.collar,base.styleSpec?.shirt.collar);
  assert.equal(draft.climate,"Hot / humid");
  draft.styleSpec.shirt.collar="changed-only-in-draft";
  assert.notEqual(draft.styleSpec.shirt.collar,original.garmentSpec.styleSpec?.shirt.collar);
});

test("tampering and cross-category fabrics cannot resume a saved design",async()=>{
  const original=await lockGarmentSpec(base);
  const tampered=structuredClone(original);
  tampered.garmentSpec.context.intention="Expressive";
  assert.equal(await ownedRevisionToDraft(tampered,DESIGNER_SHIRTS,DESIGNER_PANTS),null);
  const wrongCategory=await lockGarmentSpec({...base,fabrics:{...base.fabrics,shirt:{...base.fabrics.shirt,id:pant.id}}});
  assert.equal(await ownedRevisionToDraft(wrongCategory,DESIGNER_SHIRTS,DESIGNER_PANTS),null);
  assert.equal(await ownedRevisionToDraft(original,[],DESIGNER_PANTS),null);
});

test("legacy recipes without validated v2 construction remain readable but cannot be silently relabelled",async()=>{
  const legacy=await lockGarmentSpec({...base,styleSpec:null,source:{...base.source,styleSchemaVersion:null}});
  assert.equal(await ownedRevisionToDraft(legacy,DESIGNER_SHIRTS,DESIGNER_PANTS),null);
  const forged=await lockGarmentSpec({...base,styleSpec:{...base.styleSpec!,shirt:{...base.styleSpec!.shirt,collar:"unsupported"}}});
  assert.equal(await ownedRevisionToDraft(forged,DESIGNER_SHIRTS,DESIGNER_PANTS),null);
});

test("public share handoff restores validated photographed choices without importing a lock",()=>{
  const params=new URLSearchParams({
    from:"shared-design",shirt:shirt.id,pant:pant.id,occasion:"Semi-Formal",
    climate:"Hot / humid",intention:"Balanced",style:JSON.stringify(style),
  });
  const result=readSharedDesignDraft(params,DESIGNER_SHIRTS,DESIGNER_PANTS);
  assert.ok(result);
  assert.deepEqual(result.style,style);
  assert.equal(result.styleSpec.styleSchemaVersion,2);
  assert.equal("parentRevisionId" in result,false);
  params.set("shirt",pant.id);
  assert.equal(readSharedDesignDraft(params,DESIGNER_SHIRTS,DESIGNER_PANTS),null);
  params.set("shirt",shirt.id);
  params.set("style",JSON.stringify({...style,collar:"arbitrary"}));
  assert.equal(readSharedDesignDraft(params,DESIGNER_SHIRTS,DESIGNER_PANTS),null);
});

test("public share navigation cannot import stale local private body or creative state",()=>{
  const source=readFileSync("src/components/DesignerModule.tsx","utf8");
  assert.match(source,/if\(fromShared\)\{[\s\S]*nextBodyProfile=undefined;/);
  assert.match(source,/!fromDirector && !fromReference && !fromShared && parsed\?\.creative/);
  assert.match(source,/setBodyProfile\(nextBodyProfile \|\| DEFAULT_BODY_PREVIEW_PROFILE\)/);
});

test("shared or account vault imports cannot hydrate unrelated browser fit data",()=>{
  assert.equal(allowLocalFitHydration(new URLSearchParams()),true);
  assert.equal(allowLocalFitHydration(new URLSearchParams({from:"style-director"})),true);
  assert.equal(allowLocalFitHydration(new URLSearchParams({from:"shared-design"})),false);
  assert.equal(allowLocalFitHydration(new URLSearchParams({resumeVault:"invalid"})),false);
  const source=readFileSync("src/components/DesignerModule.tsx","utf8");
  assert.equal((source.match(/if\(!allowLocalFitHydration\(handoff\)\) return;/g)||[]).length,2);
});

test("current calibrated catalogue may resume a valid newer fabric not in the static fallback",async()=>{
  const currentOnly={...shirt,id:"synthetic-only-new-reviewed-shirt",allowedGarments:["shirt"] as const};
  const updated=await lockGarmentSpec({...base,
    fabrics:{...base.fabrics,shirt:{...base.fabrics.shirt,id:currentOnly.id}}});
  assert.equal(await ownedRevisionToDraft(updated,DESIGNER_SHIRTS,DESIGNER_PANTS),null);
  const loaded=await ownedRevisionToDraft(updated,[...DESIGNER_SHIRTS,{...currentOnly,allowedGarments:["shirt"]}],DESIGNER_PANTS);
  assert.equal(loaded?.shirtId,currentOnly.id);
});

test("account switching invalidates stale owner-bound lists and share/enquiry responses",()=>{
  const source=readFileSync("src/app/account/page.tsx","utf8");
  assert.match(source,/const epoch=\\+\\+accountRefreshEpoch\\.current;/);
  assert.match(source,/if\\(epoch!==accountRefreshEpoch\\.current\\|\\|accountOwner\\.current!==owner\\)return;/);
  assert.match(source,/if\\(accountOwner\\.current!==owner\\)\\{[\\s\\S]*?clearPrivateAccount\\(\\)/);
  assert.match(source,/async function logout\\(\\)\\{[\\s\\S]*?clearPrivateAccount\\(\\)/);
  assert.equal((source.match(/if\\(epoch!==designLoadEpoch\\.current\\)return;/g)||[]).length,2);
});
