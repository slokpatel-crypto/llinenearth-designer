import assert from "node:assert/strict";
import test from "node:test";
import { selectedLookQaPassed } from "../src/lib/designer/selected-look-qa.ts";

const passing={available:true,status:"pass",fabricFidelity:"strong",colorFidelity:"strong",patternFidelity:"strong",boundary:"strong",construction:"strong",mannequinConsistency:"strong",artifact:"none"};

test("an available passing fidelity check permits minor natural artifacts",()=>{
  assert.equal(selectedLookQaPassed(passing),true);
  assert.equal(selectedLookQaPassed({...passing,artifact:"minor"}),true);
});

test("unavailable, review and malformed responses cannot promote a photoreal",()=>{
  for(const check of [null,undefined,"pass",{}, {available:true,status:"pass"}, {...passing,available:false}, {...passing,available:"true"}, {...passing,status:"review"}, {...passing,status:"PASS"}, {...passing,artifact:"major"}, {...passing,artifact:undefined}]) {
    assert.equal(selectedLookQaPassed(check),false);
  }
});

test("a pass label cannot conceal a missing or failing fidelity dimension",()=>{
  for(const dimension of ["fabricFidelity","colorFidelity","patternFidelity","boundary","construction","mannequinConsistency"]) {
    for(const verdict of ["review","weak",undefined]) {
      assert.equal(selectedLookQaPassed({...passing,[dimension]:verdict}),false,`${dimension}: ${verdict}`);
    }
  }
});
