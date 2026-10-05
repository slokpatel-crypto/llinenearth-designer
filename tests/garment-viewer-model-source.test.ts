import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("realistic model source plan stays aligned with the production GarmentViewer contract",()=>{
  const plan=readFileSync("docs/REALISTIC_MODEL_SOURCE_PLAN.md","utf8");
  const exporter=readFileSync("scripts/blender/export-linen-earth-officewear.py","utf8");
  for(const token of [
    "Blender Human Base Meshes",
    "MakeHuman / MPFB",
    "ShirtTorsoFabric",
    "TrouserLegRFabric",
    "1727 mm",
    "npm run garment:model-check",
  ]) assert(plan.includes(token),token);
  for(const token of [
    "LinenEarthExport",
    "REFERENCE_HEIGHT_M = 1.727",
    "ShirtTorsoFabric",
    "TrouserLegRFabric",
    "export_scene.gltf",
    "export_format=\"GLB\"",
  ]) assert(exporter.includes(token),token);
});

test("Blender exporter refuses silent body scaling and requires garment UVs",()=>{
  const exporter=readFileSync("scripts/blender/export-linen-earth-officewear.py","utf8");
  assert(exporter.includes("Adjust the body intentionally before export rather than auto-scaling"));
  assert(exporter.includes("needs a UV map before export"));
  assert(exporter.includes("obj.data.materials.clear()"));
});
\ntest("Blender base source bootstrap stays pinned, licensed and non-promotional",()=>{\n  const bootstrap=readFileSync("scripts/blender/bootstrap-human-base-meshes.py","utf8");\n  const packageJson=readFileSync("package.json","utf8");\n  for(const token of [\n    'BUNDLE_VERSION = "1.4.1"',\n    'BUNDLE_LICENSE = "CC0"',\n    "human-base-meshes-bundle-v1.4.1.zip",\n    "EXPECTED_ARCHIVE_BYTES = 50_643_039",\n    "safe_extract",\n    "source-library-only-not-production-model",\n  ]) assert(bootstrap.includes(token),token);\n  assert(packageJson.includes('"garment:model-base:fetch"'));\n});\n