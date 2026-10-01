import test from "node:test";
import assert from "node:assert/strict";
import { assessFitConstruction } from "../src/lib/designer/fit-construction.ts";
import { designerStyleForOccasion } from "../src/lib/designer/engine.ts";
import { HOUSE_SHIRT_EASE,HOUSE_TROUSER_EASE } from "../src/lib/designer/house-ease.ts";
import type { ApprovedHouseEaseModel } from "../src/lib/designer/ease-calibration.ts";
import type { MeasurementProfile } from "../src/lib/measurements.ts";

const profile:MeasurementProfile={
  version:1,
  unit:"cm",
  updatedAt:"2026-10-01T12:00:00Z",
  shirt:{neck:39,chest:100,waist:90,bicep:34,wrist:17,shoulder:45,sleeve:62,shirtLength:75},
  pants:{waist:82,seat:100,thigh:58,knee:42,frontRise:29,inseam:80,outseam:105,hem:36},
};

const style=designerStyleForOccasion("Semi-Formal");

function approvedModel():ApprovedHouseEaseModel {
  const shirt=structuredClone(HOUSE_SHIRT_EASE);
  const trouser=structuredClone(HOUSE_TROUSER_EASE);
  shirt.regular.chest={min:12,max:16};
  shirt.regular.waist={min:11,max:15};
  trouser.pleated.seat={min:9,max:13};
  return {
    modelId:"approved-1",
    version:"linen-earth-house-ease-approved-v1",
    table:{shirt,trouser},
    approvedBy:"RJ",
    approvedAt:"2026-10-01T12:00:00Z",
  };
}

test("fit construction remains on provisional defaults without an approved runtime model",()=>{
  const result=assessFitConstruction(profile,style);
  assert.equal(result.version,"fit-construction-provisional-1");
  assert.equal(result.source,"provisional_house_defaults");
  assert.equal(result.easeTableVersion,"linen-earth-house-ease-provisional-v1");
  const chest=result.shirtTargets.find((item)=>item.label==="Finished shirt chest");
  assert.deepEqual(chest?.easeCm,HOUSE_SHIRT_EASE.regular.chest);
});

test("approved runtime model changes finished targets and records its version",()=>{
  const model=approvedModel();
  const result=assessFitConstruction(profile,style,{easeModel:model});
  assert.equal(result.version,"fit-construction-calibrated-2");
  assert.equal(result.source,"approved_house_calibration");
  assert.equal(result.easeTableVersion,model.version);
  const chest=result.shirtTargets.find((item)=>item.label==="Finished shirt chest");
  assert.deepEqual(chest?.easeCm,{min:12,max:16});
  assert.deepEqual(chest?.finishedCm,{min:112,max:116});
  assert.match(result.caveats[0],/owner\/tailor-approved/);
});

test("approved runtime model still never becomes a cutting instruction",()=>{
  const result=assessFitConstruction(profile,style,{easeModel:approvedModel()});
  assert.ok(result.caveats.some((item)=>/final cutting still requires tailor verification/i.test(item)));
});
