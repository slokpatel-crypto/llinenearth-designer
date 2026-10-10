import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import { FABRIC_STOCK } from "../src/lib/fabric-stock.ts";
import {
  FABRIC_CALIBRATION_COLUMNS,makeFabricCalibrationRows,fabricCalibrationCsv,
} from "../scripts/export-fabric-calibration.mjs";

test("source-backed operator worksheet includes every published real stock SKU",()=>{
  const stock=FABRIC_STOCK.filter(fabric=>fabric.inStock);
  const rows=makeFabricCalibrationRows(FABRIC_STOCK);
  assert.equal(rows.length,stock.length);
  assert.ok(rows.length>=40);
  assert.equal(new Set(rows.map(row=>row.fabricId)).size,rows.length);
  for(const row of rows){
    const original=stock.find(fabric=>fabric.id===row.fabricId);
    assert.ok(original);
    assert.equal(row.sourcePdf,original.sourceDocument);
    assert.equal(row.sourcePage,String(original.sourcePage));
    assert.equal(row.swatchImage,original.swatchImageUrl);
    assert.equal(row.nominalScreenHex,original.hex);
    assert.equal(row.actualRollMetres,"");
    assert.equal(row.measuredComposition,"");
    assert.equal(row.measuredGsm,"");
    assert.equal(row.measuredPatternRepeatMm,"");
    assert.equal(row.measuredWarpBendingCm,"");
    assert.equal(row.measuredWeftBendingCm,"");
    assert.equal(row.physicalStockChecked,"");
    assert.equal(row.independentlyApprovedBy,"");
    assert.equal(row.approvalState,"PENDING_PHYSICAL_SUPPLIER_AND_TAILOR_REVIEW");
  }
  assert.ok(rows.some(row=>row.garmentRoles.includes("shirt")));
  assert.ok(rows.some(row=>row.garmentRoles.includes("trouser")));
});

test("CSV contains source/provenance headers, valid row counts and no invented metrics",()=>{
  const rows=makeFabricCalibrationRows(FABRIC_STOCK);
  const csv=fabricCalibrationCsv(rows);
  assert.equal(csv.trimEnd().split("\n").length,rows.length+1);
  const header=csv.split("\n")[0];
  for(const field of FABRIC_CALIBRATION_COLUMNS)assert.ok(header.includes('"'+field+'"'));
  assert.ok(header.includes('"measuredPatternRepeatMm"'));
  assert.ok(header.includes('"actualRollMetres"'));
  assert.ok(csv.includes("PENDING_PHYSICAL_SUPPLIER_AND_TAILOR_REVIEW"));
});

test("CSV escapes formula injection and quotes from untrusted supplier catalogue names",()=>{
  const first=FABRIC_STOCK.find(item=>item.inStock);
  assert.ok(first);
  const malicious={...first,colorName:'=HYPERLINK("url","unsafe")'};
  const csv=fabricCalibrationCsv(makeFabricCalibrationRows([malicious]));
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes('""url""'));
  assert.ok(csv.includes('""unsafe""'));
  assert.throws(()=>makeFabricCalibrationRows([first,first]),/Duplicate/);
  assert.throws(()=>makeFabricCalibrationRows([{...first,sourcePage:0}]),/provenance/);
});

test("operator worksheet runs independently of paused 3D/Blender model",()=>{
  const packageJson=JSON.parse(readFileSync("package.json","utf8"));
  assert.ok(packageJson.scripts["fabric:calibration-worksheet"].includes("export-fabric-calibration.mjs"));
  const generator=readFileSync("scripts/export-fabric-calibration.mjs","utf8");
  assert.ok(!generator.includes("blender --background"));
  assert.ok(!generator.includes("garment:model-production"));
  assert.ok(!generator.includes("PENDING_PHYSICAL_SUPPLIER_AND_TAILOR_REVIEW\" ?"));
});
