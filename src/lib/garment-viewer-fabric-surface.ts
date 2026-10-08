/** Fabric-specific *appearance*, not simulated cloth mechanics or measured bending. */
export type GarmentFabricSurfaceMetadata={
  drape?:string|null;
  weightClass?:string|null;
  weightGsm?:number|null;
  weave?:string|null;
};
export type DrapeSurfaceClass="fluid"|"soft"|"medium"|"structured";
export type DrapeSurfaceEvidence="supplier_declared"|"weight_class"|"gsm_estimated"|"unknown";

export function fabricDrapeSurface(metadata:GarmentFabricSurfaceMetadata|null|undefined):{
  category:DrapeSurfaceClass;
  evidence:DrapeSurfaceEvidence;
  normalStrength:number;
  roughnessOffset:number;
}{
  const declared=String(metadata?.drape||"").toLowerCase().trim();
  const valid=["fluid","soft","medium","structured"] as const;
  let category:DrapeSurfaceClass="medium";
  let evidence:DrapeSurfaceEvidence="unknown";
  if(valid.some((name)=>name===declared)){
    category=declared as DrapeSurfaceClass;
    evidence="supplier_declared";
  }else{
    const weight=String(metadata?.weightClass||"").toLowerCase().trim();
    if(weight==="light"||weight==="medium"||weight==="heavy"){
      category=weight==="light"?"soft":weight==="heavy"?"structured":"medium";
      evidence="weight_class";
    }else{
      const gsm=metadata?.weightGsm;
      if(typeof gsm==="number"&&Number.isFinite(gsm)&&gsm>=65&&gsm<=450){
        // Mass-per-area is not a stiffness measurement. Use a visibly
        // conservative fallback, without claiming measured drape physics.
        category=gsm<140?"soft":gsm>240?"structured":"medium";
        evidence="gsm_estimated";
      }
    }
  }
  const adjustments={
    fluid:{normalStrength:0.55,roughnessOffset:-0.08},
    soft:{normalStrength:0.72,roughnessOffset:-0.04},
    medium:{normalStrength:1.0,roughnessOffset:0},
    structured:{normalStrength:1.18,roughnessOffset:0.04},
  } as const;
  return {category,evidence,...adjustments[category]};
}
