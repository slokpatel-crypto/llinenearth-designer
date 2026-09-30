import { NextResponse } from "next/server";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { designerFabricFromStock } from "@/lib/designer/engine";
import { loadDesignerFabricIntelligence } from "@/lib/fabric-intelligence-server";

export const runtime = "nodejs";

export async function GET() {
  const metadata = await loadDesignerFabricMetadata();
  const stock = applyDesignerFabricMetadataToStock(metadata).filter((fabric)=>fabric.inStock);
  const intelligence = await loadDesignerFabricIntelligence(stock.map((fabric)=>fabric.id));
  const fabrics = stock.map((fabric)=>{
    const base=designerFabricFromStock(fabric);
    const analyzed=intelligence[fabric.id];
    const physicalScale=analyzed?.measuredEvidence.patternPhysicalScale;
    const renderScale=physicalScale && physicalScale!=="unknown"
      ? {
        physicalScaleStatus:physicalScale,
        repeatMm:analyzed.measuredEvidence.repeatMm,
        stripeWidthMm:analyzed.measuredEvidence.stripeWidthMm,
      }
      : null;
    return {
      ...base,
      ...(renderScale?{renderScale,patternScaleVerified:true}:{}),
      ...(base.weightGsm===null && analyzed?.verifiedPhysical.gsm!=null ? {weightGsm:analyzed.verifiedPhysical.gsm} : {}),
      ...(base.drape===null && analyzed?.verifiedPhysical.drape ? {drape:analyzed.verifiedPhysical.drape} : {}),
      ...(analyzed?.verifiedPhysical.fiberContent ? {
        fiberContent:analyzed.verifiedPhysical.fiberContent,
        fiberContentVerified:true,
      } : {}),
    };
  });
  return NextResponse.json({
    shirts:fabrics.filter((fabric)=>fabric.allowedGarments.includes("shirt")),
    pants:fabrics.filter((fabric)=>fabric.allowedGarments.includes("pant")),
    calibrated:Object.keys(metadata).length > 0,
    calibratedFabrics:Object.keys(metadata).length,
  });
}
