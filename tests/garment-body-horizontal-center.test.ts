import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("source body is centered in locked-world guide frame before saving source",()=>{
  const code=readFileSync("scripts/blender/prepare-linen-earth-body.py","utf8");
  for(const token of [
    "def normalize_horizontal_center(objects, body):",
    "points = world_bounds(body)",
    "roots = [",
    "obj.parent is None or obj.parent.as_pointer() not in selected",
    "obj.matrix_world = transform",
    "body_source_center_xy = normalize_horizontal_center(objects, body)",
  ]) assert.ok(code.includes(token),token);
  const main=code.slice(code.indexOf("def main():"));
  const normalize=main.indexOf("body_source_center_xy = normalize_horizontal_center(objects, body)");
  const guides=main.indexOf("create_identity_guides(identity_spec)");
  const save=main.indexOf("bpy.ops.wm.save_as_mainfile");
  assert.ok(normalize>=0&&guides>normalize&&save>guides,
    "body must share guide coordinate system before source .blend is saved");
  const native=readFileSync("tests/blender/test_body_world_centering.py","utf8");
  assert.match(native,/mod\.normalize_horizontal_center\(\[parent, body, independent\], body\)/);
  assert.match(native,/relative_before/);
  assert.match(native,/size_before = bounds\(body\)/);
});
