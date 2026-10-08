/** Skip redundant WebGL material uploads when only the tailoring recipe changes. */
export type VariantMaterialAppearance={
  textureRevision:number;
  roughness:number;
  shirtId:string;
  trouserId:string;
};

export function needsVariantMaterialRefresh(
  wasVisible:boolean,
  previous:VariantMaterialAppearance|null,
  current:VariantMaterialAppearance,
):boolean {
  if(!wasVisible||!previous) return true;
  return previous.textureRevision!==current.textureRevision
    ||previous.roughness!==current.roughness
    ||previous.shirtId!==current.shirtId
    ||previous.trouserId!==current.trouserId;
}

/** Avoid re-uploading unchanged button material parameters on every style edit. */
export function needsButtonMaterialRefresh(
  wasVisible:boolean,
  previousButtonKey:string|null,
  currentButtonKey:string,
):boolean {
  return !wasVisible || previousButtonKey!==currentButtonKey;
}

/** Cache only fully applied trim appearances; a fabric revision invalidates the cache. */
export function trimAppearanceKey(parts:{
  collar:string; collarConstruction:string; collarFinish:string;
  cuff:string; cuffConstruction:string; sleeve:string;
  shirtId:string; textureRevision:number; roughness:number;
  shirtDrape:string;
}):string {
  return JSON.stringify([
    parts.collar,parts.collarConstruction,parts.collarFinish,
    parts.cuff,parts.cuffConstruction,parts.sleeve,
    parts.shirtId,parts.textureRevision,parts.roughness,parts.shirtDrape,
  ]);
}
