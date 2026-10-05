import { GARMENT_PANEL_SPECS, PROTOTYPE_MODEL_ID } from "./garment-viewer-prototype.ts";

export const GARMENT_VIEWER_CONTRACT_VERSION = "linen-earth-garment-viewer-v2";

export type GarmentViewerModelReadiness = "prototype" | "contract_ready" | "contract_failed";

export type GarmentViewerModelContractResult = {
  version: typeof GARMENT_VIEWER_CONTRACT_VERSION;
  modelId: string;
  readiness: GarmentViewerModelReadiness;
  requiredMaterials: string[];
  missingMaterials: string[];
  duplicateMaterials: string[];
  garmentPanels: {
    shirt: number;
    trouser: number;
  };
  physicallyScalable: boolean;
  reasons: string[];
};

export const REQUIRED_GARMENT_VIEWER_MATERIALS = GARMENT_PANEL_SPECS.map((panel)=>panel.material);

export function validateGarmentViewerModelContract(input:{
  modelId:string;
  materialNames:string[];
}):GarmentViewerModelContractResult {
  const names=input.materialNames.map((name)=>String(name||"").trim()).filter(Boolean);
  const counts=new Map<string,number>();
  for(const name of names) counts.set(name,(counts.get(name)||0)+1);

  const missingMaterials=REQUIRED_GARMENT_VIEWER_MATERIALS.filter((name)=>!counts.has(name));
  const duplicateMaterials=REQUIRED_GARMENT_VIEWER_MATERIALS.filter((name)=>(counts.get(name)||0)>1);
  const shirt=GARMENT_PANEL_SPECS.filter((panel)=>panel.garment==="shirt"&&counts.has(panel.material)).length;
  const trouser=GARMENT_PANEL_SPECS.filter((panel)=>panel.garment==="trouser"&&counts.has(panel.material)).length;
  const physicallyScalable=missingMaterials.length===0&&duplicateMaterials.length===0;
  const reasons:string[]=[];

  if(missingMaterials.length) reasons.push(`Missing garment material slots: ${missingMaterials.join(", ")}.`);
  if(duplicateMaterials.length) reasons.push(`Duplicate garment material slots: ${duplicateMaterials.join(", ")}.`);
  if(shirt<3) reasons.push("Shirt needs independent torso, left sleeve and right sleeve materials.");
  if(trouser<3) reasons.push("Trouser needs independent waist, left leg and right leg materials.");
  if(physicallyScalable) reasons.push("All six garment panels can receive independent physically scaled textures.");

  const readiness:GarmentViewerModelReadiness = input.modelId===PROTOTYPE_MODEL_ID
    ? "prototype"
    : physicallyScalable
      ? "contract_ready"
      : "contract_failed";

  return {
    version:GARMENT_VIEWER_CONTRACT_VERSION,
    modelId:input.modelId,
    readiness,
    requiredMaterials:[...REQUIRED_GARMENT_VIEWER_MATERIALS],
    missingMaterials,
    duplicateMaterials,
    garmentPanels:{shirt,trouser},
    physicallyScalable,
    reasons,
  };
}

export function approvedGarmentViewerModelSource(value:string|undefined|null) {
  const source=String(value||"").trim();
  if(!source) return null;
  if(!source.startsWith("/models/")) return null;
  if(!/\.glb(?:\?.*)?$/i.test(source)) return null;
  if(source.includes("..")||source.includes("\\")) return null;
  return source;
}


export type GarmentViewerModelManifest = {
  version: typeof GARMENT_VIEWER_CONTRACT_VERSION;
  modelId: string;
  referenceHeightMm: number;
  panels: Record<string,{widthMm:number;heightMm:number;offsetU?:number;offsetV?:number;rotationDeg?:number}>;
  cameraOrbits?: Partial<Record<"front"|"three-quarter"|"side"|"back",string>>;
};

export type GarmentViewerManifestValidation = {
  valid:boolean;
  missingPanels:string[];
  invalidPanels:string[];
  reasons:string[];
};

export function validateGarmentViewerModelManifest(value:unknown,expectedModelId?:string):GarmentViewerManifestValidation {
  const reasons:string[]=[];
  if(!value || typeof value!=="object") return {valid:false,missingPanels:[...REQUIRED_GARMENT_VIEWER_MATERIALS],invalidPanels:[],reasons:["Manifest is missing or invalid."]};
  const manifest=value as Partial<GarmentViewerModelManifest>;
  if(manifest.version!==GARMENT_VIEWER_CONTRACT_VERSION) reasons.push("Manifest contract version does not match the viewer.");
  if(!String(manifest.modelId||"").trim()) reasons.push("Manifest modelId is required.");
  else if(expectedModelId && manifest.modelId!==expectedModelId) reasons.push(`Manifest modelId ${manifest.modelId} does not match ${expectedModelId}.`);
  if(!Number.isFinite(manifest.referenceHeightMm)||Number(manifest.referenceHeightMm)<1400||Number(manifest.referenceHeightMm)>2200) reasons.push("Reference height must be between 1400 and 2200 mm.");
  const panels=manifest.panels&&typeof manifest.panels==="object"?manifest.panels:{};
  const missingPanels=REQUIRED_GARMENT_VIEWER_MATERIALS.filter((name)=>!(name in panels));
  const invalidPanels=REQUIRED_GARMENT_VIEWER_MATERIALS.filter((name)=>{
    const panel=(panels as Record<string,{widthMm?:unknown;heightMm?:unknown;offsetU?:unknown;offsetV?:unknown;rotationDeg?:unknown}>)[name];
    if(!panel) return false;
    const offsetU=panel.offsetU===undefined?0:Number(panel.offsetU);
    const offsetV=panel.offsetV===undefined?0:Number(panel.offsetV);
    const rotationDeg=panel.rotationDeg===undefined?0:Number(panel.rotationDeg);
    return !Number.isFinite(panel.widthMm)||Number(panel.widthMm)<=0||Number(panel.widthMm)>2000
      || !Number.isFinite(panel.heightMm)||Number(panel.heightMm)<=0||Number(panel.heightMm)>2500
      || !Number.isFinite(offsetU)||Math.abs(offsetU)>10
      || !Number.isFinite(offsetV)||Math.abs(offsetV)>10
      || !Number.isFinite(rotationDeg)||Math.abs(rotationDeg)>360;
  });
  if(missingPanels.length) reasons.push(`Manifest is missing panel dimensions for: ${missingPanels.join(", ")}.`);
  if(invalidPanels.length) reasons.push(`Manifest has invalid panel dimensions for: ${invalidPanels.join(", ")}.`);
  return {valid:reasons.length===0,missingPanels,invalidPanels,reasons};
}

export function approvedGarmentViewerManifestSource(modelSource:string|undefined|null) {
  const source=approvedGarmentViewerModelSource(modelSource);
  if(!source) return null;
  const clean=source.replace(/\?.*$/,"");
  return clean.replace(/\.glb$/i,".viewer.json");
}
