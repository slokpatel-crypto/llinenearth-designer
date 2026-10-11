import test from "node:test";
import assert from "node:assert/strict";
import {lockGarmentSpec} from "../src/lib/designer/design-lock.ts";
import {
  buildVerifiedProductionHandoff,verifyProductionHandoff,
} from "../src/lib/designer/production-handoff.ts";
import type {CanonicalGarmentSpec} from "../src/lib/designer/garment-spec.ts";

const base:CanonicalGarmentSpec={
  version:"linen-earth-garment-spec-v1",
  status:"review_required",
  source:{designerRuleSetVersion:"rules-v3",fitConstructionVersion:"fit-construction-provisional-1",
    fitEaseSource:"provisional_house_defaults",fitEaseTableVersion:"linen-earth-house-ease-provisional-v1",
    measurementProfileVersion:1,blockStrategyVersion:null,styleSchemaVersion:2},
  styleSpec:{
    styleSchemaVersion:2,
    shirt:{
      type:"dress_shirt",collar:"point_standard_collar",collarFinish:"Self-fabric",
      cuff:"open_short_hem_cuff",placket:"standard_visible_placket",pocket:"no_pocket",
      sleeve:"half_sleeve",fit:"regular_classic_fit",length:"shirt_length_regular",
      hem:"curved_shirttail",back:"plain_back",wear:"untucked",button:"corozo",
    },
    pant:{type:"formal_flat_front",fit:"korean_straight_wide",rise:"mid_rise",pleat:"flat_front",
      waistband:"belt_loops",hem:"plain_hem",break:"no_break"},
    legacy:{collar:"Point Collar",collarFinish:"Self-fabric",cuff:"Barrel Cuff (2-button)",
      placket:"Standard Placket",shirtFit:"Regular Fit",shirtWear:"Untucked",
      trouser:"Straight Trouser",rise:"Mid Rise",waistband:"Belt Loops",break:"No Break",button:"Corozo"},
  },
  bodyProfile:null,
  context:{occasion:"Smart-Casual",climate:"Hot / humid",intention:"Understated"},
  fabrics:{
    shirt:{id:"shirt-stock-original",name:"Sky Linen",line:"Linen Plain",source:"Supplier PDF p1",verifiedMaterialFacts:0},
    trouser:{id:"pant-stock-original",name:"Taupe Linen",line:"Linen Suiting",source:"Supplier PDF p7",verifiedMaterialFacts:0},
  },
  shirt:{fit:"Regular",wear:"Untucked",collar:"Point",collarFinish:"Self-fabric",cuff:"Barrel",
    placket:"Standard",button:"Corozo",
    finishedTargets:[{label:"Finished chest",bodyCm:97,finishedCm:{min:103,max:107},
      easeCm:{min:6,max:10},basis:"body_plus_ease"}]},
  trouser:{shape:"Korean Wide",rise:"Mid Rise",waistband:"Belt Loops",break:"No Break",
    finishedTargets:[{label:"Finished trouser waist",bodyCm:83,finishedCm:{min:85,max:87},
      easeCm:{min:2,max:4},basis:"body_plus_ease"}]},
  creative:null,decision:{designFitScore:60,confidenceScore:42,fitConstructionScore:55,
    brandLanguageScore:null,blockStrategyScore:null},
  blockStrategy:null,constructionChecks:[
    {id:"CG-SLEEVE-CUFF",severity:"review",message:"Confirm construction with tailor"},
  ],unresolved:["Physical stock not verified","Confirm fabric shrinkage and drape"],
  readiness:{visualization:"visual_review_required",tailoring:"tailor_review_required",
    materialVerification:"verification_required"},
  caveats:["Preview photograph is not an exact visual for these advanced cuts."],
};

test("locked handoff retains full advanced shirt/trouser options, physical targets and source",async()=>{
  const revision=await lockGarmentSpec(base,{lockedAt:"2026-10-10T14:00:00Z"});
  const packet=await buildVerifiedProductionHandoff(revision,"2026-10-10T15:00:00Z");
  assert.equal(packet.recipeHash,revision.recipeHash);
  assert.equal(packet.construction.styleSpec?.shirt.sleeve,"half_sleeve");
  assert.equal(packet.construction.styleSpec?.shirt.cuff,"open_short_hem_cuff");
  assert.equal(packet.construction.styleSpec?.pant.fit,"korean_straight_wide");
  assert.equal(packet.construction.context.occasion,"Smart-Casual");
  assert.equal(packet.construction.shirt.finishedTargets[0].finishedCm.min,103);
  assert.equal(packet.production.clothEstimate.shirtMetres,null);
  assert.equal(packet.production.stockReservation.status,"not_requested");
  assert.equal(packet.status,"review_required");
  assert.equal(await verifyProductionHandoff(packet,revision),true);
});

test("tampering with just one garment cut, material or finished target fails handoff verification",async()=>{
  const revision=await lockGarmentSpec(base,{lockedAt:"2026-10-10T14:00:00Z"});
  const packet=await buildVerifiedProductionHandoff(revision);
  const changed=structuredClone(packet);
  if(!changed.construction.styleSpec)throw Error("Expected full advanced spec");
  changed.construction.styleSpec.pant.fit="straight_classic";
  assert.equal(await verifyProductionHandoff(changed,revision),false);
  changed.construction.styleSpec.pant.fit=packet.construction.styleSpec!.pant.fit;
  changed.fabrics.shirt.id="someone-elses-physical-stock";
  assert.equal(await verifyProductionHandoff(changed,revision),false);
  const changedMeasure=structuredClone(packet);
  changedMeasure.construction.shirt.finishedTargets[0].finishedCm.min=77;
  assert.equal(await verifyProductionHandoff(changedMeasure,revision),false);
});

test("modifying the supposedly locked revision blocks new output even with old hash",async()=>{
  const revision=await lockGarmentSpec(base);
  revision.garmentSpec.fabrics.trouser.id="different-trouser";
  await assert.rejects(()=>buildVerifiedProductionHandoff(revision),/hash no longer matches/);
  const fakePacket={...await buildVerifiedProductionHandoff(await lockGarmentSpec(base)),recipeHash:revision.recipeHash};
  assert.equal(await verifyProductionHandoff(fakePacket,revision),false);
});

test("the handoff is an independent copy and never silently reserves stock or signs measurements",async()=>{
  const revision=await lockGarmentSpec(base);
  const packet=await buildVerifiedProductionHandoff(revision);
  if(!packet.construction.styleSpec)throw Error("Expected advanced cut");
  packet.construction.styleSpec.shirt.sleeve="full_sleeve";
  packet.construction.shirt.finishedTargets[0].finishedCm.min=1;
  assert.equal(revision.garmentSpec.styleSpec?.shirt.sleeve,"half_sleeve");
  assert.equal(revision.garmentSpec.shirt.finishedTargets[0].finishedCm.min,103);
  assert.equal(packet.production.quote.amount,null);
  assert.equal(packet.production.stockReservation.reservationId,null);
});
