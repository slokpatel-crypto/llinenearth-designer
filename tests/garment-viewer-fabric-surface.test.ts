import test from "node:test";
import assert from "node:assert/strict";
import {fabricDrapeSurface} from "../src/lib/garment-viewer-fabric-surface.ts";

test("supplier-declared drape beats any conflicting weight proxy",()=>{
  const material=fabricDrapeSurface({drape:"fluid",weightClass:"heavy",weightGsm:320});
  assert.equal(material.category,"fluid");
  assert.equal(material.evidence,"supplier_declared");
  assert.equal(material.normalStrength,.55);
  assert.equal(material.roughnessOffset,-.08);
});

test("weight class is used before inferred GSM but does not invent a drape measurement",()=>{
  assert.deepEqual(fabricDrapeSurface({weightClass:"light",weightGsm:280}),{
    category:"soft",evidence:"weight_class",normalStrength:.72,roughnessOffset:-.04,
  });
  const heavy=fabricDrapeSurface({weightClass:"heavy"});
  assert.equal(heavy.category,"structured");
  assert.equal(heavy.evidence,"weight_class");
});

test("missing drape metadata remains medium and unknown rather than falsely verified",()=>{
  const missing=fabricDrapeSurface({});
  assert.equal(missing.category,"medium");
  assert.equal(missing.evidence,"unknown");
  assert.equal(missing.normalStrength,1);
  assert.equal(missing.roughnessOffset,0);
  assert.deepEqual(fabricDrapeSurface(null),missing);
});

test("GSM-only fallback is visibly marked as estimated, never supplier verified",()=>{
  for(const [gsm,expected] of [[110,"soft"],[140,"medium"],[200,"medium"],[241,"structured"]] as const){
    const material=fabricDrapeSurface({weightGsm:gsm});
    assert.equal(material.category,expected);
    assert.equal(material.evidence,"gsm_estimated");
  }
  for(const invalid of [NaN,Infinity,-1,0,40,500,undefined]){
    assert.equal(fabricDrapeSurface({weightGsm:invalid}).evidence,"unknown");
  }
});
