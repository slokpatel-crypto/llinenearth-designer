import fs from "node:fs/promises";
import path from "node:path";
import { standaloneGarmentModelCheckStatus } from "./garment-model-check-status.mjs";
import { inspectGarmentViewerGlb } from "../src/lib/garment-viewer-glb.ts";
import {
  GARMENT_VIEWER_CONTRACT_VERSION,
  validateGarmentViewerModelManifest,
} from "../src/lib/garment-viewer-model-contract.ts";

const candidateMode=process.argv.includes("--candidate");
const args=process.argv.slice(2).filter((arg)=>arg!=="--candidate");
const modelPath=args[0];
const manifestArg=args[1];
if(!modelPath){
  console.error("Usage: npm run garment:model-check -- public/models/model.glb [public/models/model.viewer.json]");
  process.exit(2);
}
const absoluteModel=path.resolve(modelPath);
const manifestPath=manifestArg
  ? path.resolve(manifestArg)
  : absoluteModel.replace(/\.glb$/i,".viewer.json");
const modelId=process.env.LINEN_GARMENT_MODEL_ID || "LE-OFFICEWEAR-V1";

try{
  const bytes=new Uint8Array(await fs.readFile(absoluteModel));
  const model=inspectGarmentViewerGlb(bytes,modelId);
  let manifest=null;
  try{
    const raw=JSON.parse(await fs.readFile(manifestPath,"utf8"));
    manifest=validateGarmentViewerModelManifest(raw,modelId);
  }catch(error){
    manifest={
      valid:false,
      sourceReady:false,
      source:null,
      missingPanels:[],
      invalidPanels:[],
      reasons:[error instanceof Error ? error.message : "Manifest could not be read."],
    };
  }
  // Build-time checks validate the existing M7 procedural tailoring candidate,
  // whereas production export must reject generated/placeholder geometry.
  const candidateReady=model.contract.physicallyScalable && model.uvReady
    && model.selfContained && model.placeholderGeometry && manifest.valid;
  // This CLI only checks structural assets. Independent, asset-bound pattern,
  // latency, boundary, realism and tailor approval is checked elsewhere.
  const {ready,mode,productionApproved,promotionEvidenceEvaluated,pendingPromotionGates} =
    standaloneGarmentModelCheckStatus({
      candidateMode,
      candidateReady,
      structuralReady:model.structuralReady,
      manifestValid:manifest.valid,
    });
  console.log(JSON.stringify({
    version:GARMENT_VIEWER_CONTRACT_VERSION,
    modelPath:absoluteModel,
    manifestPath,
    modelId,
    ready,
    mode,
    productionApproved,
    promotionEvidenceEvaluated,
    pendingPromotionGates,
    model,
    manifest,
  },null,2));
  if(!ready) process.exitCode=1;
}catch(error){
  console.error(error instanceof Error?error.stack||error.message:String(error));
  process.exitCode=1;
}
