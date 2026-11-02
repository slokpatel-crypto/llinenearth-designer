import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("native scene preflight serializes all six evaluated physical garment panels",()=>{
  const code=readFileSync("scripts/blender/preflight-linen-earth-officewear.py","utf8");
  const panelLoop=code.slice(
    code.indexOf("    for name in GARMENT_OBJECTS:"),
    code.indexOf("    if total_triangles > MAX_TOTAL_TRIANGLES:")
  );
  const stats=panelLoop.indexOf("entry.update(stats)");
  const assigned=panelLoop.lastIndexOf("objects[name] = entry");
  assert.ok(stats>0&&assigned>stats,
    "valid mesh report must persist evaluated vertices, triangles, UV and transform data");
  assert.ok(panelLoop.includes('entry["transformApplied"] = transform_ready(obj)'));
  assert.ok(panelLoop.includes('entry["materials"] = material_slot_names(obj)'));
  const result=code.slice(code.indexOf('    report = {'));
  assert.ok(result.includes('"objects": objects'),
    "persisted panel metrics must flow to serialized preflight JSON");
  assert.ok(result.includes('"ready": len(reasons) == 0'),
    "do not weaken any production acceptance requirements");
  for(const required of [
    '"uvNonFiniteTriangles": uv_nonfinite',
    '"uvCollapsedTriangles": uv_collapsed',
    '"uvLayers": uv_layers',
    '"triangles": triangles',
  ]) assert.ok(code.includes(required),required);
});
