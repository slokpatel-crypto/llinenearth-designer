import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("garment authoring never silently clamps operator-supplied physical dimensions",()=>{
  const source=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  assert.match(source,/def bounded_measured_mm\(value, field, minimum_mm, maximum_mm\):/);
  assert.match(source,/not math\.isfinite\(value\) or not minimum_mm <= value <= maximum_mm/);
  const main=source.slice(source.indexOf("def main():"));
  const validation=main.indexOf("bounded_measured_mm(options.clearance_mm");
  const validationThickness=main.indexOf("bounded_measured_mm(options.thickness_mm");
  const firstSceneLookup=main.indexOf("bpy.data.objects.get(options.body)");
  const firstMutation=main.indexOf("remove_existing(name)");
  assert.ok(validation>=0 && validationThickness>validation);
  assert.ok(firstSceneLookup>validationThickness&&firstMutation>firstSceneLookup,
    "validate dimensions before accessing and mutating source scene");
  assert.match(main,/bounded_measured_mm\(options.clearance_mm, "Body clearance", 3\.0, 18\.0\)/);
  assert.match(main,/bounded_measured_mm\(options.thickness_mm, "Cloth shell thickness", 0\.6, 4\.0\)/);
  assert.doesNotMatch(main,/max\(0\.003, min\(0\.018/);
  assert.doesNotMatch(main,/max\(0\.0006, min\(0\.004/);
  const native=readFileSync("tests/blender/test_authoring_parameters.py","utf8");
  assert.match(native,/author\.bounded_measured_mm/);
  assert.match(native,/float\("nan"\), float\("inf"\)/);
});
