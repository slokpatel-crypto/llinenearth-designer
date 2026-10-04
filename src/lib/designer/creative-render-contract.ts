import "server-only";
import { designerFabricFromStock } from "@/lib/designer/engine";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { applyLiveVerifiedStockAvailability } from "@/lib/designer/stock-availability-server";
import { resolveCraftFabrics, validCreativeCraft } from "@/lib/designer/creative-spec";
import type { CreativeFashnRequest } from "@/lib/ai-visualization";

export async function canonicalCreativeRenderRequest(input:CreativeFashnRequest):Promise<CreativeFashnRequest|null>{
  if(!input.creative.craft)return input; // Existing saved V5 recipes remain readable.
  if(!validCreativeCraft(input.creative.craft))return null;
  const metadata=await loadDesignerFabricMetadata(),availability=await applyLiveVerifiedStockAvailability(applyDesignerFabricMetadataToStock(metadata));
  const fabrics=availability.stock.filter(f=>f.inStock).map(designerFabricFromStock),shirt=fabrics.find(f=>f.id===input.shirt.id&&f.allowedGarments.includes("shirt")),pant=fabrics.find(f=>f.id===input.pant.id&&f.allowedGarments.includes("pant"));
  if(!shirt||!pant)return null;
  const craft=resolveCraftFabrics(input.creative.craft,fabrics,shirt.id,pant.id);
  return craft?{...input,shirt,pant,creative:{...input.creative,craft}}:null;
}
