import { GARMENT_PANEL_SPECS, PROTOTYPE_MODEL_ID } from "./garment-viewer-prototype.ts";
import { LINEN_EARTH_MODEL_IDENTITY_ID, LINEN_EARTH_MODEL_PHYSICAL_TARGETS_MM, LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM, LINEN_EARTH_MODEL_REFERENCE_IMAGE } from "./designer/model-identity.ts";

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


export type GarmentViewerAssetSource = {
  name:string;
  license:string;
  verifiedAt:string;
  sourceUrl?:string;
  licenseUrl?:string;
};

export type GarmentViewerModelManifest = {
  version: typeof GARMENT_VIEWER_CONTRACT_VERSION;
  modelId: string;
  referenceHeightMm: number;
  modelIdentity?:{
    id:string;
    referenceImage:string;
    physicalTargetsMm?:{
      height:number;
      shoulderSeamWidth:number;
      outerArmSilhouette:number;
      shirtWaistWidth:number;
      trouserWaistWidth:number;
      handCenterSpacing:number;
      legCenterSpacing:number;
      hemWidth:number;
    };
  };
  source?:GarmentViewerAssetSource;
  panels: Record<string,{widthMm:number;heightMm:number;offsetU?:number;offsetV?:number;rotationDeg?:number}>;
  cameraOrbits?: Partial<Record<"front"|"three-quarter"|"side"|"back",string>>;
  productionFitEvidence?:{
    gate?:string|null;
    ready?:boolean|null;
    identityFitMeasurementsMm?:Record<string,number|null>|null;
    boundaryIntersections?:Record<string,number|null>|null;
    boundaryClearanceMm?:Record<string,unknown>|null;
    totals?:Record<string,number>|null;
  };
  panelMeasurementEvidence?:{
    source:"owner_measured"|"tailor_measured"|"pattern_room_measured"|"supplier_pattern_verified";
    measuredAt:string;
    note:string;
  };
  panelDimensionSource?:"geometry-estimate-unverified";
  labPreviewScaleNotice?:string;
  productionAssetStatus?:
    |"deterministic-preview-shell-not-realistic-production-asset"
    |"realistic-body-lab-preview-unverified-panel-scale"
    |"realistic-body-production-candidate";
};

export type GarmentViewerManifestValidation = {
  valid:boolean;
  sourceReady:boolean;
  source:GarmentViewerAssetSource|null;
  panelMeasurementReady:boolean;
  fitEvidenceReady:boolean;
  productionAssetReady:boolean;
  missingPanels:string[];
  invalidPanels:string[];
  reasons:string[];
};

export function validateGarmentViewerModelManifest(value:unknown,expectedModelId?:string):GarmentViewerManifestValidation {
  const reasons:string[]=[];
  if(!value || typeof value!=="object") return {valid:false,sourceReady:false,source:null,panelMeasurementReady:false,fitEvidenceReady:false,productionAssetReady:false,missingPanels:[...REQUIRED_GARMENT_VIEWER_MATERIALS],invalidPanels:[],reasons:["Manifest is missing or invalid."]};
  const manifest=value as Partial<GarmentViewerModelManifest>;
  if(manifest.version!==GARMENT_VIEWER_CONTRACT_VERSION) reasons.push("Manifest contract version does not match the viewer.");
  if(!String(manifest.modelId||"").trim()) reasons.push("Manifest modelId is required.");
  else if(expectedModelId && manifest.modelId!==expectedModelId) reasons.push(`Manifest modelId ${manifest.modelId} does not match ${expectedModelId}.`);
  if(!Number.isFinite(manifest.referenceHeightMm)||Number(manifest.referenceHeightMm)<1400||Number(manifest.referenceHeightMm)>2200) reasons.push("Reference height must be between 1400 and 2200 mm.");
  const identityId=String(manifest.modelIdentity?.id||"").trim();
  const identityReference=String(manifest.modelIdentity?.referenceImage||"").trim();
  const identityTargets=manifest.modelIdentity?.physicalTargetsMm;
  const expectedIdentityTargets=LINEN_EARTH_MODEL_PHYSICAL_TARGETS_MM;
  if(manifest.modelId!==PROTOTYPE_MODEL_ID) {
    if(identityId!==LINEN_EARTH_MODEL_IDENTITY_ID) reasons.push(`Production model identity must be ${LINEN_EARTH_MODEL_IDENTITY_ID}.`);
    if(identityReference!==LINEN_EARTH_MODEL_REFERENCE_IMAGE) reasons.push("Production model must reference the exact Real Model Designer studio image.");
    if(Math.abs(Number(manifest.referenceHeightMm)-LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM)>20) reasons.push(`Production model height must stay within 20 mm of ${LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM} mm.`);
    for(const [key,target] of Object.entries(expectedIdentityTargets)){
      const actual=Number(identityTargets?.[key as keyof typeof expectedIdentityTargets]);
      if(!Number.isFinite(actual)||Math.abs(actual-target)>0.5) reasons.push(`Production model identity target ${key} must equal ${target} mm.`);
    }
  }
  const rawSource=manifest.source&&typeof manifest.source==="object"?manifest.source:null;
  const sourceName=String(rawSource?.name||"").trim();
  const sourceLicense=String(rawSource?.license||"").trim();
  const sourceVerifiedAt=String(rawSource?.verifiedAt||"").trim();
  const sourceReady=Boolean(sourceName&&sourceLicense&&/^\d{4}-\d{2}-\d{2}$/.test(sourceVerifiedAt));
  const source=sourceReady?{
    name:sourceName,
    license:sourceLicense,
    verifiedAt:sourceVerifiedAt,
    ...(String(rawSource?.sourceUrl||"").trim()?{sourceUrl:String(rawSource?.sourceUrl).trim()}:{}),
    ...(String(rawSource?.licenseUrl||"").trim()?{licenseUrl:String(rawSource?.licenseUrl).trim()}:{}),
  }:null;
  if(manifest.modelId!==PROTOTYPE_MODEL_ID&&!sourceReady) reasons.push("Model source provenance is required: source name, license and YYYY-MM-DD verification date.");
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

  const measurementEvidence=manifest.panelMeasurementEvidence;
  const allowedMeasurementSources=new Set(["owner_measured","tailor_measured","pattern_room_measured","supplier_pattern_verified"]);
  const panelMeasurementReady=Boolean(
    measurementEvidence
    && allowedMeasurementSources.has(String(measurementEvidence.source||""))
    && /^\d{4}-\d{2}-\d{2}$/.test(String(measurementEvidence.measuredAt||""))
    && String(measurementEvidence.note||"").trim().length>=8
  );
  const fitEvidence=manifest.productionFitEvidence;
  const identityFit=fitEvidence?.identityFitMeasurementsMm;
  const intersections=fitEvidence?.boundaryIntersections;
  const clearances=fitEvidence?.boundaryClearanceMm;
  const totals=fitEvidence?.totals;
  const fitEvidenceReady=Boolean(
    fitEvidence?.gate==="linen-earth-officewear-scene-preflight-v1"
    && fitEvidence?.ready===true
    && identityFit && Object.keys(identityFit).length>0
    && intersections && Object.keys(intersections).length>0
    && clearances && Object.keys(clearances).length>0
    && Number(totals?.triangles)>0
    && Number(totals?.vertices)>0
  );
  const productionAssetReady=Boolean(
    manifest.modelId!==PROTOTYPE_MODEL_ID
    && manifest.productionAssetStatus==="realistic-body-production-candidate"
    && panelMeasurementReady
    && fitEvidenceReady
  );
  return {valid:reasons.length===0,sourceReady,source,panelMeasurementReady,fitEvidenceReady,productionAssetReady,missingPanels,invalidPanels,reasons};
}

export function approvedGarmentViewerManifestSource(modelSource:string|undefined|null) {
  const source=approvedGarmentViewerModelSource(modelSource);
  if(!source) return null;
  const clean=source.replace(/\?.*$/,"");
  return clean.replace(/\.glb$/i,".viewer.json");
}
