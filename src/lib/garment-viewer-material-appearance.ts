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
