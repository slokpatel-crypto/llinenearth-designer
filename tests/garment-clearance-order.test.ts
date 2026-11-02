import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("garment authoring keeps the native-measured lower-collision order",()=>{
  const author=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  const routine=author.slice(author.indexOf("def fit_shell("),author.indexOf("def planar_grain_uv("));
  const smooth=routine.indexOf('smooth = obj.modifiers.new("LE_GARMENT_SMOOTH"');
  const smoothApply=routine.indexOf('apply_modifier(obj, smooth)');
  const shrink=routine.indexOf('shrink = obj.modifiers.new("LE_BODY_CLEARANCE"');
  const shrinkApply=routine.indexOf('apply_modifier(obj, shrink)');
  const solid=routine.indexOf('solid = obj.modifiers.new("LE_CLOTH_THICKNESS"');
  assert.ok(shrink>=0&&shrinkApply>shrink&&smooth>shrinkApply&&smoothApply>smooth&&solid>smoothApply,
    "the opposite modifier order increases real CC0 tucked-waist crossings; compare native collision evidence");
  assert.ok(routine.includes('shrink.wrap_mode = "OUTSIDE_SURFACE"'));
  assert.ok(routine.includes('shrink.offset = clearance_m'));
  assert.ok(routine.includes('solid.thickness = thickness_m'));
  assert.ok(author.includes("trouser_waist_upper_z"),"do not regress measured photo waist coverage");
  assert.ok(author.includes("safe_candidate_output(options.output, bpy.data.filepath)"),"source must remain safe");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  assert.ok(workflow.includes("scripts/blender/author-linen-earth-officewear.py"));
  assert.ok(workflow.includes("scripts/blender/preflight-linen-earth-officewear.py"));
  assert.ok(workflow.includes("summarize-native-candidate-preflight.py"),
    "genuine source-model collision evidence must remain mandatory");
});
