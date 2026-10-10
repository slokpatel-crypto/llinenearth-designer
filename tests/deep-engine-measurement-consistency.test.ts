import test from "node:test";
import assert from "node:assert/strict";
import {reviewMeasurementConsistency} from "../src/lib/designer/measurement-consistency.ts";
import {assessFitConstruction} from "../src/lib/designer/fit-construction.ts";
import type {MeasurementProfile} from "../src/lib/measurements.ts";
import type {DesignerStyle} from "../src/lib/designer/engine.ts";

const profile:MeasurementProfile={
  version:1,unit:"in",updatedAt:"2026-10-10T12:00:00Z",
  // These are internal centimetre values; unit controls only display.
  shirt:{neck:39,chest:102,waist:94,shoulder:45,sleeve:61,shirtLength:74,bicep:31,wrist:18},
  pants:{waist:84,seat:99,thigh:56,frontRise:28,inseam:79,outseam:104,knee:39,hem:36},
};
const style:DesignerStyle={
  collar:"Point Collar",collarFinish:"Self-fabric",cuff:"Barrel Cuff (2-button)",
  placket:"Standard Placket",shirtFit:"Regular Fit",shirtWear:"Tucked",
  trouser:"Straight / Classic Trouser",rise:"Mid Rise",waistband:"Belt Loops",
  break:"No Break",button:"Corozo",
};

test("correctly ordered trouser lengths and internal cm measurements retain provisional review",()=>{
  const issues=reviewMeasurementConsistency(profile);
  assert.deepEqual(issues,[]);
  const fit=assessFitConstruction(profile,style);
  assert.equal(fit.status,"provisional");
  assert.ok(fit.shirtTargets.length>0);
  assert.ok(fit.trouserTargets.length>0);
});

test("impossible trouser rise and inseam/outseam cannot qualify as sufficient measurements",()=>{
  const data={...profile,pants:{...profile.pants,outseam:76,frontRise:82}};
  const issues=reviewMeasurementConsistency(data);
  assert.ok(issues.some(x=>x.id==="MEASURE-SEAM-ORDER"&&x.severity==="warning"));
  assert.ok(issues.some(x=>x.id==="MEASURE-RISE-ORDER"&&x.severity==="warning"));
  const fit=assessFitConstruction(data,style);
  assert.equal(fit.status,"insufficient_measurements");
  assert.ok(fit.checks.some(x=>x.id==="MEASURE-SEAM-ORDER"));
  assert.ok(fit.checks.some(x=>x.id==="MEASURE-RISE-ORDER"));
  assert.ok(fit.fitScore<assessFitConstruction(profile,style).fitScore);
});

test("implausible torso values trigger review without excluding valid atypical customers",()=>{
  const data={...profile,shirt:{...profile.shirt,neck:105}};
  const issues=reviewMeasurementConsistency(data);
  assert.ok(issues.some(x=>x.id==="MEASURE-NECK-CHEST"&&x.severity==="review"));
  assert.ok(!issues.some(x=>x.id==="MEASURE-INVALID"));
  // Atypical physique is not declared impossible: actual tailor review decides.
  const fit=assessFitConstruction(data,style);
  assert.ok(fit.checks.some(x=>x.id==="MEASURE-NECK-CHEST"&&x.severity==="review"));
});

test("non-finite and negative measurements cannot pass a cutting profile",()=>{
  const data={...profile,pants:{...profile.pants,thigh:Number.POSITIVE_INFINITY}};
  assert.ok(reviewMeasurementConsistency(data).some(x=>x.id==="MEASURE-INVALID"));
  assert.equal(assessFitConstruction(data,style).status,"insufficient_measurements");
});

test("empty or partially measured profiles still require more information",()=>{
  assert.deepEqual(reviewMeasurementConsistency(null),[]);
  const less={...profile,shirt:{chest:98},pants:{waist:82}};
  assert.equal(assessFitConstruction(less,style).status,"insufficient_measurements");
  assert.ok(assessFitConstruction(less,style).checks.some(x=>x.id==="FIT-SHIRT-DATA"));
});
