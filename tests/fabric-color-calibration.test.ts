import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeFabricPhysicalColorCheck,
  summarizeFabricPhysicalColorChecks,
} from "../src/lib/fabric-color-calibration.ts";

test("physical colour check calculates descriptive Delta E from controlled hex evidence",()=>{
  const result=normalizeFabricPhysicalColorCheck({
    fabricId:"FAB-001",
    digitalHex:"#C8B9A6",
    method:"calibrated_capture",
    physicalHex:"#C5B7A5",
    illuminant:"D65",
    checkedBy:"SP",
    evidenceReference:"Colour booth session 001",
    note:"D65 booth with grey-card corrected capture.",
  });
  assert.equal(result.fabricId,"FAB-001");
  assert.equal(result.digitalHex,"#C8B9A6");
  assert.equal(result.physicalHex,"#C5B7A5");
  assert.equal(result.deltaE>0,true);
});

test("instrument checks require device provenance",()=>{
  assert.throws(()=>normalizeFabricPhysicalColorCheck({
    fabricId:"FAB-002",
    digitalHex:"#223344",
    method:"colorimeter",
    physicalHex:"#223344",
    illuminant:"D65",
    checkedBy:"SP",
    evidenceReference:"Instrument log 002",
  }),/device identity/i);
});

test("ten unique fabrics complete only the evidence-count gate",()=>{
  const rows=Array.from({length:10},(_,index)=>({
    fabric_id:`FAB-${index}`,
    delta_e:index+0.5,
    checked_by:"SP",
    evidence_reference:"Booth "+index,
    illuminant:"D65",
  }));
  rows.unshift({fabric_id:"FAB-0",delta_e:99,checked_by:"SP",evidence_reference:"Older booth",illuminant:"D65"});
  const summary=summarizeFabricPhysicalColorChecks(rows,10);
  assert.equal(summary.uniqueFabrics,10);
  assert.equal(summary.evidenceGateComplete,true);
  assert.equal(summary.remaining,0);
  assert.equal(summary.medianDeltaE!==null,true);
});

test("duplicate checks never inflate unique-fabric evidence count",()=>{
  const summary=summarizeFabricPhysicalColorChecks([
    {fabric_id:"FAB-A",delta_e:2,checked_by:"SP",evidence_reference:"Ref A1",illuminant:"D65"},
    {fabric_id:"FAB-A",delta_e:3,checked_by:"SP",evidence_reference:"Ref A2",illuminant:"D65"},
    {fabric_id:"FAB-B",delta_e:4,checked_by:"SP",evidence_reference:"Ref B",illuminant:"D65"},
  ],10);
  assert.equal(summary.uniqueFabrics,2);
  assert.equal(summary.remaining,8);
  assert.equal(summary.evidenceGateComplete,false);
});


test("legacy colour rows without provenance do not satisfy the evidence gate",()=>{
  const rows=[
    ...Array.from({length:10},(_,index)=>({fabric_id:`LEGACY-${index}`,delta_e:2+index/10})),
    {fabric_id:"PROVEN-1",delta_e:1.2,checked_by:"SP",evidence_reference:"Instrument log 1",illuminant:"D65"},
  ];
  const summary=summarizeFabricPhysicalColorChecks(rows,10);
  assert.equal(summary.uniqueFabrics,1);
  assert.equal(summary.legacyUnverified,10);
  assert.equal(summary.evidenceGateComplete,false);
});

test("physical colour evidence requires controlled lighting, checker and reference",()=>{
  assert.throws(()=>normalizeFabricPhysicalColorCheck({
    fabricId:"FAB-PROV",digitalHex:"#334455",method:"calibrated_capture",physicalHex:"#334455",
    checkedBy:"SP",evidenceReference:"Capture session",note:"Grey-card corrected physical capture.",
  }),/illuminant/i);
  assert.throws(()=>normalizeFabricPhysicalColorCheck({
    fabricId:"FAB-PROV",digitalHex:"#334455",method:"calibrated_capture",physicalHex:"#334455",illuminant:"D65",
    evidenceReference:"Capture session",note:"Grey-card corrected physical capture.",
  }),/Named checker/i);
  assert.throws(()=>normalizeFabricPhysicalColorCheck({
    fabricId:"FAB-PROV",digitalHex:"#334455",method:"calibrated_capture",physicalHex:"#334455",illuminant:"D65",
    checkedBy:"SP",note:"Grey-card corrected physical capture.",
  }),/evidence reference/i);
});
