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



/**
 * Speculatively hydrate at most two expensive structural garment materials
 * while retaining ordered application of the actual selected look.
 *
 * Failed/abandoned loads are always observed to prevent unhandled rejections
 * when React cancels an obsolete style effect. No visual-ready signal is
 * emitted by this queue: the caller must still apply every material and pass
 * the native WebGL QA gate.
 */
export function createBoundedMaterialPrefetch<T, M>(
  entries:readonly T[],
  load:(entry:T)=>Promise<M>,
  capacity=2,
):{take:(entry:T)=>Promise<M>} {
  if(!Number.isSafeInteger(capacity)||capacity<1||capacity>4)
    throw new Error("Cloth GPU prefetch capacity must be between 1 and 4.");
  if(new Set(entries).size!==entries.length)
    throw new Error("Cloth GPU prefetch must not contain duplicate panels.");
  type Outcome={ok:true;value:M}|{ok:false;error:unknown};
  const pending=new Map<T,Promise<Outcome>>();
  let next=0;
  const fill=()=>{
    while(pending.size<capacity&&next<entries.length){
      const entry=entries[next++];
      const task:Promise<Outcome>=Promise.resolve().then(()=>load(entry)).then(
        (value):Outcome=>({ok:true,value}),
        (error):Outcome=>({ok:false,error}),
      );
      pending.set(entry,task);
    }
  };
  fill();
  return {async take(entry:T):Promise<M>{
    const task=pending.get(entry);
    if(!task) throw new Error("Panel must be taken in declared structural order.");
    const result=await task;
    pending.delete(entry);
    fill();
    if(!result.ok) throw result.error;
    return result.value;
  }};
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

/** Prepare the dressed silhouette before buttons, trim and minor geometry.

 * Real CI showed several shirt accents already visible while no replacement
 * trouser legs had hydrated. Preserve ALL selected fabrics/variations and the
 * same WebGL QA time limit, but prioritize core clothing within that work.
 */
export function garmentSurfaceVisibilityPriority(name:string):number {
  if(/^ShirtTorso(?:TuckedBack|Tucked|Back)?Variant__/.test(name)) return 0;
  if(/^ShirtSleeveL(?:Variant|Length)__/.test(name)) return 1;
  if(/^ShirtSleeveR(?:Variant|Length)__/.test(name)) return 2;
  if(/^TrouserWaist(?:Pleat)?Variant__/.test(name)) return 3;
  if(/^TrouserLegL(?:Break)?Variant__/.test(name)) return 4;
  if(/^TrouserLegR(?:Break)?Variant__/.test(name)) return 5;
  return 10;
}
