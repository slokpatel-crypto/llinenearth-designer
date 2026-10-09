"use client";

import { createElement, useEffect, useMemo, useRef, useState } from "react";
import {applyCurrentMaterialBatch,createCooperativeMaterialBatch, createInFlightMaterialLoader, createBoundedMaterialPrefetch, needsVariantMaterialRefresh, needsButtonMaterialRefresh, garmentSurfaceVisibilityPriority, trimAppearanceKey, tailoringInputSettleMs, type VariantMaterialAppearance} from "@/lib/garment-viewer-material-appearance";
import {
  createPrototypeGarmentGlbUrl,
  GARMENT_PANEL_SPECS,
  PROTOTYPE_MODEL_ID,
} from "@/lib/garment-viewer-prototype";
import { garmentPanelTextureScale, garmentPanelWeaveNormalScale, resolveViewerTileWidthMm, type ViewerRuntimeRenderScale } from "@/lib/garment-viewer-scale";
import { validateGarmentViewerModelContract, validateGarmentViewerModelManifest, type GarmentViewerModelContractResult, type GarmentViewerModelManifest, type GarmentViewerManifestValidation } from "@/lib/garment-viewer-model-contract";
import { GARMENT_VIEWER_LATENCY_STORAGE_KEY, garmentViewerAssetIdentityKey, type GarmentViewerAssetIdentity } from "@/lib/garment-viewer-readiness";
import { GARMENT_CATEGORY_LIBRARY } from "@/lib/designer/garment-category-library";
import { optionById } from "@/lib/designer/options/library";
import { LINEN_EARTH_MODEL_IDENTITY_ID, LINEN_EARTH_MODEL_REFERENCE_IMAGE, LINEN_EARTH_MODEL_VIEWS } from "@/lib/designer/model-identity";
import { fabricDrapeSurface } from "@/lib/garment-viewer-fabric-surface";
import styleVariants from "@/lib/garment-viewer-style-variants.json";
import studioPalette from "../../public/model-identity/studio-material-palette.json";

export type GarmentViewerFabric = {
  id:string;
  name:string;
  line:string;
  image:string;
  tileKey:string;
  drape?:string;
  weightClass?:string;
  weightGsm?:number;
  weave?:string;
};

type ViewerSampler={
  scale?:{u:number;v:number}|null;
  offset?:{u:number;v:number}|null;
  rotation?:number|null;
  setScale?:(scale:{u:number;v:number}|null)=>void;
  setOffset?:(offset:{u:number;v:number}|null)=>void;
  setRotation?:(rotation:number|null)=>void;
};
type ViewerTexture={
  sampler?:ViewerSampler;
};
type TextureInfo={
  setTexture:(texture:ViewerTexture|null)=>void;
};
type Material={
  name:string;
  isLoaded?:boolean;
  ensureLoaded?:()=>Promise<void>;
  pbrMetallicRoughness:{
    baseColorTexture:TextureInfo|null;
    setBaseColorFactor:(color:string|number[])=>void;
    setMetallicFactor:(value:number)=>void;
    setRoughnessFactor:(value:number)=>void;
  };
  normalTexture?:TextureInfo|null;
};
type ModelViewerElement=HTMLElement&{
  model?:{materials:ReadonlyArray<Material>};
  loaded?:boolean;
  cameraOrbit?:string;
  createTexture?:(url:string)=>Promise<ViewerTexture>;
  updateFraming?:()=>void|Promise<void>;
};
type DesignerDraftRecipe={
  shirtId?:string;
  pantId?:string;
  occasion?:string;
  styleSpec?:{
    shirt?:{
      type?:string; collar?:string; collarFinish?:string; cuff?:string; placket?:string; pocket?:string;
      sleeve?:string; fit?:string; hem?:string; wear?:string; button?:string; back?:string;
    };
    pant?:{
      type?:string; fit?:string; rise?:string; pleat?:string; waistband?:string; hem?:string; break?:string;
    };
  };
  style?:{
    collar?:string;
    collarFinish?:string;
    cuff?:string;
    placket?:string;
    shirtFit?:string;
    shirtWear?:string;
    sleeve?:string;
    pocket?:string;
    trouser?:string;
    rise?:string;
    waistband?:string;
    break?:string;
    button?:string;
  };
};
type FabricTileManifest={
  assets?:Record<string,{
    tileRealWidthMm?:number|null;
    repeatPeriodPx?:number|null;
    scaleApproximate?:boolean;
    renderAssetVersion?:string;
  }>;
};
const CAMERA_VIEWS=LINEN_EARTH_MODEL_VIEWS;

const SHIRT_GARMENT_CATEGORY=GARMENT_CATEGORY_LIBRARY.find((item)=>item.id==="shirt")!;
const TROUSER_GARMENT_CATEGORY=GARMENT_CATEGORY_LIBRARY.find((item)=>item.id==="trouser")!;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const COLLAR_FINISH_OPTIONS=[
  {id:"self",label:"Self-fabric"},
  {id:"white_collar",label:"White contrast collar"},
  {id:"white_collar_cuffs",label:"White contrast collar + cuffs"},
] as const;

function createLinenNormalMap(strength=1) {
  if(typeof document==="undefined") return "";
  const canvas=document.createElement("canvas");
  canvas.width=64;canvas.height=64;
  const ctx=canvas.getContext("2d");
  if(!ctx) return "";
  const image=ctx.createImageData(64,64);
  for(let y=0;y<64;y++){
    for(let x=0;x<64;x++){
      const index=(y*64+x)*4;
      const warp=Math.sin(x*Math.PI*.5)*7*strength;
      const weft=Math.sin(y*Math.PI*.4)*5*strength;
      image.data[index]=clamp(128+warp,0,255);
      image.data[index+1]=clamp(128+weft,0,255);
      image.data[index+2]=252;
      image.data[index+3]=255;
    }
  }
  ctx.putImageData(image,0,0);
  return canvas.toDataURL("image/png");
}

const loadMaterialOnce=createInFlightMaterialLoader<Material>();
async function ensureViewerMaterialLoaded(material:Material|null|undefined) {
  if(!material) return null;
  // Multiple short-lived React style effects can hit the same still-unloaded
  // material concurrently. Coalesce those promises rather than requesting
  // duplicate scene-graph shader hydration for rapid tailoring interactions.
  if(material.isLoaded!==true && material.ensureLoaded){
    await loadMaterialOnce(material,()=>material.ensureLoaded!());
  }
  return material;
}

function preferredFabricId(fabrics:GarmentViewerFabric[],ids:string[]) {
  for(const id of ids) if(fabrics.some((fabric)=>fabric.id===id)) return id;
  return fabrics[0]?.id || "";
}

type StyleVariantState={
  shirtFit:string;
  shirtWear:string;
  sleeve:string;
  collar:string;
  collarConstruction:string;
  cuff:string;
  cuffConstruction:string;
  placket:string;
  pocket:string;
  yoke:string;
  shirtBack:string;
  shirtHem:string;
  trouserFit:string;
  rise:string;
  pleat:string;
  waistband:string;
  breakStyle:string;
  trouserHem:string;
  trouserPocket:string;
};

function normalizedStyleLabel(value:string|undefined) {
  return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}
function collarFinishVariantFor(value:string|undefined) {
  const normalized=normalizedStyleLabel(value);
  if(normalized.includes("white")&&normalized.includes("collar")&&normalized.includes("cuff")) return "white_collar_cuffs";
  if(normalized.includes("white")&&normalized.includes("collar")) return "white_collar";
  return "self";
}
function variantIdForLabel(items:ReadonlyArray<{id:string;label:string}>,label:string|undefined,fallback:string) {
  const target=normalizedStyleLabel(label);
  if(!target) return fallback;
  const exact=items.find((item)=>normalizedStyleLabel(item.label)===target);
  if(exact) return exact.id;
  const byWords=items.find((item)=>{
    const candidate=normalizedStyleLabel(item.label);
    return candidate.includes(target)||target.includes(candidate);
  });
  return byWords?.id||fallback;
}
function riseVariantFor(label:string|undefined) {
  const value=normalizedStyleLabel(label);
  if(value.includes("extra high")||value.includes("korean high")) return "extra_high";
  if(value.includes("high")) return "high";
  if(value.includes("low")) return "low";
  return variantIdForLabel(styleVariants.rises,label,"mid");
}
function collarVariantFor(label:string|undefined) {
  const value=normalizedStyleLabel(label);
  if(value.includes("english spread")||value.includes("british collar")||value.includes("british spread")) return "english_spread";
  if(value.includes("hidden")&&value.includes("button")) return "hidden_button_down";
  if(value.includes("button down")) return "button_down";
  if(value.includes("cutaway")) return "cutaway";
  if(value.includes("semi")&&value.includes("spread")) return "semi_spread";
  if(value.includes("spread")) return "spread";
  if(value.includes("club")||value.includes("rounded collar")) return "club";
  if(value.includes("tab")) return "tab";
  if(value.includes("wing")) return "wingtip";
  if(value.includes("mandarin")||value.includes("band collar")) return "mandarin";
  if(value.includes("camp")||value.includes("cuban")) return "camp";
  if(value.includes("one piece")||value.includes("california")) return "one_piece";
  return "point";
}
function cuffVariantFor(label:string|undefined) {
  const value=normalizedStyleLabel(label);
  if(value.includes("rounded french")) return "rounded_french";
  if(value.includes("french")||value.includes("double cuff")) return "french";
  if(value.includes("convertible")) return "convertible";
  if(value.includes("cocktail")||value.includes("turnback")) return "cocktail";
  if(value.includes("mitered")&&value.includes("two")) return "mitered_2";
  if(value.includes("mitered")) return "mitered_1";
  if(value.includes("two button")||value.includes("2 button")) return "rounded_2";
  if(value.includes("long")&&value.includes("button")) return "long_barrel_1";
  if(value.includes("soft")) return "soft_barrel";
  return "barrel_1";
}
function pleatVariantFor(label:string|undefined) {
  const value=normalizedStyleLabel(label);
  if(value.includes("double")&&value.includes("forward")) return "double_forward";
  if(value.includes("double")&&value.includes("reverse")) return "double_reverse";
  if(value.includes("kissing")||value.includes("box pleat")) return "kissing";
  if(value.includes("double")) return "double_reverse";
  if(value.includes("forward")) return "single_forward";
  if(value.includes("reverse")||value.includes("pleat")) return "single_reverse";
  return "flat";
}
function trouserFitVariantFor(recipe:DesignerDraftRecipe|null) {
  const type=normalizedStyleLabel(recipe?.styleSpec?.pant?.type);
  const label=normalizedStyleLabel(recipe?.style?.trouser);
  const value=`${type} ${label}`;
  if(value.includes("baggy")) return "baggy";
  if(value.includes("wide")||value.includes("korean straight")) return "wide";
  if(value.includes("taper")) return "tapered";
  if(value.includes("slim")) return "slim";
  return "straight";
}
function setMaterialAlpha(material:Material|null|undefined,visible:boolean) {
  material?.pbrMetallicRoughness.setBaseColorFactor([1,1,1,visible?1:0]);
}
function isGarmentVariantMaterial(name:string) {
  return name.startsWith("Shirt")||name.startsWith("Trouser");
}
function isButtonVariantMaterial(name:string) {
  return name.startsWith("ButtonAccentVariant__");
}
function variantPanelMaterial(name:string) {
  if(["ShirtTorsoFabric","ShirtSleeveLFabric","ShirtSleeveRFabric","TrouserWaistFabric","TrouserLegLFabric","TrouserLegRFabric"].includes(name)) return name;
  if(name.startsWith("ShirtSleeveL")) return "ShirtSleeveLFabric";
  if(name.startsWith("ShirtSleeveR")) return "ShirtSleeveRFabric";
  if(name.startsWith("ShirtRollBandVariant__")||name.startsWith("ShirtSleeveFinishVariant__")||name.startsWith("ShirtCuffVariant__")) return "ShirtSleeveLFabric";
  if(name.startsWith("TrouserLegL")) return "TrouserLegLFabric";
  if(name.startsWith("TrouserLegR")) return "TrouserLegRFabric";
  if(name.startsWith("TrouserHemVariant__")||name.startsWith("TrouserBreakVariant__")||name.startsWith("TrouserCreaseVariant__")) return "TrouserLegLFabric";
  if(name.startsWith("Shirt")) return "ShirtTorsoFabric";
  if(name.startsWith("Trouser")) return "TrouserWaistFabric";
  return null;
}
function isSkinArmVariantMaterial(name:string) {
  return name.startsWith("MannequinSkinArmVariant__");
}
function setSkinArmAlpha(material:Material|null|undefined,visible:boolean) {
  if(!material) return;
  material.pbrMetallicRoughness.setBaseColorFactor([...studioPalette.skin.rgba.slice(0,3),visible?1:0]);
  material.pbrMetallicRoughness.setMetallicFactor(0);
  material.pbrMetallicRoughness.setRoughnessFactor(studioPalette.skin.roughness);
}
function setButtonMaterial(
  material:Material|null|undefined,
  spec:(typeof styleVariants.buttons)[number]|undefined,
  visible=true,
) {
  if(!material||!spec) return;
  const rgba=[spec.rgba[0],spec.rgba[1],spec.rgba[2],visible?spec.rgba[3]:0];
  material.pbrMetallicRoughness.setBaseColorFactor(rgba);
  material.pbrMetallicRoughness.setMetallicFactor(spec.metallic);
  material.pbrMetallicRoughness.setRoughnessFactor(spec.roughness);
}
function variantMaterialVisible(name:string,state:StyleVariantState) {
  if(name==="ShirtTorsoFabric") return state.shirtWear==="untucked"&&state.shirtFit==="regular"&&state.shirtBack==="plain";
  if(name==="ShirtSleeveLFabric"||name==="ShirtSleeveRFabric") return state.shirtFit==="regular"&&state.sleeve==="full";
  if(name==="TrouserWaistFabric") return state.rise==="mid"&&state.pleat==="flat";
  if(name==="TrouserLegLFabric"||name==="TrouserLegRFabric") return state.trouserFit==="straight"&&state.breakStyle==="slight";
  if(name.startsWith("ShirtTorsoTuckedBackVariant__")) return state.shirtWear==="tucked"&&state.shirtBack!=="plain"&&name.endsWith(`__${state.shirtFit}__${state.rise}__${state.shirtBack}`);
  if(name.startsWith("ShirtTorsoTuckedVariant__")) return state.shirtWear==="tucked"&&state.shirtBack==="plain"&&name.endsWith(`__${state.shirtFit}__${state.rise}`);
  if(name.startsWith("ShirtTorsoVariant__")) return state.shirtWear==="untucked"&&state.shirtBack==="plain"&&name.endsWith(`__${state.shirtFit}`);
  if(name.startsWith("ShirtTorsoBackVariant__")) return state.shirtWear==="untucked"&&state.shirtBack!=="plain"&&name.endsWith(`__${state.shirtFit}__${state.shirtBack}`);
  if(name.startsWith("ShirtSleeveLVariant__")||name.startsWith("ShirtSleeveRVariant__")) return state.sleeve==="full"&&name.endsWith(`__${state.shirtFit}`);
  if(name.startsWith("ShirtHemVariant__")) return state.shirtWear==="untucked"&&name.endsWith(`__${state.shirtFit}`);
  if(name.startsWith("ShirtSleeveLLength__")||name.startsWith("ShirtSleeveRLength__")) return state.sleeve!=="full"&&name.endsWith(`__${state.shirtFit}__${state.sleeve}`);
  if(name.startsWith("ShirtRollBandVariant__")) return state.sleeve==="roll"&&name.endsWith(`__${state.shirtFit}`);
  if(name.startsWith("ShirtSleeveFinishVariant__")) return (state.sleeve==="half"||state.sleeve==="three_quarter")&&name.endsWith(`__${state.shirtFit}__${state.sleeve}`);
  if(name.startsWith("ShirtCollarVariant__")) return name.endsWith(`__${state.collar}__${state.collarConstruction}`);
  if(name.startsWith("ShirtNeckGasketVariant__")) return name.endsWith(`__${state.collar}__${state.collarConstruction}`);
  if(name.startsWith("ShirtCuffVariant__")) return state.sleeve==="full"&&name.endsWith(`__${state.cuff}__${state.cuffConstruction}`);
  if(name.startsWith("ShirtPlacketVariant__")) return state.placket!=="french"&&name.endsWith(`__${state.placket}`);
  if(name.startsWith("ShirtPocketVariant__")) return state.pocket!=="none"&&name.includes(`ShirtPocketVariant__${state.pocket}`);
  if(name.startsWith("ShirtYokeVariant__")) return name.endsWith(`__${state.yoke}`);
  if(name.startsWith("ShirtBackVariant__")) return state.shirtBack!=="plain"&&name.endsWith(`__${state.shirtBack}`);
  if(name.startsWith("ShirtHemShapeVariant__")) return state.shirtWear==="untucked"&&name.endsWith(`__${state.shirtHem}`);
  if(name.startsWith("TrouserLegLVariant__")||name.startsWith("TrouserLegRVariant__")) return state.breakStyle==="slight"&&name.endsWith(`__${state.trouserFit}`);
  if(name.startsWith("TrouserLegLBreakVariant__")||name.startsWith("TrouserLegRBreakVariant__")) return state.breakStyle!=="slight"&&name.endsWith(`__${state.trouserFit}__${state.breakStyle}`);
  if(name.startsWith("TrouserWaistVariant__")) return state.pleat==="flat"&&state.rise!=="mid"&&name.endsWith(`__${state.rise}`);
  if(name.startsWith("TrouserCoreDetailVariant__")) return name.includes(`TrouserCoreDetailVariant__${state.rise}__`)||name.endsWith(`__${state.rise}`);
  if(name.startsWith("TrouserWaistPleatVariant__")) return state.pleat!=="flat"&&name.endsWith(`__${state.rise}__${state.pleat}`);
  if(name.startsWith("TrouserWaistbandVariant__")) return state.waistband!=="clean"&&name.endsWith(`__${state.rise}__${state.waistband}`);
  if(name.startsWith("TrouserPleatVariant__")) return state.pleat!=="flat"&&name.includes(`TrouserPleatVariant__${state.rise}__${state.pleat}__`);
  if(name.startsWith("TrouserBreakVariant__")) return state.breakStyle!=="slight"&&name.endsWith(`__${state.breakStyle}`);
  if(name.startsWith("TrouserHemVariant__")) return state.trouserHem!=="plain"&&name.endsWith(`__${state.trouserFit}__${state.breakStyle}__${state.trouserHem}`);
  if(name.startsWith("TrouserPocketVariant__")) return name.endsWith(`__${state.rise}__${state.trouserPocket}`);
  if(name.startsWith("ButtonAccentVariant__shirt_placket__")) return name.endsWith(`__${state.placket}`);
  if(name.startsWith("ButtonAccentVariant__shirt_collar__")) return name.endsWith(`__${state.collar}`);
  if(name.startsWith("ButtonAccentVariant__shirt_cuff__")) return state.sleeve==="full"&&name.endsWith(`__${state.cuff}`);
  if(name.startsWith("ButtonAccentVariant__shirt_cufflink__")) return state.sleeve==="full"&&name.endsWith(`__${state.cuff}`);
  if(name.startsWith("ButtonAccentVariant__trouser_rise__")) return name.endsWith(`__${state.rise}`);
  return true;
}

function serverVerifiedModelContract(
  modelId:string,
  modelSrc:string|null,
  assetIdentity:GarmentViewerAssetIdentity|null,
) {
  if(!modelSrc||!assetIdentity||modelId===PROTOTYPE_MODEL_ID) return null;
  // assetIdentity is only emitted by the server after the GLB and manifest both pass
  // structural inspection. Seed readiness from that trusted preflight so a transient
  // model-viewer scene-graph hydration gap cannot leave the UI stuck at "loading".
  return validateGarmentViewerModelContract({
    modelId,
    materialNames:GARMENT_PANEL_SPECS.map((panel)=>panel.material),
  });
}

function measuredTileWidth(
  manifest:FabricTileManifest,
  runtimeScale:Record<string,ViewerRuntimeRenderScale>,
  fabric:GarmentViewerFabric|undefined,
) {
  if(!fabric) return null;
  return resolveViewerTileWidthMm(manifest.assets?.[fabric.tileKey],runtimeScale[fabric.id]);
}

export default function GarmentViewer({shirtFabrics,trouserFabrics,modelSrc=null,modelManifestSrc=null,modelId=PROTOTYPE_MODEL_ID,assetIdentity=null}:{
  shirtFabrics:GarmentViewerFabric[];
  trouserFabrics:GarmentViewerFabric[];
  modelSrc?:string|null;
  modelManifestSrc?:string|null;
  modelId?:string;
  assetIdentity?:GarmentViewerAssetIdentity|null;
}) {
  const viewerRef=useRef<ModelViewerElement|null>(null);
  const normalMapRef=useRef("");
  const applyToken=useRef(0);
  const interactionStartedAt=useRef<number|null>(null);
  const preparedTextureRef=useRef(new Map<string,{texture:ViewerTexture;normal:ViewerTexture|null;garment:"shirt"|"trouser"}>());
  const visibleGarmentMaterialsRef=useRef(new Set(GARMENT_PANEL_SPECS.map((panel)=>panel.material)));
  const lastVariantAppearanceRef=useRef<VariantMaterialAppearance|null>(null);
  const visibleButtonMaterialsRef=useRef(new Set<string>());
  const appliedButtonKeyRef=useRef<string|null>(null);
  const appliedTrimKeyRef=useRef<string|null>(null);
  const appliedModelRef=useRef<ModelViewerElement["model"]>(undefined);
  const visibleSkinArmMaterialRef=useRef<string|null>(null);
  const [textureRevision,setTextureRevision]=useState(0);
  // The first <model-viewer> cold start must finish six physically textured
  // base surfaces BEFORE variant shader hydration. Otherwise 586 unloaded
  // shader slots can reveal a white torso beside coloured sleeves, even
  // though the same fabric was chosen for the entire shirt.
  const [preparedFabricVersion,setPreparedFabricVersion]=useState("");
  const [fabricHydrationPhase,setFabricHydrationPhase]=useState("idle");
  const [weavePreparedVersion,setWeavePreparedVersion]=useState("");
  // Customer-visible outfit must stay complete during lazy 586-material GPU
  // hydration. Mark the settled state only AFTER every new physical-panel
  // variant, visible buttons, collar band and cuff have been committed.
  const [tailoringMaterialsReady,setTailoringMaterialsReady]=useState(false);
  const [tailoringPhase,setTailoringPhase]=useState("awaiting-model");
  const [modelUrl,setModelUrl]=useState("");
  const [engineReady,setEngineReady]=useState(false);
  const [modelReady,setModelReady]=useState(false);
  const [modelRevision,setModelRevision]=useState(0);
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState("");
  const [modelContract,setModelContract]=useState<GarmentViewerModelContractResult|null>(
    ()=>serverVerifiedModelContract(modelId,modelSrc,assetIdentity)
  );
  const [modelManifest,setModelManifest]=useState<GarmentViewerModelManifest|null>(null);
  const [modelManifestValidation,setModelManifestValidation]=useState<GarmentViewerManifestValidation|null>(null);
  const [activeView,setActiveView]=useState("front");
  const [shirtId,setShirtId]=useState(()=>preferredFabricId(shirtFabrics,[
    "linen-plain-60-sky-blue",
    "linen-plain-60-light-grey",
    "linen-plain-60-stresa",
    "linen-plain-60-jute-black",
  ]));
  const [trouserId,setTrouserId]=useState(()=>preferredFabricId(trouserFabrics,[
    "linen-suiting-beige",
    "linen-suiting-taupe-beige",
    "linen-suiting-perfect-taupe",
    "linen-suiting-light-cream",
  ]));
  const [tileManifest,setTileManifest]=useState<FabricTileManifest>({});
  const [runtimeScale,setRuntimeScale]=useState<Record<string,ViewerRuntimeRenderScale>>({});
  const [shirtManualTileMm,setShirtManualTileMm]=useState(120);
  const [trouserManualTileMm,setTrouserManualTileMm]=useState(120);
  const [roughness,setRoughness]=useState(.84);
  const [shirtTypeKey,setShirtTypeKey]=useState("dress_shirt");
  const [trouserTypeKey,setTrouserTypeKey]=useState("formal_flat_front");
  const [buttonKey,setButtonKey]=useState("mother_of_pearl");
  const [shirtFitKey,setShirtFitKey]=useState("regular");
  const [shirtWearKey,setShirtWearKey]=useState("tucked");
  const [sleeveKey,setSleeveKey]=useState("full");
  const [collarKey,setCollarKey]=useState("point");
  const [collarFinishKey,setCollarFinishKey]=useState("self");
  const [collarConstructionKey,setCollarConstructionKey]=useState("stiff_fused");
  const [cuffKey,setCuffKey]=useState("barrel_1");
  const [cuffConstructionKey,setCuffConstructionKey]=useState("fused");
  const [placketKey,setPlacketKey]=useState("standard");
  const [pocketKey,setPocketKey]=useState("none");
  const [yokeKey,setYokeKey]=useState("split");
  const [shirtBackKey,setShirtBackKey]=useState("plain");
  const [shirtHemKey,setShirtHemKey]=useState("rounded");
  const [trouserFitKey,setTrouserFitKey]=useState("straight");
  const [riseKey,setRiseKey]=useState("mid");
  const [pleatKey,setPleatKey]=useState("flat");
  const [waistbandKey,setWaistbandKey]=useState("belt_loops");
  const [breakKey,setBreakKey]=useState("slight");
  const [trouserHemKey,setTrouserHemKey]=useState("plain");
  const [trouserPocketKey,setTrouserPocketKey]=useState("slant");
  const [designerDraftRecipe,setDesignerDraftRecipe]=useState<DesignerDraftRecipe|null>(null);
  const draftOptionLabel=(id:string|undefined,fallback?:string)=>{
    if(!id) return fallback;
    return optionById(id)?.label || id.replaceAll("_"," ");
  };
  const draftShirtTypeLabel=draftOptionLabel(designerDraftRecipe?.styleSpec?.shirt?.type,"Shirt type not saved")!;
  const draftTrouserTypeLabel=draftOptionLabel(designerDraftRecipe?.styleSpec?.pant?.type,designerDraftRecipe?.style?.trouser || "Trouser type not saved")!;
  const draftShirtDetails=[
    draftOptionLabel(designerDraftRecipe?.styleSpec?.shirt?.collar,designerDraftRecipe?.style?.collar),
    designerDraftRecipe?.styleSpec?.shirt?.collarFinish || designerDraftRecipe?.style?.collarFinish,
    draftOptionLabel(designerDraftRecipe?.styleSpec?.shirt?.cuff,designerDraftRecipe?.style?.cuff),
    draftOptionLabel(designerDraftRecipe?.styleSpec?.shirt?.placket,designerDraftRecipe?.style?.placket),
    draftOptionLabel(designerDraftRecipe?.styleSpec?.shirt?.fit,designerDraftRecipe?.style?.shirtFit),
    draftOptionLabel(designerDraftRecipe?.styleSpec?.shirt?.back),
    designerDraftRecipe?.styleSpec?.shirt?.wear ? (designerDraftRecipe.styleSpec.shirt.wear==="tucked"?"Tucked":"Untucked") : designerDraftRecipe?.style?.shirtWear,
  ].filter(Boolean);
  const draftTrouserDetails=[
    draftOptionLabel(designerDraftRecipe?.styleSpec?.pant?.fit),
    draftOptionLabel(designerDraftRecipe?.styleSpec?.pant?.rise,designerDraftRecipe?.style?.rise),
    draftOptionLabel(designerDraftRecipe?.styleSpec?.pant?.pleat),
    draftOptionLabel(designerDraftRecipe?.styleSpec?.pant?.waistband,designerDraftRecipe?.style?.waistband),
    draftOptionLabel(designerDraftRecipe?.styleSpec?.pant?.hem),
    draftOptionLabel(designerDraftRecipe?.styleSpec?.pant?.break,designerDraftRecipe?.style?.break),
  ].filter(Boolean);

  const shirt=useMemo(()=>shirtFabrics.find((fabric)=>fabric.id===shirtId) || shirtFabrics[0],[shirtFabrics,shirtId]);
  const trouser=useMemo(()=>trouserFabrics.find((fabric)=>fabric.id===trouserId) || trouserFabrics[0],[trouserFabrics,trouserId]);
  const shirtMeasuredTileMm=useMemo(()=>measuredTileWidth(tileManifest,runtimeScale,shirt),[tileManifest,runtimeScale,shirt]);
  const trouserMeasuredTileMm=useMemo(()=>measuredTileWidth(tileManifest,runtimeScale,trouser),[tileManifest,runtimeScale,trouser]);
  const assetIdentityKey=useMemo(()=>garmentViewerAssetIdentityKey(assetIdentity),[assetIdentity]);
  const shirtTileMm=shirtMeasuredTileMm ?? shirtManualTileMm;
  const trouserTileMm=trouserMeasuredTileMm ?? trouserManualTileMm;
  const productionManifestReady=!modelSrc || modelManifestValidation?.valid===true;
  const panelSpecs=useMemo(()=>GARMENT_PANEL_SPECS.map((panel)=>{
    const measured=modelManifest?.panels?.[panel.material];
    return measured ? {...panel,widthMm:measured.widthMm,heightMm:measured.heightMm,offsetU:measured.offsetU,offsetV:measured.offsetV,rotationDeg:measured.rotationDeg} : panel;
  }),[modelManifest]);
  // Include the literal model revision, cloth images, weight and UV scale.
  // Superseded user selections cannot mark shader work on OLD fabric ready.
  const requestedFabricVersion=JSON.stringify([
    modelRevision,shirt?.id,shirt?.image,shirt?.drape,shirt?.weightGsm,shirtTileMm,
    trouser?.id,trouser?.image,trouser?.drape,trouser?.weightGsm,trouserTileMm,
    panelSpecs.map((panel)=>[panel.material,panel.widthMm,panel.heightMm,panel.offsetU,panel.offsetV,panel.rotationDeg]),
  ]);
  const cameraViews=useMemo(()=>CAMERA_VIEWS.map((view)=>({
    ...view,
    orbit:modelManifest?.cameraOrbits?.[view.id] || view.orbit,
  })),[modelManifest]);
  const styleState=useMemo<StyleVariantState>(()=>({
    shirtFit:shirtFitKey,
    shirtWear:shirtWearKey,
    sleeve:sleeveKey,
    collar:collarKey,
    collarConstruction:collarConstructionKey,
    cuff:cuffKey,
    cuffConstruction:cuffConstructionKey,
    placket:placketKey,
    pocket:pocketKey,
    yoke:yokeKey,
    shirtBack:shirtBackKey,
    shirtHem:shirtHemKey,
    trouserFit:trouserFitKey,
    rise:riseKey,
    pleat:pleatKey,
    waistband:waistbandKey,
    breakStyle:breakKey,
    trouserHem:trouserHemKey,
    trouserPocket:trouserPocketKey,
  }),[shirtFitKey,shirtWearKey,sleeveKey,collarKey,collarConstructionKey,cuffKey,cuffConstructionKey,placketKey,pocketKey,yokeKey,shirtBackKey,shirtHemKey,trouserFitKey,riseKey,pleatKey,waistbandKey,breakKey,trouserHemKey,trouserPocketKey]);

  useEffect(()=>{
    try{
      const raw=localStorage.getItem("linen-earth:real-designer-draft:v2");
      const parsed=raw?JSON.parse(raw) as DesignerDraftRecipe:null;
      if(parsed?.style&&typeof parsed.style==="object"){
        setDesignerDraftRecipe(parsed);
        if(parsed.shirtId&&shirtFabrics.some((fabric)=>fabric.id===parsed.shirtId)) setShirtId(parsed.shirtId);
        if(parsed.pantId&&trouserFabrics.some((fabric)=>fabric.id===parsed.pantId)) setTrouserId(parsed.pantId);
        const shirtSpec=parsed.styleSpec?.shirt;
        const pantSpec=parsed.styleSpec?.pant;
        const optionLabel=(id:string|undefined)=>id ? (optionById(id)?.label||id.replaceAll("_"," ")) : undefined;
        setCollarFinishKey(collarFinishVariantFor(shirtSpec?.collarFinish||parsed.style.collarFinish));

        const savedShirtType=shirtSpec?.type;
        const savedShirtPreset=savedShirtType ? styleVariants.shirtTypes.find((item)=>item.id===savedShirtType)?.preset : undefined;
        if(savedShirtType&&savedShirtPreset){
          setShirtTypeKey(savedShirtType);
          setShirtFitKey(savedShirtPreset.shirtFit);
          setShirtWearKey(savedShirtPreset.shirtWear);
          setSleeveKey(savedShirtPreset.sleeve);
          setCollarKey(savedShirtPreset.collar);
          setCollarConstructionKey(savedShirtPreset.collarConstruction);
          setCuffKey(savedShirtPreset.cuff);
          setCuffConstructionKey(savedShirtPreset.cuffConstruction);
          setPlacketKey(savedShirtPreset.placket);
          setPocketKey(savedShirtPreset.pocket);
          setYokeKey(savedShirtPreset.yoke);
          setShirtBackKey(savedShirtPreset.back||"plain");
          setShirtHemKey(savedShirtPreset.hem);
        }else{
          setShirtFitKey(variantIdForLabel(styleVariants.shirtFits,parsed.style.shirtFit,"regular"));
          setShirtWearKey(variantIdForLabel(styleVariants.shirtWear,parsed.style.shirtWear,"tucked"));
          setSleeveKey(variantIdForLabel(styleVariants.sleeves,parsed.style.sleeve,"full"));
          setCollarKey(collarVariantFor(parsed.style.collar));
          setCuffKey(cuffVariantFor(parsed.style.cuff));
          setPlacketKey(variantIdForLabel(styleVariants.plackets,parsed.style.placket,"standard"));
          setPocketKey(variantIdForLabel(styleVariants.pockets,parsed.style.pocket,"none"));
        }

        // Canonical StyleSpec choices are more precise than the legacy summary and
        // intentionally override only the construction fields the user edited.
        if(shirtSpec?.fit) setShirtFitKey(variantIdForLabel(styleVariants.shirtFits,optionLabel(shirtSpec.fit),savedShirtPreset?.shirtFit||"regular"));
        if(shirtSpec?.wear) setShirtWearKey(variantIdForLabel(styleVariants.shirtWear,shirtSpec.wear,savedShirtPreset?.shirtWear||"tucked"));
        if(shirtSpec?.sleeve) setSleeveKey(variantIdForLabel(styleVariants.sleeves,optionLabel(shirtSpec.sleeve),savedShirtPreset?.sleeve||"full"));
        if(shirtSpec?.collar) setCollarKey(collarVariantFor(optionLabel(shirtSpec.collar)));
        if(shirtSpec?.cuff) setCuffKey(cuffVariantFor(optionLabel(shirtSpec.cuff)));
        if(shirtSpec?.placket) setPlacketKey(variantIdForLabel(styleVariants.plackets,optionLabel(shirtSpec.placket),savedShirtPreset?.placket||"standard"));
        if(shirtSpec?.pocket) setPocketKey(variantIdForLabel(styleVariants.pockets,optionLabel(shirtSpec.pocket),savedShirtPreset?.pocket||"none"));
        if(shirtSpec?.back) setShirtBackKey(variantIdForLabel(styleVariants.shirtBacks,optionLabel(shirtSpec.back),savedShirtPreset?.back||"plain"));
        if(shirtSpec?.hem) setShirtHemKey(variantIdForLabel(styleVariants.shirtHems,optionLabel(shirtSpec.hem),savedShirtPreset?.hem||"rounded"));
        setButtonKey(variantIdForLabel(styleVariants.buttons,optionLabel(shirtSpec?.button)||parsed.style.button,"mother_of_pearl"));

        const savedTrouserType=pantSpec?.type;
        const savedTrouserPreset=savedTrouserType ? styleVariants.trouserTypes.find((item)=>item.id===savedTrouserType)?.preset : undefined;
        if(savedTrouserType&&savedTrouserPreset){
          setTrouserTypeKey(savedTrouserType);
          setTrouserFitKey(savedTrouserPreset.trouserFit);
          setRiseKey(savedTrouserPreset.rise);
          setPleatKey(savedTrouserPreset.pleat);
          setWaistbandKey(savedTrouserPreset.waistband);
          setBreakKey(savedTrouserPreset.breakStyle);
          setTrouserHemKey(savedTrouserPreset.hem);
          setTrouserPocketKey(savedTrouserPreset.pocket);
        }else{
          setTrouserFitKey(trouserFitVariantFor(parsed));
          setRiseKey(riseVariantFor(parsed.style.rise));
          setWaistbandKey(variantIdForLabel(styleVariants.waistbands,parsed.style.waistband,"belt_loops"));
          setBreakKey(variantIdForLabel(styleVariants.breaks,parsed.style.break,"slight"));
          setPleatKey(pleatVariantFor(parsed.style.trouser));
        }

        if(pantSpec?.fit) setTrouserFitKey(variantIdForLabel(styleVariants.trouserFits,optionLabel(pantSpec.fit),savedTrouserPreset?.trouserFit||"straight"));
        if(pantSpec?.rise) setRiseKey(riseVariantFor(optionLabel(pantSpec.rise)));
        if(pantSpec?.pleat) setPleatKey(pleatVariantFor(optionLabel(pantSpec.pleat)));
        if(pantSpec?.waistband) setWaistbandKey(variantIdForLabel(styleVariants.waistbands,optionLabel(pantSpec.waistband),savedTrouserPreset?.waistband||"belt_loops"));
        if(pantSpec?.break) setBreakKey(variantIdForLabel(styleVariants.breaks,optionLabel(pantSpec.break),savedTrouserPreset?.breakStyle||"slight"));
        if(pantSpec?.hem) setTrouserHemKey(variantIdForLabel(styleVariants.trouserHems,optionLabel(pantSpec.hem),savedTrouserPreset?.hem||"plain"));
      }
    }catch{/* 3D Lab stays usable without Designer browser state. */}
  },[shirtFabrics,trouserFabrics]);

  useEffect(()=>{
    normalMapRef.current=createLinenNormalMap();
    if(modelSrc) {
      setModelUrl(modelSrc);
      return;
    }
    const url=createPrototypeGarmentGlbUrl();
    setModelUrl(url);
    return ()=>URL.revokeObjectURL(url);
  },[modelSrc]);

  useEffect(()=>{
    let cancelled=false;
    void fetch("/fabric-tiles/manifest.json",{cache:"no-store"})
      .then((response)=>response.ok?response.json():null)
      .then((value)=>{if(!cancelled&&value&&typeof value==="object")setTileManifest(value as FabricTileManifest);})
      .catch(()=>{});
    return ()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    let cancelled=false;
    setModelManifest(null);
    setModelManifestValidation(modelSrc ? null : {valid:true,sourceReady:true,source:null,panelMeasurementReady:false,fitEvidenceReady:false,productionAssetReady:false,missingPanels:[],invalidPanels:[],reasons:[]});
    if(!modelSrc || !modelManifestSrc) {
      if(modelSrc) setModelManifestValidation({valid:false,sourceReady:false,source:null,panelMeasurementReady:false,fitEvidenceReady:false,productionAssetReady:false,missingPanels:GARMENT_PANEL_SPECS.map((panel)=>panel.material),invalidPanels:[],reasons:["Approved production model needs a matching viewer manifest."]});
      return ()=>{cancelled=true;};
    }
    void fetch(modelManifestSrc,{cache:"no-store"})
      .then(async(response)=>{
        if(!response.ok) throw new Error("Approved model manifest could not be loaded.");
        return response.json();
      })
      .then((value)=>{
        if(cancelled) return;
        const validation=validateGarmentViewerModelManifest(value,modelId);
        setModelManifestValidation(validation);
        if(validation.valid) setModelManifest(value as GarmentViewerModelManifest);
      })
      .catch((reason)=>{
        if(cancelled) return;
        setModelManifestValidation({valid:false,sourceReady:false,source:null,panelMeasurementReady:false,fitEvidenceReady:false,productionAssetReady:false,missingPanels:GARMENT_PANEL_SPECS.map((panel)=>panel.material),invalidPanels:[],reasons:[reason instanceof Error?reason.message:"Approved model manifest could not be loaded."]});
      });
    return ()=>{cancelled=true;};
  },[modelSrc,modelManifestSrc,modelId]);

  useEffect(()=>{
    let cancelled=false;
    void fetch("/api/designer/catalog",{cache:"no-store"})
      .then((response)=>response.ok?response.json():null)
      .then((value)=>{
        if(cancelled || !value || typeof value!=="object") return;
        const rows=[...((value as {shirts?:unknown[]}).shirts||[]),...((value as {pants?:unknown[]}).pants||[])];
        const next:Record<string,ViewerRuntimeRenderScale>={};
        for(const row of rows){
          if(!row || typeof row!=="object") continue;
          const item=row as {id?:unknown;renderScale?:ViewerRuntimeRenderScale|null};
          const id=String(item.id||"");
          const scale=item.renderScale;
          if(id && scale && ["declared_repeat","declared_swatch_width","unknown"].includes(scale.physicalScaleStatus)) next[id]=scale;
        }
        setRuntimeScale(next);
      })
      .catch(()=>{});
    return ()=>{cancelled=true;};
  },[]);

  useEffect(()=>{
    let cancelled=false;
    if(typeof customElements==="undefined") {
      setError("This browser does not expose the custom-elements API required by the 3D viewer.");
      return;
    }
    const timeout=window.setTimeout(()=>{
      if(!cancelled && !customElements.get("model-viewer")) setError("The 3D viewer engine could not be started.");
    },12_000);
    void customElements.whenDefined("model-viewer").then(()=>{
      window.clearTimeout(timeout);
      if(!cancelled){setEngineReady(true);setError("");}
    });
    return ()=>{cancelled=true;window.clearTimeout(timeout);};
  },[]);

  useEffect(()=>{
    const viewer=viewerRef.current;
    if(!viewer) return;
    let cancelled=false;
    let contractTimer:number|undefined;
    let readinessTimer:number|undefined;
    const syncModelContract=(attempt=0)=>{
      if(cancelled) return;
      const retry=()=>{
        if(modelId!==PROTOTYPE_MODEL_ID&&attempt<50){
          contractTimer=window.setTimeout(()=>syncModelContract(attempt+1),100);
        }
      };
      try{
        const materialNames=(viewer.model?.materials||[]).map((material)=>material.name);
        if(modelId!==PROTOTYPE_MODEL_ID&&materialNames.length===0){
          retry();
          return;
        }
        const next=validateGarmentViewerModelContract({modelId,materialNames});
        // A server-verified production asset is authoritative while model-viewer hydrates.
        // Only replace it with a client failure after the scene graph actually exposes materials.
        setModelContract((current)=>{
          if(current?.readiness==="contract_ready"&&assetIdentity&&next.readiness!=="contract_ready") return current;
          return next;
        });
        if(next.readiness!=="contract_ready") retry();
      }catch{
        retry();
      }
    };
    const load=()=>{
      if(viewer.model && appliedModelRef.current!==viewer.model){
        appliedModelRef.current=viewer.model;
        applyToken.current++;
        preparedTextureRef.current.clear();
        setModelRevision((revision)=>revision+1);
        visibleGarmentMaterialsRef.current=new Set(GARMENT_PANEL_SPECS.map((panel)=>panel.material));
        visibleButtonMaterialsRef.current=new Set();
        visibleSkinArmMaterialRef.current=null;
        lastVariantAppearanceRef.current=null;
        appliedButtonKeyRef.current=null;
        appliedTrimKeyRef.current=null;
      }
      setModelReady(true);setProgress(1);setError("");
      syncModelContract();
    };
    const fail=()=>{setError("The 3D garment model could not be loaded.");setModelReady(false);};
    const update=(event:Event)=>{
      const detail=(event as CustomEvent<{totalProgress?:number}>).detail;
      if(typeof detail?.totalProgress==="number") setProgress(clamp(detail.totalProgress,0,1));
    };
    viewer.addEventListener("load",load);
    viewer.addEventListener("error",fail);
    viewer.addEventListener("progress",update);
    // model-viewer can finish loading between React committing the element and this
    // effect attaching its listeners. Recover that missed event so the UI never
    // stays stuck behind the loading veil on a fast cache or CI/browser startup.
    const recoverReadyState=(attempt=0)=>{
      if(cancelled) return;
      if(viewer.loaded || (viewer.model?.materials?.length||0)>0){
        load();
        return;
      }
      // On slow WebGL devices the scene graph can appear well after the element
      // upgrades. A missed load event must not leave customers behind an endless
      // spinner; retain a bounded recovery window and expose a real failure.
      if(attempt<240) {
        readinessTimer=window.setTimeout(()=>recoverReadyState(attempt+1),250);
      } else {
        setError("The 3D model did not become ready within 60 seconds. Refresh to try again.");
        setModelReady(false);
      }
    };
    recoverReadyState();
    return ()=>{
      cancelled=true;
      if(contractTimer!==undefined) window.clearTimeout(contractTimer);
      if(readinessTimer!==undefined) window.clearTimeout(readinessTimer);
      viewer.removeEventListener("load",load);
      viewer.removeEventListener("error",fail);
      viewer.removeEventListener("progress",update);
    };
  },[modelUrl,modelId,assetIdentity]);

  useEffect(()=>{
    const verified=serverVerifiedModelContract(modelId,modelSrc,assetIdentity);
    if(verified) setModelContract(verified);
  },[modelId,modelSrc,assetIdentity]);

  useEffect(()=>{
    if(!modelReady || !shirt || !trouser || !productionManifestReady || modelContract?.readiness==="contract_failed") return;
    const viewer=viewerRef.current;
    if(!viewer?.createTexture || !viewer.model) return;
    const model=viewer.model;
    const token=++applyToken.current;
    let cancelled=false;
    const isCurrent=()=>!cancelled && token===applyToken.current && viewer.model===model;
    const apply=async()=>{
      try{
        setFabricHydrationPhase("creating-color-tiles");
        // Cold WebGL startup is CPU/GPU-bound. Fetch six REAL fabric colour
        // tiles first and hold off twelve concurrent diffuse+normal decodes.
        // The studio outfit must never sit white while optional weave maps
        // block the complete torso/sleeve/trouser texture transaction.
        const prepared=await Promise.all(panelSpecs.map(async(panel)=>{
          const fabric=panel.garment==="shirt"?shirt:trouser;
          const tileMm=panel.garment==="shirt"?shirtTileMm:trouserTileMm;
          const texture=await viewer.createTexture!(fabric.image);
          const scale=garmentPanelTextureScale(panel.widthMm,panel.heightMm,tileMm);
          const offset={u:Number(panel.offsetU)||0,v:Number(panel.offsetV)||0};
          const rotation=(Number(panel.rotationDeg)||0)*Math.PI/180;
          texture.sampler?.setScale?.(scale);
          texture.sampler?.setOffset?.(offset);
          texture.sampler?.setRotation?.(rotation);
          return {panel,texture,normal:null as ViewerTexture|null};
        }));
        if(!isCurrent()) return;
        setFabricHydrationPhase("applying-color-to-all-six-panels");
        const applied=await applyCurrentMaterialBatch({
          entries:prepared,
          isCurrent,
          yieldToBrowser:()=>new Promise<void>((resolve)=>window.setTimeout(resolve,8)),
          load:(entry)=>ensureViewerMaterialLoaded(model.materials.find((material)=>material.name===entry.panel.material)),
          apply:(material,entry)=>{
            if(!material) return;
            // Base panels must stay hidden when a tailoring variant owns the
            // silhouette; changing fabric must not resurrect the default fit.
            const alpha=visibleGarmentMaterialsRef.current.has(entry.panel.material)?1:0;
            material.pbrMetallicRoughness.setBaseColorFactor([1,1,1,alpha]);
            material.pbrMetallicRoughness.setMetallicFactor(0);
            const fabric=entry.panel.garment==="shirt"?shirt:trouser;
            material.pbrMetallicRoughness.setRoughnessFactor(clamp(roughness+fabricDrapeSurface(fabric).roughnessOffset,.55,.98));
            material.pbrMetallicRoughness.baseColorTexture?.setTexture(entry.texture);
            material.normalTexture?.setTexture(entry.normal);
          },
        });
        if(!applied || !isCurrent()) return;
        preparedTextureRef.current=new Map(prepared.map((entry)=>[
          entry.panel.material,
          {texture:entry.texture,normal:entry.normal,garment:entry.panel.garment},
        ]));
        setPreparedFabricVersion(requestedFabricVersion);
        setFabricHydrationPhase("color-ready");
        setTextureRevision((value)=>value+1);
        if(interactionStartedAt.current!==null && modelSrc && assetIdentityKey && modelContract?.readiness==="contract_ready"){
          const duration=performance.now()-interactionStartedAt.current;
          interactionStartedAt.current=null;
          if(Number.isFinite(duration)&&duration>=0&&duration<=10000){
            try{
              const raw=localStorage.getItem(GARMENT_VIEWER_LATENCY_STORAGE_KEY);
              const previous=raw?JSON.parse(raw):null;
              const samples=previous&&typeof previous==="object"&&!Array.isArray(previous)
                && String((previous as {assetKey?:unknown}).assetKey||"")===assetIdentityKey
                && Array.isArray((previous as {samples?:unknown}).samples)
                ? ((previous as {samples:unknown[]}).samples).map(Number).filter((value)=>Number.isFinite(value)&&value>=0&&value<=10000)
                : [];
              samples.push(Math.round(duration*10)/10);
              localStorage.setItem(GARMENT_VIEWER_LATENCY_STORAGE_KEY,JSON.stringify({assetKey:assetIdentityKey,samples:samples.slice(-120)}));
            }catch{}
          }
        }
        setError("");
      }catch{
        if(isCurrent()){
          interactionStartedAt.current=null;
          setError("Fabric texture application failed. The base 3D model is still available.");
        }
      }
    };
    void apply();
    return ()=>{cancelled=true;};
  },[modelReady,modelRevision,shirt,trouser,shirtTileMm,trouserTileMm,panelSpecs,productionManifestReady,modelContract,modelSrc,assetIdentityKey,requestedFabricVersion]);

  useEffect(()=>{
    if(!modelReady) {
      setTailoringPhase("awaiting-model");
      setTailoringMaterialsReady(false);
      return;
    }
    const viewer=viewerRef.current;
    if(!viewer?.model) {
      setTailoringPhase("awaiting-materials");
      setTailoringMaterialsReady(false);
      return;
    }
    if(preparedFabricVersion!==requestedFabricVersion
      || preparedTextureRef.current.size!==panelSpecs.length){
      setTailoringMaterialsReady(false);
      setTailoringPhase("awaiting-fabric-textures");
      return;
    }
    setTailoringMaterialsReady(false);
    setTailoringPhase("queued");
    const model=viewer.model;
    let cancelled=false;
    const isCurrent=()=>!cancelled && viewer.model===model;
    const apply=async()=>{
      // Material shader hydration can block Chromium's native <select> input.
      // Cooperatively yield the main thread after each bounded batch.
      const yieldForInput=createCooperativeMaterialBatch(
        ()=>new Promise<void>((resolve)=>window.setTimeout(resolve,8)),1
      );
      // Allow the real native form-control action to settle before any
      // expensive GLB shader/material mutation starts. Yield between every
      // material rather than batches of four on low-powered GPUs.
      await yieldForInput();
      if(!isCurrent()) return;
      const materials=[...model.materials];
      const materialsByName=new Map(materials.map((material)=>[material.name,material]));
      const previous=new Set(visibleGarmentMaterialsRef.current);
      const appearance={textureRevision,roughness,shirtId,trouserId};
      // An interrupted appearance update can leave a mixture of old/new
      // materials. Invalidate before mutation so reverting also refreshes it.
      if(needsVariantMaterialRefresh(true,lastVariantAppearanceRef.current,appearance)){
        lastVariantAppearanceRef.current=null;
        // Generic fabric refresh writes collar/cuff textures too. Reapply
        // contrast finishes even when only the trouser fabric changed.
        appliedTrimKeyRef.current=null;
      }
      if(isCurrent()) setTailoringPhase("enumerating-variants");
      const next=new Set<string>();
      for(const material of materials){
        if(isGarmentVariantMaterial(material.name)&&variantMaterialVisible(material.name,styleState)) next.add(material.name);
      }
      if(isCurrent()) setTailoringPhase("loading-replacement-cloth");
      // Native Chromium should get the torso, both sleeves, trouser waist and
      // BOTH trouser legs visible before spending time loading 3D accent
      // details. Keep selection intact and track every rendered material.
      const replacements=[...next].sort((a,b)=>
        garmentSurfaceVisibilityPriority(a)-garmentSurfaceVisibilityPriority(b)
      );
      // A cold 586-material GLB can spend >20 seconds compiling shaders
      // sequentially even though the same six selected garment panels are
      // needed. Start at most two structural loads concurrently, preserving
      // the ordered reveal and all native browser readiness checks.
      const coreToHydrate=replacements.filter((name)=>
        garmentSurfaceVisibilityPriority(name)<6
        &&needsVariantMaterialRefresh(previous.has(name),lastVariantAppearanceRef.current,appearance)
      );
      const corePrefetch=createBoundedMaterialPrefetch(
        coreToHydrate,
        (name)=>ensureViewerMaterialLoaded(materialsByName.get(name)),
        2,
      );
      // REPLACEMENT FIRST: never hide the previous outfit before its next
      // shirt, sleeves and two trouser legs are loaded. Earlier code hid all
      // old panels, then awaited GPU hydration of the new variants; real
      // Chromium screenshots showed a floating shirt/legless mannequin.
      // Keep the previous garment visible until every new material is ready.
      for(const name of replacements){
        // Style-only edits often retain most visible variants. Re-uploading the
        // same texture/normal for each retained variant stalls WebGL Chromium.
        if(!needsVariantMaterialRefresh(previous.has(name),lastVariantAppearanceRef.current,appearance)) continue;
        await yieldForInput();
        if(!isCurrent()) return;
        const material=garmentSurfaceVisibilityPriority(name)<6
          ? await corePrefetch.take(name)
          : await ensureViewerMaterialLoaded(materialsByName.get(name));
        if(!isCurrent()) return;
        if(!material) continue;
        const fabric=name.startsWith("Shirt")?shirt:trouser;
        if(!previous.has(name)){
          setMaterialAlpha(material,true);
          visibleGarmentMaterialsRef.current.add(name);
          material.pbrMetallicRoughness.setMetallicFactor(0);
        }
        material.pbrMetallicRoughness.setRoughnessFactor(clamp(roughness+fabricDrapeSurface(fabric).roughnessOffset,.55,.98));
        const panelMaterial=variantPanelMaterial(name);
        const prepared=panelMaterial?preparedTextureRef.current.get(panelMaterial):undefined;
        if(prepared){
          material.pbrMetallicRoughness.baseColorTexture?.setTexture(prepared.texture);
          if(prepared.normal) material.normalTexture?.setTexture(prepared.normal);
        }
      }
      if(isCurrent()) setTailoringPhase("retiring-old-cloth");
      // New garment material variants are now visible (or were already
      // visible). Only now hide the superseded geometry. Cancellation keeps
      // both old and newly revealed panels tracked for the next transaction.
      for(const name of previous){
        if(next.has(name)) continue;
        await yieldForInput();
        if(!isCurrent()) return;
        const material=await ensureViewerMaterialLoaded(materialsByName.get(name));
        if(!isCurrent()) return;
        setMaterialAlpha(material,false);
        visibleGarmentMaterialsRef.current.delete(name);
      }
      visibleGarmentMaterialsRef.current=next;
      lastVariantAppearanceRef.current=appearance;

      await yieldForInput();
      if(!isCurrent()) return;
      if(isCurrent()) setTailoringPhase("skin-and-hardware");
      const nextSkin=styleState.sleeve==="full"?null:`MannequinSkinArmVariant__${styleState.sleeve}`;
      const previousSkin=visibleSkinArmMaterialRef.current;
      if(previousSkin&&previousSkin!==nextSkin){
        const material=await ensureViewerMaterialLoaded(materialsByName.get(previousSkin));
        if(!isCurrent()) return;
        setSkinArmAlpha(material,false);
        visibleSkinArmMaterialRef.current=null;
      }
      if(nextSkin&&nextSkin!==previousSkin){
        const material=await ensureViewerMaterialLoaded(materialsByName.get(nextSkin));
        if(!isCurrent()) return;
        setSkinArmAlpha(material,true);
      }
      visibleSkinArmMaterialRef.current=nextSkin;

      const buttonSpec=styleVariants.buttons.find((item)=>item.id===buttonKey);
      const previousButtons=new Set(visibleButtonMaterialsRef.current);
      if(appliedButtonKeyRef.current!==buttonKey) appliedButtonKeyRef.current=null;
      const nextButtons=new Set(materials.filter((material)=>isButtonVariantMaterial(material.name)&&variantMaterialVisible(material.name,styleState)).map((material)=>material.name));
      for(const name of previousButtons){
        if(nextButtons.has(name)) continue;
        await yieldForInput();
        if(!isCurrent()) return;
        const material=await ensureViewerMaterialLoaded(materialsByName.get(name));
        if(!isCurrent()) return;
        setButtonMaterial(material,buttonSpec,false);
        visibleButtonMaterialsRef.current.delete(name);
      }
      for(const name of nextButtons){
        if(!needsButtonMaterialRefresh(previousButtons.has(name),appliedButtonKeyRef.current,buttonKey)) continue;
        await yieldForInput();
        if(!isCurrent()) return;
        const material=await ensureViewerMaterialLoaded(materialsByName.get(name));
        if(!isCurrent()) return;
        setButtonMaterial(material,buttonSpec,true);
        visibleButtonMaterialsRef.current.add(name);
      }
      visibleButtonMaterialsRef.current=nextButtons;
      await yieldForInput();
      if(!isCurrent()) return;
      if(appliedButtonKeyRef.current!==buttonKey){
        const baseButton=await ensureViewerMaterialLoaded(materialsByName.get("ButtonAccent"));
        if(!isCurrent()) return;
        setButtonMaterial(baseButton,buttonSpec,true);
      }
      appliedButtonKeyRef.current=buttonKey;

      if(isCurrent()) setTailoringPhase("collar-and-cuff");
      const trimKey=trimAppearanceKey({
        collar:collarKey,collarConstruction:collarConstructionKey,collarFinish:collarFinishKey,
        cuff:cuffKey,cuffConstruction:cuffConstructionKey,sleeve:styleState.sleeve,
        shirtId,textureRevision,roughness,shirtDrape:shirt?.drape||"",
      });
      if(appliedTrimKeyRef.current===trimKey) {
        if(isCurrent()) {setTailoringMaterialsReady(true);setTailoringPhase("ready");}
        return;
      }
      appliedTrimKeyRef.current=null;

      const shirtBase=clamp(roughness+fabricDrapeSurface(shirt).roughnessOffset,.55,.98);
      const shirtBodyPrepared=preparedTextureRef.current.get("ShirtTorsoFabric");
      const shirtSleevePrepared=preparedTextureRef.current.get("ShirtSleeveLFabric");
      const collarOffset=collarConstructionKey==="soft_unfused"?.07:collarConstructionKey==="soft_fused"?.035:0;
      await yieldForInput();
      if(!isCurrent()) return;
      const collar=await ensureViewerMaterialLoaded(materialsByName.get(`ShirtCollarVariant__${collarKey}__${collarConstructionKey}`));
      if(!isCurrent()) return;
      const whiteCollar=collarFinishKey!=="self";
      if(collar){
        collar.pbrMetallicRoughness.setBaseColorFactor(whiteCollar?[.97,.97,.95,1]:[1,1,1,1]);
        if(whiteCollar) collar.pbrMetallicRoughness.baseColorTexture?.setTexture(null);
        else if(shirtBodyPrepared) collar.pbrMetallicRoughness.baseColorTexture?.setTexture(shirtBodyPrepared.texture);
        collar.pbrMetallicRoughness.setRoughnessFactor(clamp(shirtBase+collarOffset,.55,.98));
      }
      await yieldForInput();
      if(!isCurrent()) return;
      const neckGasket=await ensureViewerMaterialLoaded(materialsByName.get(`ShirtNeckGasketVariant__${collarKey}__${collarConstructionKey}`));
      if(!isCurrent()) return;
      if(neckGasket){
        neckGasket.pbrMetallicRoughness.setBaseColorFactor(whiteCollar?[.97,.97,.95,1]:[1,1,1,1]);
        if(whiteCollar) neckGasket.pbrMetallicRoughness.baseColorTexture?.setTexture(null);
        else if(shirtBodyPrepared) neckGasket.pbrMetallicRoughness.baseColorTexture?.setTexture(shirtBodyPrepared.texture);
        neckGasket.pbrMetallicRoughness.setRoughnessFactor(clamp(shirtBase+collarOffset,.55,.98));
      }
      if(styleState.sleeve==="full"){
        const cuffOffset=cuffConstructionKey==="soft"?.06:0;
        await yieldForInput();
        if(!isCurrent()) return;
        const cuff=await ensureViewerMaterialLoaded(materialsByName.get(`ShirtCuffVariant__${cuffKey}__${cuffConstructionKey}`));
        if(!isCurrent()) return;
        if(cuff){
          const whiteCuff=collarFinishKey==="white_collar_cuffs";
          cuff.pbrMetallicRoughness.setBaseColorFactor(whiteCuff?[.97,.97,.95,1]:[1,1,1,1]);
          if(whiteCuff) cuff.pbrMetallicRoughness.baseColorTexture?.setTexture(null);
          else if(shirtSleevePrepared) cuff.pbrMetallicRoughness.baseColorTexture?.setTexture(shirtSleevePrepared.texture);
          cuff.pbrMetallicRoughness.setRoughnessFactor(clamp(shirtBase+cuffOffset,.55,.98));
        }
      }
      appliedTrimKeyRef.current=trimKey;
      if(isCurrent()) {setTailoringMaterialsReady(true);setTailoringPhase("ready");}
    };
    // The React <select> value must commit and paint BEFORE cold WebGL shader
    // updates begin. Without a bounded input-first interval, Chromium may
    // apply the real change but Playwright/native input remains stuck in GPU
    // work for 12+ seconds. Cancel obsolete appearance work on each edit.
    const inputSettleTimer=window.setTimeout(()=>{
      if(!isCurrent()) return;
      void apply().catch(()=>{
        if(isCurrent()){
          setTailoringMaterialsReady(false);
          setTailoringPhase("error");
          setError("A tailoring variant could not be prepared. Try another option.");
        }
      });
    },tailoringInputSettleMs(viewer.model?.materials.length||0));
    return ()=>{cancelled=true;window.clearTimeout(inputSettleTimer);};
  },[modelReady,modelRevision,styleState,buttonKey,textureRevision,preparedFabricVersion,requestedFabricVersion,panelSpecs.length,roughness,shirt,trouser,collarKey,collarFinishKey,collarConstructionKey,cuffKey,cuffConstructionKey]);

  // Weave normals are SECONDARY detail. Hydrate them only after the entire
  // selected outfit actually passes the honest WebGL-ready state. Applying
  // twelve cold textures together previously starved six key colour panels.
  useEffect(()=>{
    if(!tailoringMaterialsReady || preparedFabricVersion!==requestedFabricVersion
      || weavePreparedVersion===requestedFabricVersion || !modelReady) return;
    const viewer=viewerRef.current;
    if(!viewer?.model||!viewer.createTexture) return;
    const model=viewer.model;
    let cancelled=false;
    const valid=()=>!cancelled&&viewer.model===model&&
      preparedFabricVersion===requestedFabricVersion;
    const hydrateWeave=async()=>{
      const normalsByPanel=new Map<string,ViewerTexture>();
      const urls={
        shirt:createLinenNormalMap(fabricDrapeSurface(shirt).normalStrength),
        trouser:createLinenNormalMap(fabricDrapeSurface(trouser).normalStrength),
      };
      setFabricHydrationPhase("weave-normals-in-background");
      for(const panel of panelSpecs){
        if(!valid()) return;
        // Lower-priority linen microrelief must yield to real customer input.
        await new Promise<void>((resolve)=>window.setTimeout(resolve,8));
        if(!valid()) return;
        const normal=await viewer.createTexture!(panel.garment==="shirt"?urls.shirt:urls.trouser);
        if(!valid()) return;
        normal.sampler?.setScale?.(garmentPanelWeaveNormalScale(panel.widthMm,panel.heightMm));
        normal.sampler?.setOffset?.({u:Number(panel.offsetU)||0,v:Number(panel.offsetV)||0});
        normal.sampler?.setRotation?.((Number(panel.rotationDeg)||0)*Math.PI/180);
        normalsByPanel.set(panel.material,normal);
      }
      if(!valid()) return;
      for(const panel of panelSpecs){
        const existing=preparedTextureRef.current.get(panel.material);
        if(existing) preparedTextureRef.current.set(panel.material,{
          ...existing,normal:normalsByPanel.get(panel.material)||null,
        });
      }
      // Touch only ALREADY loaded, visible garment shaders. Do not reload
      // 586 material variants to add subtle fibre relief.
      for(const material of model.materials){
        if(material.isLoaded!==true) continue;
        const pbr=material.pbrMetallicRoughness;
        const panel=variantPanelMaterial(material.name);
        if(!panel || !visibleGarmentMaterialsRef.current.has(material.name)) continue;
        const normal=normalsByPanel.get(panel);
        if(normal) material.normalTexture?.setTexture(normal);
      }
      if(valid()){
        setWeavePreparedVersion(requestedFabricVersion);
        setFabricHydrationPhase("weave-ready");
      }
    };
    void hydrateWeave().catch(()=>{
      if(valid())setFabricHydrationPhase("color-ready-weave-pending");
    });
    return ()=>{cancelled=true;};
  },[tailoringMaterialsReady,preparedFabricVersion,requestedFabricVersion,
      weavePreparedVersion,modelReady,modelRevision,shirt,trouser,panelSpecs]);

  function applyShirtTypePreset(id:string){
    setShirtTypeKey(id);
    const preset=styleVariants.shirtTypes.find((item)=>item.id===id)?.preset;
    if(!preset) return;
    setShirtFitKey(preset.shirtFit);
    setShirtWearKey(preset.shirtWear);
    setSleeveKey(preset.sleeve);
    setCollarKey(preset.collar);
    setCollarConstructionKey(preset.collarConstruction);
    setCuffKey(preset.cuff);
    setCuffConstructionKey(preset.cuffConstruction);
    setPlacketKey(preset.placket);
    setPocketKey(preset.pocket);
    setYokeKey(preset.yoke);
    setShirtBackKey(preset.back||"plain");
    setShirtHemKey(preset.hem);
  }

  function applyYokeVariant(id:string){
    setYokeKey(id);
    if(id==="western"||id==="bias_western") setShirtBackKey("plain");
  }

  function applyShirtBackVariant(id:string){
    setShirtBackKey(id);
    if(id!=="plain"&&(yokeKey==="western"||yokeKey==="bias_western")) setYokeKey("split");
  }

  function applyTrouserTypePreset(id:string){
    setTrouserTypeKey(id);
    const preset=styleVariants.trouserTypes.find((item)=>item.id===id)?.preset;
    if(!preset) return;
    setTrouserFitKey(preset.trouserFit);
    setRiseKey(preset.rise);
    setPleatKey(preset.pleat);
    setWaistbandKey(preset.waistband);
    setBreakKey(preset.breakStyle);
    setTrouserHemKey(preset.hem);
    setTrouserPocketKey(preset.pocket);
  }

  function beginFabricInteraction(){
    interactionStartedAt.current=performance.now();
  }

  function setCamera(view:(typeof cameraViews)[number]) {
    setActiveView(view.id);
    const viewer=viewerRef.current;
    if(!viewer) return;
    viewer.cameraOrbit=view.orbit;
    viewer.setAttribute("camera-orbit",view.orbit);
  }

  const modelViewer=modelUrl ? createElement("model-viewer",{
    ref:(element:HTMLElement|null)=>{viewerRef.current=element as ModelViewerElement|null;},
    src:modelUrl,
    alt:"Interactive Linen Earth officewear 3D mannequin wearing a shirt and trousers",
    "camera-controls":true,
    "touch-action":"pan-y",
    "camera-orbit":cameraViews[0].orbit,
    "camera-target":"0m 0.86m 0m",
    "field-of-view":"30deg",
    "min-field-of-view":"25deg",
    "max-field-of-view":"40deg",
    "min-camera-orbit":"auto 58deg 3.35m",
    "max-camera-orbit":"auto 92deg 5.4m",
    "interpolation-decay":"135",
    "environment-image":"neutral",
    "shadow-intensity":".78",
    "shadow-softness":".96",
    "exposure":"1.12",
    "tone-mapping":"commerce",
    loading:"eager",
    "interaction-prompt":"none",
    className:"garmentModelViewer",
  }) : null;

  return <section className="garmentViewerShell" data-model-readiness={modelContract?.readiness || "loading"} data-manifest-ready={productionManifestReady} data-tailoring-ready={tailoringMaterialsReady?"true":"false"} data-tailoring-phase={tailoringPhase} data-active-view={activeView} data-collar-finish={collarFinishKey} data-identity-visual-parity="unverified" data-fabric-phase={fabricHydrationPhase}>
    <div className="garmentViewerStage">
      <div className="garmentViewerStageHead">
        <span>GARMENTVIEWER · DEEP ENGINE</span>
        <strong>STUDIO REFERENCE LOCKED · 3D VISUAL MATCH PENDING</strong>
      </div>
      <div className="garmentViewerIdentityAudit" role="note" aria-label="Compare the original Real Model Designer model with the unfinished 3D candidate">
        <img src={LINEN_EARTH_MODEL_REFERENCE_IMAGE} alt="Original Real Model Designer reference, not the current 3D render" />
        <div>
          <strong>Original Real Model Designer model</strong>
          <p>THIS is the appearance to match. The 3D viewer below currently uses a separate MakeHuman-derived body and procedural garments. Matching its measurements does not establish the same visual identity. Front, 3/4, side and back still require independent visual approval.</p>
          <span>3D SOURCE · UNAPPROVED VISUAL MATCH</span>
        </div>
      </div>
      <div className="garmentViewerCanvas">
        {modelViewer}
        {!modelReady&&<div className="garmentViewerLoading"><i style={{width:`${Math.round(progress*100)}%`}}/><strong>{engineReady?(modelSrc?"Loading officewear model…":"Loading prototype garment…"):"Starting 3D engine…"}</strong><span>{Math.round(progress*100)}%</span></div>}
        {error&&<div className="garmentViewerError">{error}</div>}
      </div>
      <div className="garmentCameraRail" role="group" aria-label="Garment camera views">
        {cameraViews.map((view)=><button key={view.id} type="button" aria-pressed={activeView===view.id} onClick={()=>setCamera(view)}>{view.label}</button>)}
      </div>
      <p className="garmentViewerHint">Front · 3/4 · side · back rotate the current 3D candidate, not a verified copy of the studio model. Drag to rotate · pinch/scroll to zoom.</p>
    </div>

    <aside className="garmentViewerControls">
      <div>
        <span className="garmentViewerEyebrow">REAL FABRIC → REUSABLE MODEL</span>
        <h1>Live tailoring + fabric model.</h1>
        <p>The experimental 3D mannequin remains fixed between views, but its appearance has not matched the original Real Model Designer image. Fabric and tailoring construction switch independently: shirt type/fit/rise-aware waist-shaped tuck/sleeves/360° cuffs/raised-back collar band/collar construction/white contrast collar-cuffs/placket/pockets/yoke/hem plus trouser type/shape/rise/pleat direction/waistband/break/turn-up/pockets. {shirtFabrics.length} shirt fabrics and {trouserFabrics.length} trouser fabrics use the same live Designer stock.</p>
      </div>



      <section className="garmentTypeLibrary" aria-label="Garment type roadmap">
        <div className="garmentTypeLibraryHead"><span>GARMENT TYPES · CURRENT + FUTURE</span><b>Fabric is only one layer. Each garment keeps its own construction details.</b></div>
        <div className="garmentTypeGrid">
          {GARMENT_CATEGORY_LIBRARY.map((garment)=><article key={garment.id} data-status={garment.status}>
            <div><strong>{garment.label}</strong><em>{garment.status==="live"?"LIVE":"FUTURE"}</em></div>
            <small>{garment.stageLabel}</small>
            <p>{garment.description}</p>
            <div className="garmentTypeExamples"><b>Types</b><span>{garment.typeExamples.join(" · ")}</span></div>
            <ul>{garment.detailFamilies.map((detail)=><li key={detail}>{detail}</li>)}</ul>
          </article>)}
        </div>
      </section>

      {designerDraftRecipe?.style&&<section className="garmentDraftRecipe" aria-label="Current Designer garment recipe">
        <div><span>YOUR DESIGNER RECIPE</span><b>{designerDraftRecipe.occasion||"Saved look"}</b></div>
        <div className="garmentDraftRecipeGrid">
          <article><strong>Shirt · {draftShirtTypeLabel}</strong><p>{draftShirtDetails.join(" · ")}</p></article>
          <article><strong>Trouser · {draftTrouserTypeLabel}</strong><p>{draftTrouserDetails.join(" · ")}</p></article>
        </div>
        <small>The saved Designer recipe now drives the same 3D tailoring-variant system; you can refine it below without changing the locked mannequin identity.</small>
      </section>}

      <section className="garmentStyleControls" aria-label="Live tailoring variations">
        <div className="garmentTypeLibraryHead"><span>LIVE TAILORING VARIATIONS</span><b>Geometry-backed · same locked mannequin</b></div>
        <div className="garmentStyleControlGrid">
          <label><span>Shirt type</span><select aria-label="3D shirt type" value={shirtTypeKey} onChange={(e)=>applyShirtTypePreset(e.target.value)}>{styleVariants.shirtTypes.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Trouser type</span><select aria-label="3D trouser type" value={trouserTypeKey} onChange={(e)=>applyTrouserTypePreset(e.target.value)}>{styleVariants.trouserTypes.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Shirt fit</span><select aria-label="3D shirt fit" value={shirtFitKey} onChange={(e)=>setShirtFitKey(e.target.value)}>{styleVariants.shirtFits.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Wear</span><select aria-label="3D shirt wear" value={shirtWearKey} onChange={(e)=>setShirtWearKey(e.target.value)}>{styleVariants.shirtWear.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Sleeve</span><select aria-label="3D sleeve" value={sleeveKey} onChange={(e)=>setSleeveKey(e.target.value)}>{styleVariants.sleeves.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Collar</span><select aria-label="3D collar" value={collarKey} onChange={(e)=>setCollarKey(e.target.value)}>{styleVariants.collars.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Collar build</span><select aria-label="3D collar construction" value={collarConstructionKey} onChange={(e)=>setCollarConstructionKey(e.target.value)}>{styleVariants.collarConstruction.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Collar cloth</span><select aria-label="3D collar cloth" value={collarFinishKey} onChange={(e)=>setCollarFinishKey(e.target.value)}>{COLLAR_FINISH_OPTIONS.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Cuff</span><select aria-label="3D cuff" value={cuffKey} onChange={(e)=>setCuffKey(e.target.value)}>{styleVariants.cuffs.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Cuff build</span><select aria-label="3D cuff construction" value={cuffConstructionKey} onChange={(e)=>setCuffConstructionKey(e.target.value)}>{styleVariants.cuffConstruction.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Button material</span><select aria-label="3D button material" value={buttonKey} onChange={(e)=>setButtonKey(e.target.value)}>{styleVariants.buttons.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Placket</span><select aria-label="3D placket" value={placketKey} onChange={(e)=>setPlacketKey(e.target.value)}>{styleVariants.plackets.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Shirt pocket</span><select aria-label="3D pocket" value={pocketKey} onChange={(e)=>setPocketKey(e.target.value)}>{styleVariants.pockets.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Yoke</span><select aria-label="3D shirt yoke" value={yokeKey} onChange={(e)=>applyYokeVariant(e.target.value)}>{styleVariants.yokes.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Back construction</span><select aria-label="3D shirt back" value={shirtBackKey} onChange={(e)=>applyShirtBackVariant(e.target.value)}>{styleVariants.shirtBacks.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Shirt hem</span><select aria-label="3D shirt hem" value={shirtHemKey} onChange={(e)=>setShirtHemKey(e.target.value)}>{styleVariants.shirtHems.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Trouser shape</span><select aria-label="3D trouser fit" value={trouserFitKey} onChange={(e)=>setTrouserFitKey(e.target.value)}>{styleVariants.trouserFits.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Rise</span><select aria-label="3D trouser rise" value={riseKey} onChange={(e)=>setRiseKey(e.target.value)}>{styleVariants.rises.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Pleat</span><select aria-label="3D trouser pleat" value={pleatKey} onChange={(e)=>setPleatKey(e.target.value)}>{styleVariants.pleats.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Waistband</span><select aria-label="3D trouser waistband" value={waistbandKey} onChange={(e)=>setWaistbandKey(e.target.value)}>{styleVariants.waistbands.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Break</span><select aria-label="3D trouser break" value={breakKey} onChange={(e)=>setBreakKey(e.target.value)}>{styleVariants.breaks.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Hem finish</span><select aria-label="3D trouser hem" value={trouserHemKey} onChange={(e)=>setTrouserHemKey(e.target.value)}>{styleVariants.trouserHems.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label><span>Trouser pockets</span><select aria-label="3D trouser pockets" value={trouserPocketKey} onChange={(e)=>setTrouserPocketKey(e.target.value)}>{styleVariants.trouserPockets.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        </div>
        <div className="garmentStyleLiveSummary">
          <span><b>SHIRT</b>{styleVariants.shirtTypes.find((x)=>x.id===shirtTypeKey)?.label} · {styleVariants.shirtFits.find((x)=>x.id===shirtFitKey)?.label} · {styleVariants.collars.find((x)=>x.id===collarKey)?.label} · {COLLAR_FINISH_OPTIONS.find((x)=>x.id===collarFinishKey)?.label} · {styleVariants.yokes.find((x)=>x.id===yokeKey)?.label} · {styleVariants.shirtBacks.find((x)=>x.id===shirtBackKey)?.label} · {styleVariants.shirtHems.find((x)=>x.id===shirtHemKey)?.label}</span>
          <span><b>TROUSER</b>{styleVariants.trouserTypes.find((x)=>x.id===trouserTypeKey)?.label} · {styleVariants.trouserFits.find((x)=>x.id===trouserFitKey)?.label} · {styleVariants.pleats.find((x)=>x.id===pleatKey)?.label} · {styleVariants.waistbands.find((x)=>x.id===waistbandKey)?.label} · {styleVariants.trouserHems.find((x)=>x.id===trouserHemKey)?.label}</span>
        </div>
      </section>

      <div className="garmentCurrentType"><span>ACTIVE GARMENT</span><b>Shirt</b><small>Types: {SHIRT_GARMENT_CATEGORY.typeExamples.slice(0,6).join(" · ")}</small><small>Details: {SHIRT_GARMENT_CATEGORY.detailFamilies.join(" · ")}</small></div>
      <label><span>Shirt fabric</span><select value={shirtId} onChange={(event)=>{beginFabricInteraction();setShirtId(event.target.value);}}>{shirtFabrics.map((fabric)=><option key={fabric.id} value={fabric.id}>{fabric.name} · {fabric.line}</option>)}</select></label>
      <div className="garmentSwatchPreview">{shirt&&<><img src={shirt.image} alt="" /><span><b>{shirt.name}</b><small>{shirt.line}</small><small className="garmentDrapeMeta">Drape appearance · {fabricDrapeSurface(shirt).category}{fabricDrapeSurface(shirt).evidence==="gsm_estimated"?" (GSM estimate)":""}{shirt.weightGsm ? " · "+shirt.weightGsm+" GSM" : ""}{shirt.weave ? " · "+shirt.weave : ""}</small><em data-calibrated={Boolean(shirtMeasuredTileMm)}>{shirtMeasuredTileMm?`Calibrated tile · ${shirtMeasuredTileMm.toFixed(1)} mm`:`Approximate tile · ${shirtManualTileMm} mm`}</em></span></>}</div>
      {!shirtMeasuredTileMm&&<label className="garmentRange"><span>Approx. shirt tile width <b>{shirtManualTileMm} mm</b></span><input type="range" min="30" max="260" step="5" value={shirtManualTileMm} onChange={(event)=>setShirtManualTileMm(Number(event.target.value))}/><small>Temporary only until owner/supplier physical scale is verified.</small></label>}

      <div className="garmentCurrentType"><span>ACTIVE GARMENT</span><b>Trouser</b><small>Types: {TROUSER_GARMENT_CATEGORY.typeExamples.slice(0,6).join(" · ")}</small><small>Details: {TROUSER_GARMENT_CATEGORY.detailFamilies.join(" · ")}</small></div>
      <label><span>Trouser fabric</span><select value={trouserId} onChange={(event)=>{beginFabricInteraction();setTrouserId(event.target.value);}}>{trouserFabrics.map((fabric)=><option key={fabric.id} value={fabric.id}>{fabric.name} · {fabric.line}</option>)}</select></label>
      <div className="garmentSwatchPreview">{trouser&&<><img src={trouser.image} alt="" /><span><b>{trouser.name}</b><small>{trouser.line}</small><small className="garmentDrapeMeta">Drape appearance · {fabricDrapeSurface(trouser).category}{fabricDrapeSurface(trouser).evidence==="gsm_estimated"?" (GSM estimate)":""}{trouser.weightGsm ? " · "+trouser.weightGsm+" GSM" : ""}{trouser.weave ? " · "+trouser.weave : ""}</small><em data-calibrated={Boolean(trouserMeasuredTileMm)}>{trouserMeasuredTileMm?`Calibrated tile · ${trouserMeasuredTileMm.toFixed(1)} mm`:`Approximate tile · ${trouserManualTileMm} mm`}</em></span></>}</div>
      {!trouserMeasuredTileMm&&<label className="garmentRange"><span>Approx. trouser tile width <b>{trouserManualTileMm} mm</b></span><input type="range" min="30" max="260" step="5" value={trouserManualTileMm} onChange={(event)=>setTrouserManualTileMm(Number(event.target.value))}/><small>Temporary only until owner/supplier physical scale is verified.</small></label>}

      <label className="garmentRange"><span>Surface roughness base <b>{roughness.toFixed(2)}</b></span><input type="range" min=".55" max=".98" step=".01" value={roughness} onChange={(event)=>setRoughness(Number(event.target.value))}/><small>Surface-only visual approximation: declared drape or conservative weight estimates adjust linen normals and roughness. Physical fold shape still requires fitting and review.</small></label>

      <div className="garmentViewerFacts">
        <span><small>MODEL</small><b>{modelContract?.readiness==="contract_ready"&&productionManifestReady?"M7.46 Tailoring GLB":"Reusable GLB"}</b></span>
        <span><small>FABRIC</small><b>Panel-scaled PBR + variants</b></span>
        <span><small>VIEWS</small><b>4 fixed + free</b></span>
        <span><small>AI CREDITS</small><b>0</b></span>
      </div>
      <p className="garmentViewerGuardrail">{modelContract?.readiness==="contract_failed" ? `Model contract blocked: ${modelContract.reasons.join(" ")}` : modelSrc&&!productionManifestReady ? `Model manifest blocked: ${(modelManifestValidation?.reasons||["Manifest verification is pending."]).join(" ")}` : modelContract?.readiness==="contract_ready" ? "Live Designer reference and measured proportions are locked, but visual identity equivalence is unverified: this 3D candidate carries a researched tailoring library covering shirt type/fit/tuck/sleeve/collar construction/cuff/placket/pocket/yoke/back/hem and trouser type/fit/low-to-extra-high rise/front-flat waist/back-seat shaping/seat-crotch transition/pleat direction/360° waistband hardware/break/360° turn-up/hip-wrapped pockets. Fabric remains panel-scaled and non-metallic; declared drape or clearly estimated weight metadata changes surface normal response and roughness without AI credits; this is not a physical cloth simulation." : "Fallback prototype is active. Production should use the identity-locked M7.3 tailoring model before fabric/drape work continues."}</p>
    </aside>
  </section>;
}
