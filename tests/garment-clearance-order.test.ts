import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("garment body clearance is applied AFTER all geometry-smoothing passes",()=>{
  const author=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  const routine=author.slice(author.indexOf("def fit_shell("),author.indexOf("def planar_grain_uv("));
  const smooth=routine.indexOf('smooth = obj.modifiers.new("LE_GARMENT_SMOOTH"');
  const smoothApply=routine.indexOf('apply_modifier(obj, smooth)');
  const shrink=routine.indexOf('shrink = obj.modifiers.new("LE_BODY_CLEARANCE"');
  const shrinkApply=routine.indexOf('apply_modifier(obj, shrink)');
  const solid=routine.indexOf('solid = obj.modifiers.new("LE_CLOTH_THICKNESS"');
  assert.ok(smooth>=0&&smoothApply>smooth&&shrink>smoothApply&&shrinkApply>shrink&&solid>shrinkApply,
    "never smooth the cloth after final body clearance; inspect native collision counts");
  assert.ok(routine.includes('shrink.wrap_mode = "OUTSIDE_SURFACE"'));
  assert.ok(routine.includes('effective_clearance = clearance_m + ('),
    "clearance must use the original source body base");
  assert.ok(routine.includes('waist_extra_m if obj.name == "TrouserWaistFabric"'),
    "only the approved waistband gets its 3mm default extra");
  assert.ok(routine.includes('leg_extra_m if obj.name in ("TrouserLegLFabric", "TrouserLegRFabric")'),
    "only two real leg shells can get optional native experimental clearance");
  assert.ok(routine.includes('else 0.0'),
    "shirt torso and both sleeves must retain the unchanged base clearance");
  assert.ok(routine.includes('shrink.offset = effective_clearance'),
    "the real waist-only extra clearance must be applied after smoothing");
  assert.ok(author.includes('"Experimental extra waistband layering clearance", 0.0, 9.0'),
    "extra waist clearance remains strictly bounded");
  assert.ok(author.includes('clearance_m + waist_extra_m > 0.018'),
    "never exceed the original 18mm total body-clearance limit");
  assert.ok(routine.includes('solid.thickness = thickness_m'));
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  assert.ok(workflow.includes("scripts/blender/author-linen-earth-officewear.py"));
  assert.ok(workflow.includes("scripts/blender/preflight-linen-earth-officewear.py"));
  assert.ok(workflow.includes("summarize-native-candidate-preflight.py"),
    "genuine source-model collision evidence must remain mandatory");
});
