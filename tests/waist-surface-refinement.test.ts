import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("only the real trouser waist receives non-smoothing topology refinement before body clearance",()=>{
  const file=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  const pipeline=file.slice(file.indexOf("def fit_shell("),file.indexOf("def planar_grain_uv("));
  const smooth=pipeline.indexOf("apply_modifier(obj, smooth)");
  const region=pipeline.indexOf('if obj.name == "TrouserWaistFabric" and waist_refinement_level == 1:');
  const simple=pipeline.indexOf('refine.subdivision_type = "SIMPLE"');
  const oneLevel=pipeline.indexOf("refine.levels = 1");
  const refineApplied=pipeline.indexOf("apply_modifier(obj, refine)");
  const shrink=pipeline.indexOf('shrink = obj.modifiers.new("LE_BODY_CLEARANCE"');
  const solid=pipeline.indexOf('solid = obj.modifiers.new("LE_CLOTH_THICKNESS"');
  assert.ok(smooth>=0&&region>smooth&&simple>region&&oneLevel>simple&&
    refineApplied>oneLevel&&shrink>refineApplied&&solid>shrink,
    "real waist refinement must follow smoothing and precede unchanged body clearance");
  assert.ok(pipeline.includes('shrink.wrap_method = "NEAREST_SURFACEPOINT"'));
  assert.ok(pipeline.includes('shrink.wrap_mode = "OUTSIDE_SURFACE"'));
  assert.ok(pipeline.includes("shrink.offset = clearance_m"));
  assert.ok(pipeline.includes("solid.thickness = thickness_m"));
  assert.ok(pipeline.includes("solid.offset = 1.0"));
  assert.ok(pipeline.includes("solid.use_rim = True"));
  assert.equal((pipeline.match(/"LE_WAIST_SURFACE_REFINEMENT"/g)||[]).length,1);
  assert.ok(file.includes("--experimental-waist-refinement-level"),"native control must be explicit");
  assert.ok(file.includes("default=1"),"refined candidate must be the standard mode");
  assert.ok(file.includes('"linen_earth_trouser_waist_refinement_level"'),"control provenance must be saved");
  assert.ok(file.includes("safe_candidate_output(options.output, bpy.data.filepath)"),
    "original body source asset must remain protected");
});
