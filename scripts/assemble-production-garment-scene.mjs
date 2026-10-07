#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const assetRoot=path.resolve(process.env.LINEN_BODY_ASSET_ROOT||".cache/linen-earth/blender-human-base-meshes-v1.4.1");
const provenance=path.join(assetRoot,"linen-earth-source-provenance.json");
const bodyScene=path.resolve(process.env.LINEN_BODY_SCENE||".cache/linen-earth/linen-earth-officewear-body-base.blend");
const authoredScene=path.resolve(process.env.LINEN_AUTHORED_SCENE||".cache/linen-earth/linen-earth-officewear-authored.blend");

function fail(message){
  console.error("Production scene assembly failed: "+message);
  process.exit(1);
}
function run(command,args){
  const result=spawnSync(command,args,{stdio:"inherit",env:process.env});
  if(result.error) fail(command+" could not start: "+result.error.message);
  if(result.status!==0) fail(command+" exited with status "+result.status+".");
}

if(!existsSync(provenance)){
  run(process.env.PYTHON||"python3",[path.resolve("scripts/blender/bootstrap-human-base-meshes.py")]);
}
if(!existsSync(provenance)) fail("Pinned realistic-body source provenance is missing after bootstrap.");

run("blender",[
  "--background","--factory-startup","--python-exit-code","1",
  "--python",path.resolve("scripts/blender/prepare-linen-earth-body.py"),
  "--",
  "--asset-root",assetRoot,
  "--output",bodyScene,
]);

run("blender",[
  "--background",bodyScene,"--python-exit-code","1",
  "--python",path.resolve("scripts/blender/author-linen-earth-officewear.py"),
  "--",
  "--output",authoredScene,
]);

run("blender",[
  "--background",authoredScene,"--python-exit-code","1",
  "--python",path.resolve("scripts/blender/preflight-linen-earth-officewear.py"),
]);

console.log("Production 3D scene candidate assembled and preflight-clean: "+authoredScene);
console.log("Next: visually/tailor review the authored scene, then provide measured panel dimensions to garment:model-production:export.");
