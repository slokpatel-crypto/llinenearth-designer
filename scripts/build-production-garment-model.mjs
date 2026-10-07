#!/usr/bin/env node
import { existsSync } from "node:fs";
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
  if(result.error) fail(command+" could not start: "+result.error.message);
  if(result.status!==0) fail(command+" exited with status "+result.status+".");
}

const scenePath=requireFile("LINEN_GARMENT_BLEND",scene);
const panelSpecPath=requireFile("LINEN_GARMENT_PANEL_SPEC",panelSpec);
const outputPath=path.resolve(output);
const exporter=path.resolve("scripts/blender/export-linen-earth-officewear.py");
if(!existsSync(exporter)) fail("Blender exporter is missing: "+exporter);

run("blender",[
  "--background",scenePath,
  "--python",exporter,
  "--",
  "--output",outputPath,
  "--panel-spec",panelSpecPath,
]);

run(process.execPath,[
  "--experimental-strip-types",
  path.resolve("scripts/check-garment-viewer-model.mjs"),
  outputPath,
],{LINEN_GARMENT_REQUIRE_PRODUCTION:"true"});

console.log("Production GarmentViewer candidate passed export + strict realistic-production validation: "+outputPath);
console.log("Customer promotion still requires physical scale, latency, realism and boundary evidence.");
