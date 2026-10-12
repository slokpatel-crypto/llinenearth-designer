#!/usr/bin/env node
/** Stock-specific measurements REQUIRED before realistic cloth/drape promotion.
 *
 * Never infers yarn bending stiffness from 60/75 Lea, photo brightness,
 * unverified nominal GSM, or a texture tile. A filled row remains awaiting
 * independent reviewer verification; it is NOT supplier/tailor signoff.
 */
import fs from "node:fs";
import path from "node:path";
import { FABRIC_STOCK } from "../src/lib/fabric-stock.ts";

const COLUMNS=[
  "fabricId","line","pattern","sourcePdf","sourcePage","swatchImage",
  "catalogueNominalHexNotCalibrated","supplierRepeatMm","measuredSwatchWidthMm",
  "independentlyMeasuredGsm","warpCantileverBendingLengthCm",
  "weftCantileverBendingLengthCm","colorCalibrationPhotoD65",
  "rulerReferencePhoto","measuredBy","measuredAt","independentReviewer",
  "productionApproval",
];
const str=v=>v===null||v===undefined?"":String(v);
const csvValue=v=>'"'+str(v).replaceAll('"','""')+'"';
export function measurementWorksheetRows(stock,measurements={}){
  if(!Array.isArray(stock)) throw new TypeError("Stock source must be an array");
  const identifiers=new Set();
  return stock.map(item=>{
    if(!item||typeof item.id!=="string"||identifiers.has(item.id))
      throw new Error("Duplicate or missing fabric identity");
    identifiers.add(item.id);
    const src=measurements[item.id]||{};
    const row={
      fabricId:item.id,line:item.line,pattern:item.pattern,sourcePdf:item.sourceDocument,
      sourcePage:item.sourcePage,swatchImage:item.swatchImageUrl,
      catalogueNominalHexNotCalibrated:item.hex,
      supplierRepeatMm:src.repeatRealMm,
      measuredSwatchWidthMm:src.swatchRealWidthMm,
      independentlyMeasuredGsm:src.verifiedGsm,
      warpCantileverBendingLengthCm:src.warpBendLengthCm,
      weftCantileverBendingLengthCm:src.weftBendLengthCm,
      colorCalibrationPhotoD65:src.colorD65Photo,
      rulerReferencePhoto:src.rulerPhoto,
      measuredBy:src.measuredBy,measuredAt:src.measuredAt,
      independentReviewer:src.independentReviewer,
      productionApproval:"BLOCKED_PENDING_INDEPENDENT_TAILOR_AND_PHYSICAL_FABRIC_REVIEW",
    };
    return row;
  });
}
export function worksheetCsv(rows){
  return COLUMNS.map(csvValue).join(",")+"\n"
    +rows.map(row=>COLUMNS.map(col=>csvValue(row[col])).join(",")).join("\n")+"\n";
}

if(process.argv[1] && path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  const output=path.resolve(process.argv[2]||"artifacts/realistic-3d/textile-measurement-worksheet.csv");
  let declared={};
  try {declared=JSON.parse(fs.readFileSync("scripts/fabric-scales.json","utf8"));}
  catch(e){if(e?.code!=="ENOENT")throw e;}
  const rows=measurementWorksheetRows(FABRIC_STOCK,declared);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,worksheetCsv(rows));
  console.log("Prepared "+rows.length+" actual-stock textile rows. NO physical drape approval inferred: "+output);
}
