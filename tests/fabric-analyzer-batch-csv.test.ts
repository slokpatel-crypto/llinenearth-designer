import test from "node:test";
import assert from "node:assert/strict";
import { itemsFromCsv } from "../src/lib/fabric-analyzer-batch-csv.ts";

test("batch CSV retains invalid GSM, repeat and 0-1 physical claims instead of dropping them",()=>{
  const lines=[
    "fabricId,imageUrl,verifiedGsm,repeatRealMm,verifiedStructure,verifiedDrape,verifiedPhysicalEvidenceNote",
    "fabric-1,https://images.unsplash.com/example.jpg,145gsm,1e3,0.7x,Soft,Supplier label checked",
  ];
  const [row]=itemsFromCsv(lines.join("\n"));
  assert.equal(row.fabricId,"fabric-1");
  assert.equal(row.verifiedGsm,"145gsm");
  assert.equal(row.repeatRealMm,"1e3");
  assert.equal(row.verifiedStructure,"0.7x");
  assert.equal(row.verifiedDrape,"Soft");
  assert.equal(row.verifiedPhysicalEvidenceNote,"Supplier label checked");
});

test("batch CSV converts only finite ordinary decimal numbers to JSON numbers",()=>{
  const lines=[
    "fabricId,verifiedGsm,repeatRealMm,verifiedStructure,verifiedBreathability,verifiedStretch",
    "fabric-2,145.5,18,0.7,.35,-0.2",
  ];
  const [row]=itemsFromCsv(lines.join("\n"));
  assert.deepEqual([row.verifiedGsm,row.repeatRealMm,row.verifiedStructure,row.verifiedBreathability,row.verifiedStretch],[145.5,18,0.7,0.35,-0.2]);
});

test("batch CSV keeps malformed nonblank numeric values but omits genuinely empty cells",()=>{
  const lines=[
    "fabricId,verifiedGsm,verifiedStructure,verifiedStretch,verifiedDrape",
    "fabric-3,0x10,NaN,,Mystery",
    "fabric-4,, , ,",
  ];
  const [invalid,blank]=itemsFromCsv(lines.join("\n"));
  assert.equal(invalid.verifiedGsm,"0x10");
  assert.equal(invalid.verifiedStructure,"NaN");
  assert.equal(invalid.verifiedStretch,undefined);
  assert.equal(invalid.verifiedDrape,"Mystery");
  assert.equal(blank.verifiedGsm,undefined);
  assert.equal(blank.verifiedStructure,undefined);
  assert.equal(blank.verifiedStretch,undefined);
  assert.equal(blank.verifiedDrape,undefined);
});

test("quoted CSV preserves commas in provenance and retains validated drape",()=>{
  const [row]=itemsFromCsv('fabricId,verifiedDrape,verifiedPhysicalEvidenceNote\nfabric-5,Balanced,"Supplier measured, checker approved"');
  assert.equal(row.verifiedDrape,"Balanced");
  assert.equal(row.verifiedPhysicalEvidenceNote,"Supplier measured, checker approved");
});
