import test from "node:test";
import assert from "node:assert/strict";
import { lockGarmentSpec, reconstructLockedGarmentSpec, verifyLockedDesignRevision } from "../src/lib/designer/design-lock.ts";
import type { CanonicalGarmentSpec } from "../src/lib/designer/garment-spec.ts";

const spec={
  version:"linen-earth-garment-spec-v1",
  status:"draft",
  source:{designerRuleSetVersion:"rules-1",fitConstructionVersion:null,fitEaseSource:null,fitEaseTableVersion:null,measurementProfileVersion:null,blockStrategyVersion:null,styleSchemaVersion:null},
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


test("ease calibration provenance changes the locked recipe hash",async()=>{
  const provisional=await lockGarmentSpec({
    ...spec,
    source:{...spec.source,fitConstructionVersion:"fit-construction-provisional-1",fitEaseSource:"provisional_house_defaults",fitEaseTableVersion:"linen-earth-house-ease-provisional-v1"},
  },{lockedAt:"2026-10-01T09:00:00.000Z"});
  const calibrated=await lockGarmentSpec({
    ...spec,
    source:{...spec.source,fitConstructionVersion:"fit-construction-calibrated-2",fitEaseSource:"approved_house_calibration",fitEaseTableVersion:"house-ease-approved-v1"},
  },{lockedAt:"2026-10-01T09:00:00.000Z"});
  assert.notEqual(provisional.recipeHash,calibrated.recipeHash);
});

test("corrupt remote locked-revision envelopes are rejected without throwing",async()=>{
  const valid=await lockGarmentSpec(spec,{lockedAt:"2026-10-01T09:00:00.000Z"});
  for(const bad of [
    null,undefined,[],123,"not-a-revision",{},
    {...valid,revisionId:[]},
    {...valid,revisionId:""},
    {...valid,lockedAt:{}},
    {...valid,lockedAt:"not-a-timestamp"},
    {...valid,parentRevisionId:[]},
    {...valid,recipeHash:null},
    {...valid,recipeHash:"0".repeat(63)},
    {...valid,garmentSpec:null},
    {...valid,garmentSpec:[]},
    {...valid,garmentSpec:{version:"unknown"}},
  ]){
    assert.equal(await verifyLockedDesignRevision(bad),false,`expected invalid envelope: ${String(typeof bad)}`);
  }
  assert.equal(await verifyLockedDesignRevision(valid),true);
});

test("unserializable runtime payload cannot crash locked-design verification",async()=>{
  const valid=await lockGarmentSpec(spec,{lockedAt:"2026-10-01T09:00:00.000Z"});
  const circular:Record<string,unknown>={version:"linen-earth-garment-spec-v1"};
  circular.loop=circular;
  assert.equal(await verifyLockedDesignRevision({...valid,garmentSpec:circular}),false);
});

test("identical recipes locked within the same second have independent revision identities",async()=>{
  const when="2026-10-01T09:00:00.000Z";
  const a=await lockGarmentSpec(spec,{lockedAt:when});
  const b=await lockGarmentSpec(spec,{lockedAt:when});
  assert.equal(a.recipeHash,b.recipeHash);
  assert.notEqual(a.revisionId,b.revisionId);
  assert.match(a.revisionId,/^LE-LOCK-20261001090000-[0-9A-F]{12}-[0-9A-F]{16}$/);
  assert.match(b.revisionId,/^LE-LOCK-20261001090000-[0-9A-F]{12}-[0-9A-F]{16}$/);
  assert.equal(await verifyLockedDesignRevision(a),true);
  assert.equal(await verifyLockedDesignRevision(b),true);
  const child=await lockGarmentSpec(spec,{parentRevisionId:a.revisionId,lockedAt:when});
  assert.equal(child.parentRevisionId,a.revisionId);
  assert.notEqual(child.revisionId,a.revisionId);
});

test("revision verification binds exact ID timestamp and recipe prefix without breaking legacy IDs",async()=>{
  const valid=await lockGarmentSpec(spec,{lockedAt:"2026-10-01T09:00:00.000Z"});
  const legacy={...valid,revisionId:valid.revisionId.replace(/-[0-9A-F]{16}$/,"")};
  assert.equal(await verifyLockedDesignRevision(legacy),true);
  for(const corrupt of [
    {...valid,revisionId:"LE-LOCK-20261001090001-"+valid.recipeHash.slice(0,12).toUpperCase()},
    {...valid,revisionId:valid.revisionId.replace(valid.recipeHash.slice(0,12).toUpperCase(),"000000000000")},
    {...valid,revisionId:"someone-elses-design"},
    {...valid,revisionId:valid.revisionId.toLowerCase()},
    {...valid,lockedAt:"2026-10-01T09:00:01.000Z"},
    {...valid,lockedAt:"2026-02-30T09:00:00.000Z"},
    {...valid,lockedAt:"2026-10-01T24:00:00.000Z"},
    {...valid,lockedAt:"2026-10-01T09:00:00Z"},
    {...valid,parentRevisionId:valid.revisionId},
    {...valid,parentRevisionId:"not-a-revision"},
  ]){
    assert.equal(await verifyLockedDesignRevision(corrupt),false,
      "invalid revision envelope must not verify");
  }
  await assert.rejects(()=>lockGarmentSpec(spec,{parentRevisionId:"forged"}),/parent revision/);
  for(const lockedAt of ["2026-02-29T09:00:00Z","2026-10-01T24:00:00Z",
    "2026-10-01T09:00:00+15:00","not-a-time"]){
    await assert.rejects(()=>lockGarmentSpec(spec,{lockedAt}),/valid timestamp/);
  }
  const leap=await lockGarmentSpec(spec,{lockedAt:"2028-02-29T09:00:00+05:30"});
  assert.equal(await verifyLockedDesignRevision(leap),true);
  assert.equal(leap.lockedAt,"2028-02-29T03:30:00.000Z");
});
