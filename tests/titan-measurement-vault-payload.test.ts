import test from "node:test";
import assert from "node:assert/strict";
import {validMeasurementVaultProfile,validMeasurementVaultObservations,validMeasurementVaultId} from "../src/lib/measurement-vault-payload.ts";
const date="2026-10-28T10:00:00.000Z";
const profile={version:1,unit:"in",shirt:{chest:100,neck:40},pants:{waist:84},updatedAt:date};
const obs={version:1,shoulderBalance:"unknown",posture:"balanced",seatBalance:"flat",mobilityPriority:"standard",updatedAt:date};
test("valid versioned incomplete measurements remain recoverable",()=>{
  assert.equal(validMeasurementVaultProfile(profile),true);
  assert.equal(validMeasurementVaultProfile({...profile,shirt:{},pants:{}}),true);
  assert.equal(validMeasurementVaultProfile({...profile,unit:"cm"}),true);
});
test("rejects malformed measurement shapes, unknown fields and numeric coercion",()=>{
  for(const candidate of [null,[],{}, {...profile,shirt:null},{...profile,pants:[]},{...profile,shirt:{chest:"100"}},{...profile,shirt:{chest:Infinity}},{...profile,pants:{waist:-3}},{...profile,pants:{waist:500}},{...profile,shirt:{chest:100,secret:"pii"}},{...profile,unexpected:true},{...profile,unit:"metres"}])
    assert.equal(validMeasurementVaultProfile(candidate),false);
});
test("rejects invalid dates but does not fabricate or require measurement completeness",()=>{
  for(const updatedAt of ["2026-02-30T10:00:00.000Z","2026-10-28","tomorrow",1,null])
    assert.equal(validMeasurementVaultProfile({...profile,updatedAt}),false);
});
test("accepts only known self-reported observation values",()=>{
  assert.equal(validMeasurementVaultObservations(obs),true);
  for(const candidate of [null,{}, {...obs,posture:"forged"},{...obs,shoulderBalance:9},{...obs,seatBalance:null},{...obs,mobilityPriority:"approved"},{...obs,updatedAt:"2026-02-30T10:00:00.000Z"},{...obs,signoff:true}])
    assert.equal(validMeasurementVaultObservations(candidate),false);
});
test("owned recovery identifiers must be real UUIDs, not coerced objects",()=>{
  assert.equal(validMeasurementVaultId("123e4567-e89b-12d3-a456-426614174000"),true);
  for(const value of [null,{},"[object Object]","abc","123e4567-e89b-12d3-a456-426614174000;drop table"])
    assert.equal(validMeasurementVaultId(value),false);
});
