import { NextResponse } from "next/server";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";

export const runtime = "nodejs";

export async function GET() {
  const metadata = await loadDesignerFabricMetadata();
  const stock = applyDesignerFabricMetadataToStock(metadata);

  return NextResponse.json({
    fabrics:stock.filter((fabric)=>fabric.inStock).map((fabric)=>({
      id:fabric.id,
      family:fabric.family,
      line:fabric.line,
      colorName:fabric.colorName,
      hex:fabric.hex,
      swatchImageUrl:fabric.swatchImageUrl,
      suitableFor:fabric.suitableFor,
      pattern:fabric.pattern,
      compositionNote:fabric.compositionNote,
      sourceDocument:fabric.sourceDocument,
      sourcePage:fabric.sourcePage,
      yarnCountLea:fabric.yarnCountLea,
      weightGsm:fabric.weightGsm,
      weightClass:fabric.weightClass,
      weave:fabric.weave,
      texture:fabric.texture,
      drape:fabric.drape,
      seasonTags:fabric.seasonTags,
      formalityScore:fabric.formalityScore,
      roleTags:fabric.roleTags,
      inStock:true,
      availability:metadata[fabric.id]?.availability || "unknown",
      verifiedAt:metadata[fabric.id]?.verifiedAt,
    })),
  });
}
