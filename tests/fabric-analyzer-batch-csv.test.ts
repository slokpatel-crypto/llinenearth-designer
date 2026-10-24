import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { catalogPhysicalCsvPrefill, inspectBatchCsvWorksheet, itemsFromCsv } from "../src/lib/fabric-analyzer-batch-csv.ts";

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

test("batch template must not promote provenance-free catalogue GSM and drape to verified claims",()=>{
  const prefill=catalogPhysicalCsvPrefill({weightGsm:145,drape:"structured"});
  assert.deepEqual(prefill,{verifiedGsm:"",verifiedDrape:"",verifiedPhysicalSourceUrl:"",verifiedPhysicalEvidenceNote:""});
});

test("batch template carries source-backed operator measurements with provenance",()=>{
  const prefill=catalogPhysicalCsvPrefill({
    weightGsm:145,drape:"medium",
    physicalEvidence:{sourceType:"owner_measurement",reference:"GSM roll-9",checkedBy:"Checker A",evidenceDate:"2026-10-24",sourceUrl:"https://supplier.example/roll9"},
  });
  assert.equal(prefill.verifiedGsm,145);
  assert.equal(prefill.verifiedDrape,"Balanced");
  assert.equal(prefill.verifiedPhysicalSourceUrl,"https://supplier.example/roll9");
  assert.match(prefill.verifiedPhysicalEvidenceNote,/GSM roll-9.*Checker A.*2026-10-24/);
});

test("batch template rejects malformed provenance and never exports HTTP as verified source",()=>{
  const invalid=catalogPhysicalCsvPrefill({
    weightGsm:145,drape:"fluid",
    physicalEvidence:{sourceType:"estimate",reference:"Guess",checkedBy:"Operator"},
  });
  assert.equal(invalid.verifiedGsm,"");
  assert.equal(invalid.verifiedDrape,"");
  const http=catalogPhysicalCsvPrefill({
    weightGsm:155,drape:"soft",
    physicalEvidence:{sourceType:"supplier_document",reference:"Supplier card 25",checkedBy:"Checker B",sourceUrl:"http://supplier.example/card"},
  });
  assert.equal(http.verifiedGsm,155);
  assert.equal(http.verifiedDrape,"Fluid");
  assert.equal(http.verifiedPhysicalSourceUrl,"");
  assert.match(http.verifiedPhysicalEvidenceNote,/Supplier card 25.*Checker B/);
});

test("malformed CSV headers never silently overwrite physical fields",()=>{
  for(const csv of [
    "fabricId,verifiedGsm,verifiedGsm\nfabric-1,145,",
    "fabricId,,verifiedGsm\nfabric-1,,145",
  ]){
    assert.throws(()=>itemsFromCsv(csv),/empty or duplicate column header/i);
    const result=inspectBatchCsvWorksheet(csv);
    assert.equal(result.items.length,0);
    assert.match(result.error||"",/empty or duplicate/i);
  }
});

test("missing or extra columns reject the entire worksheet with a row number",()=>{
  for(const csv of [
    "fabricId,imageUrl,verifiedGsm\nfabric-1,https://example.com/a.jpg",
    "fabricId,imageUrl\nfabric-1,https://example.com/a.jpg,145",
  ]){
    const result=inspectBatchCsvWorksheet(csv);
    assert.deepEqual(result.items,[]);
    assert.match(result.error||"",/row 2.*columns/i);
  }
});

test("unclosed and displaced CSV quotes do not hide submitted fabric evidence",()=>{
  for(const csv of [
    'fabricId,verifiedPhysicalEvidenceNote\nfabric-1,"Supplier measured GSM',
    'fabricId,verifiedPhysicalEvidenceNote\nfabric-1,Supplier "says" 145',
    'fabricId,verifiedPhysicalEvidenceNote\nfabric-1,"Supplier"garbled',
  ]){
    const result=inspectBatchCsvWorksheet(csv);
    assert.equal(result.items.length,0);
    assert.ok(result.error);
  }
});

test("legitimate escaped quotes, commas and quoted newlines remain supported",()=>{
  const csv=[
    "fabricId,verifiedPhysicalEvidenceNote,verifiedGsm",
    'fabric-1,"Supplier ""measured"" roll, verified',
    'by owner",145',
  ].join("\n");
  const r=inspectBatchCsvWorksheet(csv);
  assert.equal(r.error,null);
  assert.equal(r.items.length,1);
  assert.equal(r.items[0].verifiedGsm,145);
  assert.match(r.items[0].verifiedPhysicalEvidenceNote||"",/Supplier "measured" roll, verified\nby owner/);
});

test("operator cannot run a structurally invalid CSV on the real batch screen",()=>{
  const source=readFileSync("src/app/operator/fabric-analyzer/FabricAnalyzerBatchPanel.tsx","utf8");
  assert.match(source,/inspectBatchCsvWorksheet/);
  assert.match(source,/worksheet\.error/);
  assert.match(source,/role="alert"/);
});

test("fabric physical provenance requires a real calendar date, not just YYYY-MM-DD shape",()=>{
  for(const evidenceDate of ["2026-02-30","2026-04-31","2026-00-10","2026-13-01","0000-01-01"]) {
    const csv=catalogPhysicalCsvPrefill({
      weightGsm:145,drape:"medium",
      physicalEvidence:{sourceType:"owner_measurement",reference:"Roll date",checkedBy:"Operator",evidenceDate},
    });
    assert.equal(csv.verifiedGsm,"",evidenceDate);
    assert.equal(csv.verifiedDrape,"",evidenceDate);
  }
  const leap=catalogPhysicalCsvPrefill({
    weightGsm:145,drape:"medium",
    physicalEvidence:{sourceType:"owner_measurement",reference:"Leap-day roll",checkedBy:"Operator",evidenceDate:"2024-02-29"},
  });
  assert.equal(leap.verifiedGsm,145);
  assert.match(leap.verifiedPhysicalEvidenceNote,/2024-02-29/);
});

test("CSV orphan row with physical facts fails entire worksheet instead of being silently dropped",()=>{
  const csv=[
    "fabricId,imageUrl,verifiedGsm,notes",
    "fabric-1,https://example.com/one.jpg,145,Verified",
    ",,165,This second roll has no identity",
  ].join("\n");
  assert.throws(()=>itemsFromCsv(csv),/row 3.*no fabricId.*imageUrl.*sourcePageUrl/);
  const worksheet=inspectBatchCsvWorksheet(csv);
  assert.deepEqual(worksheet.items,[]);
  assert.match(worksheet.error||"",/row 3/i);
});
test("unsupported/misspelled CSV evidence headings fail closed",()=>{
  for(const csv of [
    "fabricId,verfiedGsm\nfabric-1,145",
    "fabricId,verifiedGsm,unknownSupplierGsm\nfabric-1,145,150",
    "fabricId,__proto__\nfabric-1,malicious",
  ]){
    const worksheet=inspectBatchCsvWorksheet(csv);
    assert.deepEqual(worksheet.items,[]);
    assert.match(worksheet.error||"",/Unsupported CSV column/i);
  }
});
test("valid sheets with blank spacer rows still retain all identified rows in order",()=>{
  const csv=[
    "fabricId,imageUrl,verifiedGsm,notes",
    "fabric-1,https://example.com/one.jpg,145,First",
    ",,,",
    "fabric-2,https://example.com/two.jpg,160,Second",
  ].join("\n");
  const worksheet=inspectBatchCsvWorksheet(csv);
  assert.equal(worksheet.error,null);
  assert.deepEqual(worksheet.items.map((item)=>item.fabricId),["fabric-1","fabric-2"]);
  assert.deepEqual(worksheet.items.map((item)=>item.verifiedGsm),[145,160]);
});
