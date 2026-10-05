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
