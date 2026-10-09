import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import { FABRIC_STOCK } from "../src/lib/fabric-stock.ts";
import {measurementWorksheetRows,worksheetCsv} from "../scripts/generate-textile-measurement-worksheet.mjs";

test("every stocked linen SKU receives a separately traceable physical-fabric measurement row",()=>{
  const rows=measurementWorksheetRows(FABRIC_STOCK);
  assert.equal(rows.length,FABRIC_STOCK.length);
  assert.ok(rows.length>=60,"retain the entire current 50-shirt and 16-trouser inventory");
  assert.equal(new Set(rows.map(row=>row.fabricId)).size,rows.length);
  for(const row of rows){
    assert.ok(row.swatchImage.startsWith("/fabrics/"));
    assert.ok(row.sourcePdf?.endsWith(".pdf"));
    assert.ok(row.sourcePage>0);
    assert.equal(row.warpCantileverBendingLengthCm,undefined);
    assert.equal(row.weftCantileverBendingLengthCm,undefined);
    assert.equal(row.productionApproval,"BLOCKED_PENDING_INDEPENDENT_TAILOR_AND_PHYSICAL_FABRIC_REVIEW");
  }
  const csv=worksheetCsv(rows);
  assert.equal(csv.trimEnd().split("\n").length,rows.length+1);
  assert.ok(csv.includes('"warpCantileverBendingLengthCm"'));
  assert.ok(csv.includes('"weftCantileverBendingLengthCm"'));
  assert.ok(csv.includes('"rulerReferencePhoto"'));
});

test("a purportedly complete supplier worksheet cannot invent approval",()=>{
  const item=FABRIC_STOCK[0];
  const rows=measurementWorksheetRows([item],{
    [item.id]:{
      repeatRealMm:12,verifiedGsm:165,warpBendLengthCm:2.1,
      weftBendLengthCm:1.8,measuredBy:"supplier",
      measuredAt:"2026-10-09",independentReviewer:"tailor",
      colorD65Photo:"reference.jpg",rulerPhoto:"ruler.jpg",
    },
  });
  assert.equal(rows[0].supplierRepeatMm,12);
  assert.equal(rows[0].warpCantileverBendingLengthCm,2.1);
  assert.equal(rows[0].productionApproval,"BLOCKED_PENDING_INDEPENDENT_TAILOR_AND_PHYSICAL_FABRIC_REVIEW");
});

test("CSV quoting survives source names and no duplicate fabric identities",()=>{
  const row={...FABRIC_STOCK[0],sourceDocument:'Tailor "A", photographed.pdf'};
  const csv=worksheetCsv(measurementWorksheetRows([row]));
  assert.ok(csv.includes('"Tailor ""A"", photographed.pdf"'));
  assert.throws(()=>measurementWorksheetRows([row,row]),/Duplicate/);
});

test("native 3D candidate CI retains physical textile worksheet with no auto-verified release",()=>{
  const wf=readFileSync(".github/workflows/realistic-3d-candidate.yml","utf8");
  assert.ok(wf.includes("scripts/generate-textile-measurement-worksheet.mjs"));
  assert.ok(wf.includes("artifacts/realistic-3d/textile-measurement-worksheet.csv"));
  assert.ok(wf.includes('test "${{ steps.preflight.outcome }}" = "success"'));
});
