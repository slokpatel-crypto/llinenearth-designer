import test from "node:test";
import assert from "node:assert/strict";
import { lockGarmentSpec, reconstructLockedGarmentSpec, verifyLockedDesignRevision } from "../src/lib/designer/design-lock.ts";
import type { CanonicalGarmentSpec } from "../src/lib/designer/garment-spec.ts";

const spec={
  version:"linen-earth-garment-spec-v1",
  status:"draft",
  source:{designerRuleSetVersion:"rules-1",fitConstructionVersion:null,measurementProfileVersion:null,blockStrategyVersion:null,styleSchemaVersion:null},
  styleSpec:null,
  bodyProfile:null,
  context:{occasion:"Semi-Formal",climate:"Not specified",intention:"Balanced"},
  fabrics:{
    shirt:{id:"shirt-1",name:"Sky Blue",line:"Linen Plain",source:"catalogue",verifiedMaterialFacts:1},
    trouser:{id:"pant-1",name:"Beige",line:"Linen Suiting",source:"catalogue",verifiedMaterialFacts:1},
  },
  shirt:{fit:"Regular",wear:"Tucked",collar:"Point",collarFinish:"Self-fabric",cuff:"Barrel",placket:"Standard",button:"Corozo",finishedTargets:[]},
  trouser:{shape:"Pleated",rise:"Mid Rise",waistband:"Side Adjuster",break:"Slight Break",finishedTargets:[]},
  creative:null,
  decision:{designFitScore:80,confidenceScore:72,fitConstructionScore:null,brandLanguageScore:null,blockStrategyScore:null},
  blockStrategy:null,
  constructionChecks:[],
  unresolved:["Verify cloth"],
  readiness:{visualization:"supported_with_current_template",tailoring:"insufficient_measurements",materialVerification:"verification_required"},
  caveats:["Tailor review required"],
} satisfies CanonicalGarmentSpec;

test("lock creates a stable recipe hash for the same garment recipe",async()=>{
  const a=await lockGarmentSpec(spec,{lockedAt:"2026-10-01T09:00:00.000Z"});
  const b=await lockGarmentSpec(spec,{lockedAt:"2026-10-01T10:00:00.000Z"});
  assert.equal(a.recipeHash,b.recipeHash);
  assert.notEqual(a.revisionId,b.revisionId);
  assert.equal(await verifyLockedDesignRevision(a),true);
});

test("locked recipe detects later mutation",async()=>{
  const revision=await lockGarmentSpec(spec,{lockedAt:"2026-10-01T09:00:00.000Z"});
  revision.garmentSpec.fabrics.shirt.id="changed";
  assert.equal(await verifyLockedDesignRevision(revision),false);
});

test("reconstruction returns an independent canonical copy",async()=>{
  const revision=await lockGarmentSpec(spec,{lockedAt:"2026-10-01T09:00:00.000Z"});
  const reconstructed=reconstructLockedGarmentSpec(revision);
  assert.deepEqual(reconstructed,revision.garmentSpec);
  reconstructed.fabrics.shirt.id="other";
  assert.notEqual(reconstructed.fabrics.shirt.id,revision.garmentSpec.fabrics.shirt.id);
});
