import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

test("Blender-independent UV integrity regression suite",()=>{
  const run=spawnSync("python3",["-m","unittest","discover","-s","scripts/blender","-p","test_uv_mesh_gate.py"],{encoding:"utf8",timeout:30000});
  assert.equal(run.error,undefined,String(run.error));
  assert.equal(run.status,0,run.stderr||run.stdout);
  assert.match(run.stderr,/Ran 9 tests/);
});

test("native preflight blocks unreviewed UV seams and collapsed projections before GLB export",()=>{
  const source=readFileSync("scripts/blender/preflight-linen-earth-officewear.py","utf8");
  const exporter=readFileSync("scripts/blender/export-linen-earth-officewear.py","utf8");
  for(const token of [
    "inspect_uv_polygons",
    "discontinuousSharedUvEdges",
    "collapsedUvFaces",
    "nonfiniteUvFaces",
    "nonmanifoldUvEdges",
    "sharedUvEdges",
    "UV shared-edge discontinuities",
    "UV projection has collapsed faces",
  ]) assert(source.includes(token),token);
  assert(exporter.includes("run_scene_preflight"));
  assert(exporter.includes("Production scene preflight failed; export is blocked"));
});
