/** Skip redundant WebGL material uploads when only the tailoring recipe changes. */
export type VariantMaterialAppearance={
  textureRevision:number;
  roughness:number;
  shirtId:string;
  trouserId:string;
};

/** Never let a superseded fabric edit write after lazy material hydration. */
export async function applyCurrentMaterialBatch<T, M>(options:{
  entries:readonly T[];
  isCurrent:()=>boolean;
  yieldToBrowser:()=>Promise<void>;
  load:(entry:T)=>Promise<M>;
  apply:(material:M,entry:T)=>void;
}):Promise<boolean> {
  for(const entry of options.entries){
    if(!options.isCurrent()) return false;
    await options.yieldToBrowser();
    if(!options.isCurrent()) return false;
    const material=await options.load(entry);
    if(!options.isCurrent()) return false;
    options.apply(material,entry);
  }
  return options.isCurrent();
}

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


/**
 * De-duplicate simultaneous lazy WebGL material hydration across interrupted
 * recipe updates. A rejected promise must be evicted so a retry is possible;
 * the WeakMap must never retain an abandoned 3D model's material objects.
 */
export function createInFlightMaterialLoader<T extends object>() {
  const active=new WeakMap<T,Promise<void>>();
  return async (material:T, load:()=>Promise<void>)=>{
    let pending=active.get(material);
    if(!pending){
      pending=Promise.resolve().then(load);
      active.set(material,pending);
    }
    try{
      await pending;
    }finally{
      if(active.get(material)===pending) active.delete(material);
    }
  };
}


/** Give real user input a chance to run while hydrating many GLB materials. */
export function createCooperativeMaterialBatch(
  yieldToBrowser:()=>Promise<void>,
  batchSize=4,
):()=>Promise<void> {
  if(!Number.isSafeInteger(batchSize)||batchSize<1||batchSize>64)
    throw new Error("WebGL material batch size must be a bounded positive integer.");
  let operations=0;
  return async()=>{
    operations++;
    if(operations%batchSize===0) await yieldToBrowser();
  };
}


/** Sub-second quiet window for native inputs on dense production 3D scenes. */
export function tailoringInputSettleMs(materialCount:number):number {
  if(!Number.isSafeInteger(materialCount)||materialCount<0||materialCount>5000)
    throw new Error("3D material count must be a bounded nonnegative integer.");
  // Hydrating 586 materials in a CPU-backed CI browser can starve real select
  // actionability. Coalesce consecutive changes; keep the smaller prototype fast.
  return materialCount>=300?520:180;
}
