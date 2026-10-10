/**
 * Linen Earth Deep Engine: source-backed physical calibration queue.
 *
 * Catalogue imagery, nominal screen colours and Lea yarn count are NOT
 * measurements of actual roll length, pattern repeat, fibre content or drape.
 * This worksheet is for the operator/supplier/tailor to verify real fabric
 * before allowing any finished-look, stock or physics certainty claims.
 */
import fs from "node:fs";
import path from "node:path";
import { FABRIC_STOCK, type FabricColorway } from "../src/lib/fabric-stock.ts";

export const FABRIC_CALIBRATION_COLUMNS=[
  "fabricId","garmentRoles","collection","colour","cataloguePattern",
  "swatchImage","sourcePdf","sourcePage","nominalScreenHex",
  "declaredCompositionNote","physicalStockChecked",
  "actualRollMetres","measuredComposition","measuredGsm",
  "measuredPatternRepeatMm","measuredSwatchWidthMm",
  "rulerPhotoReference","colourReferencePhoto","measuredWarpBendingCm",
  "measuredWeftBendingCm","tailorDrapeReview",
  "measuredBy","independentlyApprovedBy","approvalState",
] as const;
type CalibrationColumn=typeof FABRIC_CALIBRATION_COLUMNS[number];
export type FabricCalibrationRow=Record<CalibrationColumn,string>;

export function makeFabricCalibrationRows(stock:readonly FabricColorway[]):FabricCalibrationRow[]{
  const seen=new Set<string>();
  return stock.filter(fabric=>fabric.inStock).map(fabric=>{
    if(!fabric.id||seen.has(fabric.id)) throw new Error("Duplicate or missing catalogue fabric ID");
    seen.add(fabric.id);
    if(!Number.isInteger(fabric.sourcePage)||fabric.sourcePage<1
      ||!fabric.sourceDocument||!fabric.swatchImageUrl)
      throw new Error("Missing real supplier catalogue provenance for "+fabric.id);
    return {
      fabricId:fabric.id,
      garmentRoles:fabric.suitableFor.join("; "),
      collection:fabric.line,
      colour:fabric.colorName,
      cataloguePattern:fabric.pattern,
      swatchImage:fabric.swatchImageUrl,
      sourcePdf:fabric.sourceDocument,
      sourcePage:String(fabric.sourcePage),
      nominalScreenHex:fabric.hex,
      declaredCompositionNote:fabric.compositionNote??"",
      physicalStockChecked:"",
      actualRollMetres:"",
      measuredComposition:"",
      measuredGsm:"",
      measuredPatternRepeatMm:"",
      measuredSwatchWidthMm:"",
      rulerPhotoReference:"",
      colourReferencePhoto:"",
      measuredWarpBendingCm:"",
      measuredWeftBendingCm:"",
      tailorDrapeReview:"",
      measuredBy:"",
      independentlyApprovedBy:"",
      approvalState:"PENDING_PHYSICAL_SUPPLIER_AND_TAILOR_REVIEW",
    };
  });
}

function csvCell(value:string):string {
  // Keep spreadsheet import safe: even user-entered supplier names must not
  // become formula expressions after CSV export.
  const safe=/^[\s]*[=+@-]/.test(value)?"'"+value:value;
  return '"'+safe.replace(/"/g,'""')+'"';
}

export function fabricCalibrationCsv(rows:readonly FabricCalibrationRow[]):string {
  const headers=FABRIC_CALIBRATION_COLUMNS.map(csvCell).join(",");
  return [headers,...rows.map(row=>
    FABRIC_CALIBRATION_COLUMNS.map(column=>csvCell(row[column])).join(",")
  )].join("\n")+"\n";
}

const current=process.argv[1]?path.resolve(process.argv[1]):"";
const invoked=path.resolve(new URL(import.meta.url).pathname);
if(current===invoked){
  const filename=path.resolve(process.argv[2]||"artifacts/fabric-calibration-worksheet.csv");
  const rows=makeFabricCalibrationRows(FABRIC_STOCK);
  fs.mkdirSync(path.dirname(filename),{recursive:true});
  fs.writeFileSync(filename,fabricCalibrationCsv(rows),"utf8");
  console.log(`Created ${rows.length} source-backed stock rows. Physical stock, GSM, colour and drape remain UNVERIFIED: ${filename}`);
}
