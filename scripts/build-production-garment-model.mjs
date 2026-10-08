#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { promoteValidatedGarmentCandidate } from "./production-garment-export-transaction.mjs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const scene=String(process.env.LINEN_GARMENT_BLEND||"").trim();
const panelSpec=String(process.env.LINEN_GARMENT_PANEL_SPEC||"").trim();
const output=String(process.env.LINEN_GARMENT_OUTPUT||".cache/linen-earth/candidates/linen-earth-officewear-v1.glb").trim();

function fail(message){
  console.error("Production GarmentViewer build failed: "+message);
  process.exit(1);
}
function requireFile(label,value){
  if(!value) fail(label+" is required.");
  const resolved=path.resolve(value);
  if(!existsSync(resolved)) fail(label+" does not exist: "+resolved);
  return resolved;
}
function run(command,args,extraEnv={}){
  const result=spawnSync(command,args,{stdio:"inherit",env:{...process.env,...extraEnv}});
  if(result.error) throw new Error(command+" could not start: "+result.error.message);
  if(result.status!==0) throw new Error(command+" exited with status "+(result.status??"signal "+result.signal)+".");
}

const scenePath=requireFile("LINEN_GARMENT_BLEND",scene);
const panelSpecPath=requireFile("LINEN_GARMENT_PANEL_SPEC",panelSpec);
const outputPath=path.resolve(output);
const exporter=path.resolve("scripts/blender/export-linen-earth-officewear.py");
if(!existsSync(exporter)) fail("Blender exporter is missing: "+exporter);

// The customer-facing GLB and .viewer.json must never be overwritten by a
// failed Blender run or by a candidate that fails strict contract checks.
mkdirSync(path.dirname(outputPath),{recursive:true});
const stageDir=mkdtempSync(path.join(path.dirname(outputPath),".garment-stage-"));
const stagedModelPath=path.join(stageDir,path.basename(outputPath));
let preserveRecoveryFiles=false;
try {
  run("blender",[
    "--background",scenePath,
    "--python-exit-code","1",
    "--python",exporter,
    "--",
    "--output",stagedModelPath,
    "--panel-spec",panelSpecPath,
  ]);

  run(process.execPath,[
    "--experimental-strip-types",
    path.resolve("scripts/check-garment-viewer-model.mjs"),
    stagedModelPath,
  ],{LINEN_GARMENT_REQUIRE_PRODUCTION:"true"});

  promoteValidatedGarmentCandidate(stagedModelPath,outputPath);
  console.log("Production GarmentViewer candidate passed export + strict realistic-production validation: "+outputPath);
  console.log("Customer promotion still requires physical scale, latency, realism and boundary evidence.");
} catch(error) {
  preserveRecoveryFiles=error instanceof AggregateError;
  console.error("Production GarmentViewer build failed: "+(error instanceof Error?error.message:String(error)));
  if(preserveRecoveryFiles) console.error("Recovery backups have been kept for manual inspection: "+stageDir);
  process.exitCode=1;
} finally {
  if(!preserveRecoveryFiles) rmSync(stageDir,{recursive:true,force:true});
}
