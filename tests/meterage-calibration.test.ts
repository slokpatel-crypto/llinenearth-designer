import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMeterageCalibrationDraft,
  meterageForWidth,
  canApproveMeterageModel,
} from "../src/lib/designer/meterage-calibration.ts";

test("meterage calibration rejects overlapping width bands",()=>{
  assert.throws(()=>normalizeMeterageCalibrationDraft({
    garment:"shirt",version:"shirt-v1",
    bands:[
      {label:"narrow",minFabricWidthCm:90,maxFabricWidthCm:120,baseMetres:2.1,patternAllowanceMetres:.2},
      {label:"overlap",minFabricWidthCm:120,maxFabricWidthCm:150,baseMetres:1.8,patternAllowanceMetres:.2},
    ],
  }),/must not overlap/);
});

test("meterage lookup only uses an explicit approved table band",()=>{
  const draft=normalizeMeterageCalibrationDraft({
    garment:"shirt",version:"shirt-v1",
    bands:[{label:"standard",minFabricWidthCm:140,maxFabricWidthCm:160,baseMetres:1.8,patternAllowanceMetres:.25}],
  });
  assert.deepEqual(meterageForWidth(draft.bands,150,true),{
    bandLabel:"standard",metres:2.05,baseMetres:1.8,patternAllowanceMetres:.25,
  });
  assert.equal(meterageForWidth(draft.bands,130,false),null);
});

test("approval requires at least twenty real evidence cases and a named approver",()=>{
  assert.equal(canApproveMeterageModel(19,"Tailor"),false);
  assert.equal(canApproveMeterageModel(20,""),false);
  assert.equal(canApproveMeterageModel(20,"RJ"),true);
});
