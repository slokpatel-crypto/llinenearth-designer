import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

test("Blender author and preflight both use the same exact triangle-section dimensions", () => {
  for (const path of [
    "scripts/blender/author-linen-earth-officewear.py",
    "scripts/blender/preflight-linen-earth-officewear.py",
  ]) {
    const source = readFileSync(path,"utf8");
    assert.match(source,/from section_geometry import triangle_section_x_span/,path);
    assert.match(source,/mesh\.calc_loop_triangles\(\)/,path);
    assert.match(source,/return triangle_section_x_span\(triangles, z_world\)/,path);
  }
});

test("pure Blender geometry sections survive sparse rings and reject missing measurements", () => {
  const result = spawnSync("python3",[
    "-m","unittest","discover","-s","tests","-p","test_blender_section_geometry.py","-v",
  ],{encoding:"utf8",timeout:30_000});
  assert.equal(result.status,0,"Geometry unit tests failed:\n"+result.stdout+"\n"+result.stderr);
});

test("tailoring library uses one locked human BVH across all variant repairs", () => {
  const source = readFileSync("scripts/garment-import-tailoring-library.py","utf8");
  const loop = source.slice(source.indexOf("collection = ensure_export_collection()",source.indexOf("def main():")));
  assert.match(loop,/body_tree = world_bvh\(body\)/);
  assert.match(loop,/body_orientation = normal_orientation\(body\)/);
  assert.match(loop,/repair_variant_outside_body\(\s*obj, body, clearance, body_tree, body_orientation/);
  assert.match(source,/raise RuntimeError\("Locked body collision tree could not be built\."\)/);
  assert.match(source,/raise RuntimeError\("Locked body BVH is unavailable; cannot certify tailoring clearance\."\)/);
});
