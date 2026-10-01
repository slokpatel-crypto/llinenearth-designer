import test from "node:test";
import assert from "node:assert/strict";
import { expectedPeriodPx, passesScaleGate, pxPerMmFromMarker, scaleErrorPct } from "../src/lib/designer/proof-scale.ts";

test("calibrates px/mm from a known marker",()=>{
  assert.equal(pxPerMmFromMarker(2362,100),23.62);
});

test("maps 5 mm and 10 mm repeats to exact pixel periods",()=>{
  assert.equal(expectedPeriodPx(5,23.62),118.1);
  assert.equal(expectedPeriodPx(10,23.62),236.2);
});

test("scale gate accepts <= 8 percent error and rejects larger drift",()=>{
  const pxPerMm=2;
  assert.equal(passesScaleGate(10.8,5,pxPerMm),true);
  assert.equal(passesScaleGate(10.81,5,pxPerMm),false);
});

test("error calculation is symmetric around the expected period",()=>{
  const pxPerMm=4;
  assert.equal(scaleErrorPct(18,5,pxPerMm),10);
  assert.equal(scaleErrorPct(22,5,pxPerMm),10);
});