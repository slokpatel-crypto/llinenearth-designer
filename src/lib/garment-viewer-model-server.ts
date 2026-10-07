import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  approvedGarmentViewerManifestSource,
  approvedGarmentViewerModelSource,
  validateGarmentViewerModelManifest,
  type GarmentViewerModelManifest,
} from "@/lib/garment-viewer-model-contract";
import { inspectGarmentViewerGlb } from "@/lib/garment-viewer-glb";

export const GARMENT_VIEWER_PRODUCTION_MODEL_ID="LE-OFFICEWEAR-V1";
export const GARMENT_VIEWER_DEFAULT_MODEL_SRC="/models/linen-earth-officewear-v1.glb";

function publicAssetPath(source:string){
  const relative=source.replace(/\?.*$/,"").replace(/^\/+/,"");
  const root=path.resolve(process.cwd(),"public");
  const resolved=path.resolve(root,relative);
  if(!resolved.startsWith(root+path.sep)) throw new Error("GarmentViewer asset escaped public root.");
  return resolved;
}

export async function loadGarmentViewerProductionAssetStatus(){
  const modelSrc=approvedGarmentViewerModelSource(process.env.LINEN_GARMENT_MODEL_SRC || GARMENT_VIEWER_DEFAULT_MODEL_SRC);
  const manifestSrc=approvedGarmentViewerManifestSource(modelSrc);
  if(!modelSrc||!manifestSrc){
    return {
      configured:false as const,
      modelId:GARMENT_VIEWER_PRODUCTION_MODEL_ID,
      modelSrc:null,
      manifestSrc:null,
      model:null,
      manifest:null,
      assetReady:false,
      productionCandidateReady:false,
      assetIdentity:null,
      reasons:["No Linen Earth production GLB is available."],
    };
  }

  const reasons:string[]=[];
  let model:ReturnType<typeof inspectGarmentViewerGlb>|null=null;
  let manifest:ReturnType<typeof validateGarmentViewerModelManifest>|null=null;
  let modelSha256:string|null=null;
  let manifestSha256:string|null=null;
  try{
    const bytes=new Uint8Array(await readFile(publicAssetPath(modelSrc)));
    modelSha256=createHash("sha256").update(bytes).digest("hex");
    model=inspectGarmentViewerGlb(bytes,GARMENT_VIEWER_PRODUCTION_MODEL_ID);
    if(!model.structuralReady) reasons.push(...model.reasons);
  }catch(error){
    reasons.push(error instanceof Error ? "GLB: "+error.message : "GLB could not be inspected.");
  }

  try{
    const manifestText=await readFile(publicAssetPath(manifestSrc),"utf8");
    manifestSha256=createHash("sha256").update(manifestText).digest("hex");
    const raw=JSON.parse(manifestText) as GarmentViewerModelManifest;
    manifest=validateGarmentViewerModelManifest(raw,GARMENT_VIEWER_PRODUCTION_MODEL_ID);
    if(!manifest.valid) reasons.push(...manifest.reasons);
  }catch(error){
    reasons.push(error instanceof Error ? "Manifest: "+error.message : "Manifest could not be inspected.");
  }

  const assetReady=Boolean(model?.structuralReady&&manifest?.valid&&modelSha256&&manifestSha256);
  const productionCandidateReady=Boolean(assetReady&&manifest?.productionAssetReady===true);
  const assetIdentity=assetReady ? {modelId:GARMENT_VIEWER_PRODUCTION_MODEL_ID,modelSha256:modelSha256 as string,manifestSha256:manifestSha256 as string} : null;
  return {
    configured:true as const,
    modelId:GARMENT_VIEWER_PRODUCTION_MODEL_ID,
    modelSrc,
    manifestSrc,
    model,
    manifest,
    assetReady,
    productionCandidateReady,
    assetIdentity,
    reasons:[...new Set(reasons)],
  };
}
