import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("shirt waist follows photo guide while all real fit gates remain mandatory",()=>{
  const author=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  assert.match(author,/def shirt_torso_half_width_at_height\(height_z, waist_guide_z, shoulder_guide_z\):/);
  assert.match(author,/return 0\.159 \+ \(0\.245 - 0\.159\) \* smooth/);
  assert.match(author,/shirt_torso_half_width_at_height\(p\.z, shirt_waist_guide_z, shirt_shoulder_guide_z\)/);
  assert.ok(author.includes('locked_guide_height(bpy.context.scene, "LE_GUIDE_SHIRT_WAIST")'));
  assert.ok(author.includes('locked_guide_height(bpy.context.scene, "LE_GUIDE_SHIRT_SHOULDER")'));
  assert.ok(author.includes("safe_candidate_output(options.output, bpy.data.filepath)"));
  const preflight=readFileSync("scripts/blender/preflight-linen-earth-officewear.py","utf8");
  assert.ok(preflight.includes('("shirtWaistWidthMm", "ShirtTorsoFabric"'));
  assert.ok(preflight.includes("elif count > allowed_pairs:"));
  assert.ok(preflight.includes("elif tuck_overlap > 120:"));
  assert.ok(preflight.includes('"ready": len(reasons) == 0'));
  const native=readFileSync("tests/blender/test_shirt_torso_photo_taper.py","utf8");
  assert.match(native,/TITAN_NATIVE_PHOTO_GUIDED_TORSO_WAIST_TAPER_PASSED/);
});
