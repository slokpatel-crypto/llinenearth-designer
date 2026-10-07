import fs from "node:fs/promises";
import path from "node:path";
import { inspectGarmentViewerGlb } from "../src/lib/garment-viewer-glb.ts";
import {
  GARMENT_VIEWER_CONTRACT_VERSION,
  validateGarmentViewerModelManifest,
} from "../src/lib/garment-viewer-model-contract.ts";

const modelPath=process.argv[2];
const manifestArg=process.argv[3];
if(!modelPath){
  console.error("Usage: npm run garment:model-check -- public/models/model.glb [public/models/model.viewer.json]");
  process.exit(2);
}
const absoluteModel=path.resolve(modelPath);
const manifestPath=manifestArg
  ? path.resolve(manifestArg)
  : absoluteModel.replace(/\.glb$/i,".viewer.json");
const modelId=process.env.LINEN_GARMENT_MODEL_ID || "LE-OFFICEWEAR-V1";
const requireProduction=["1","true","yes"].includes(String(process.env.LINEN_GARMENT_REQUIRE_PRODUCTION||"").toLowerCase());

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
  const productionReady=manifest?.productionAssetReady===true;
  const ready=model.structuralReady&&manifest.valid&&(!requireProduction||productionReady);
  console.log(JSON.stringify({
    version:GARMENT_VIEWER_CONTRACT_VERSION,
    modelPath:absoluteModel,
    manifestPath,
    modelId,
    requireProduction,
    productionReady,
    ready,
    model,
    manifest,
  },null,2));
  if(!ready) process.exitCode=1;
}catch(error){
  console.error(error instanceof Error?error.stack||error.message:String(error));
  process.exitCode=1;
}
