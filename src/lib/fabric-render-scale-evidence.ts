import { normalizeFabricPhysicalEvidenceProvenance, type FabricPhysicalEvidenceProvenance } from "./fabric-physical-provenance.ts";

export type ApprovedFabricTileScale={
  swatchRealWidthMm?:number;
  repeatRealMm?:number;
  physicalEvidence:FabricPhysicalEvidenceProvenance;
};

/**
 * Build-time physical scale is a documented supplier/owner measurement, not
 * an arbitrary number from fabric-scales.json. Unknown, malformed or legacy
 * provenance-free entries stay approximate and cannot certify a tile.
 */
export function approvedFabricTileScaleEvidence(value:unknown):ApprovedFabricTileScale|null {
  if(!value||typeof value!=="object"||Array.isArray(value)) return null;
  const source=value as Record<string,unknown>;
  const physicalEvidence=normalizeFabricPhysicalEvidenceProvenance(source.physicalEvidence);
  if(!physicalEvidence) return null;
  const mm=(field:"swatchRealWidthMm"|"repeatRealMm")=>{
    const raw=source[field];
    if(raw===undefined||raw===null) return undefined;
    if(typeof raw!=="number"||!Number.isFinite(raw)||raw<=0||raw>5000) return null;
    return raw;
  };
  const swatchRealWidthMm=mm("swatchRealWidthMm");
  const repeatRealMm=mm("repeatRealMm");
  if(swatchRealWidthMm===null||repeatRealMm===null ||
    (swatchRealWidthMm===undefined&&repeatRealMm===undefined)) return null;
  return {
    ...(swatchRealWidthMm!==undefined?{swatchRealWidthMm}:{}),
    ...(repeatRealMm!==undefined?{repeatRealMm}:{}),
    physicalEvidence,
  };
}
