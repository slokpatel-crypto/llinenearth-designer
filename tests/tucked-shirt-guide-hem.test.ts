import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("real tucked shirt hem follows both photographic waist landmarks",()=>{
  const author=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  assert.ok(author.includes('locked_guide_height(bpy.context.scene, "LE_GUIDE_SHIRT_WAIST")'));
  assert.ok(author.includes('locked_guide_height(bpy.context.scene, "LE_GUIDE_TROUSER_WAIST")'));
  assert.ok(author.includes("abs(shirt_waist_guide_z - trouser_waist_guide_z) > 0.050"));
  assert.ok(author.includes("tucked_shirt_hem_z = min(shirt_waist_guide_z, trouser_waist_guide_z) - 0.030"),
    "Never replace real waist-guide anchoring with an unrelated body-height guess");
  assert.ok(author.includes('"ShirtTorsoFabric": lambda p: tucked_shirt_hem_z <= p.z'),
    "Tucked shirt must use measured hem geometry");
  assert.ok(author.includes('"linen_earth_tucked_shirt_hem_z_m"'));
  assert.ok(author.includes('"linen_earth_locked_shirt_waist_guide_z_m"'));
  assert.ok(!author.includes('"ShirtTorsoFabric": lambda p: z(0.515) <= p.z'),
    "Do not reintroduce a 250mm shirt/trouser double-shell overlap");
  assert.ok(author.includes("safe_candidate_output(options.output, bpy.data.filepath)"));
});
