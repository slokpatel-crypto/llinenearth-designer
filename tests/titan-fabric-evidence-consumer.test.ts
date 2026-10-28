import test from "node:test";
import assert from "node:assert/strict";
import {applyVerifiedPhysicalFabricEvidence} from "../src/lib/fabric-intelligence-evidence.ts";

const fabric={weightGsm:null,drape:null,fiberContent:null,patternScaleVerified:false};
const reviewed={
  trust:"reviewed",reviewStatus:"approved",measuredEvidence:{patternPhysicalScale:"declared_repeat",repeatMm:18,stripeWidthMm:4},
  verifiedPhysical:{gsm:145,drape:"Balanced",fiberContent:"100% linen",sourceUrl:"https://supplier.example/spec",evidenceNote:null},
  fieldProvenance:{"measured.pattern.physicalScale":"declared","verifiedPhysical.gsm":"declared","verifiedPhysical.drape":"declared","verifiedPhysical.fiberContent":"declared"},
};
function enrich(changes:Record<string,unknown>){
  return applyVerifiedPhysicalFabricEvidence(fabric as never,{...reviewed,...changes} as never);
}

test("complete auditable measurements are promoted without changing original data",()=>{
  const result=enrich({});
  assert.equal(result.weightGsm,145);
  assert.equal(result.drape,"Balanced");
  assert.equal(result.fiberContentVerified,true);
  assert.equal(result.patternScaleVerified,true);
  assert.equal(result.renderScale?.repeatMm,18);
});

test("invalid source URLs cannot certify physical facts, even with a note",()=>{
  for(const sourceUrl of ["javascript:alert(1)","http://supplier.example/spec","https://user:pw@supplier.example/spec","https://"]){
    const result=enrich({verifiedPhysical:{...reviewed.verifiedPhysical,sourceUrl,evidenceNote:"Owner measured this roll"}});
    assert.equal(result.weightGsm,null,sourceUrl);
    assert.equal(result.patternScaleVerified,false,sourceUrl);
  }
});

test("invalid measured scale never becomes a physically verified render scale",()=>{
  for(const repeatMm of [null,0,-1,Infinity,NaN,6000,"18",true]){
    const result=enrich({measuredEvidence:{...reviewed.measuredEvidence,repeatMm}});
    assert.equal(result.patternScaleVerified,false,String(repeatMm));
  }
  assert.equal(enrich({measuredEvidence:{...reviewed.measuredEvidence,stripeWidthMm:Infinity}}).patternScaleVerified,false);
  assert.equal(enrich({measuredEvidence:{...reviewed.measuredEvidence,patternPhysicalScale:"unknown"}}).patternScaleVerified,false);
});

test("invalid GSM, drape and fiber are rejected independently",()=>{
  const result=enrich({verifiedPhysical:{...reviewed.verifiedPhysical,gsm:Infinity,drape:"Super-fluid",fiberContent:{value:"linen"}}});
  assert.equal(result.weightGsm,null);
  assert.equal(result.drape,null);
  assert.equal(result.fiberContentVerified,undefined);
  assert.equal(result.patternScaleVerified,true);
});

test("auditable inspection note can substitute for a missing source URL",()=>{
  const result=enrich({verifiedPhysical:{...reviewed.verifiedPhysical,sourceUrl:null,evidenceNote:"Measured against physical stock card."}});
  assert.equal(result.weightGsm,145);
  assert.equal(result.patternScaleVerified,true);
});

test("rejected or pending Analyzer review cannot certify customer-facing fabric",()=>{
  for(const reviewStatus of ["unreviewed","rejected",null]){
    const result=enrich({reviewStatus});
    assert.equal(result.weightGsm,null,String(reviewStatus));
    assert.equal(result.patternScaleVerified,false,String(reviewStatus));
  }
  assert.equal(enrich({reviewStatus:"corrected"}).weightGsm,145);
});

test("a coerced source URL cannot be rescued by a note",()=>{
  const result=enrich({verifiedPhysical:{...reviewed.verifiedPhysical,sourceUrl:{url:"https://supplier.example/spec"},evidenceNote:"Owner measured this roll"}});
  assert.equal(result.weightGsm,null);
  assert.equal(result.patternScaleVerified,false);
});
