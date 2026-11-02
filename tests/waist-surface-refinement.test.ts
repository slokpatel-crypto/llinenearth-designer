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
  assert.ok(pipeline.includes('effective_clearance = clearance_m + (waist_extra_m if obj.name == "TrouserWaistFabric" else 0.0)'));
  assert.ok(pipeline.includes("shrink.offset = effective_clearance"));
  assert.ok(file.includes('default=3.0'),"default candidate must use proven +3mm waist layering");
  assert.ok(file.includes('options.experimental_waist_extra_clearance_mm'));
  assert.ok(file.includes('"Experimental extra waistband layering clearance", 0.0, 9.0'));
  assert.ok(file.includes('clearance_m + waist_extra_m > 0.018'),"experimental trials cannot exceed original 18mm bound");
  assert.ok(file.includes('obj["linen_earth_fit_clearance_mm"] = round(actual_clearance * 1000.0, 3)'));
  const footprint=readFileSync("scripts/blender/measure-waist-tuck-contact.py","utf8");
  assert.ok(footprint.includes('scene.get("linen_earth_garment_clearance_mm")'));
  assert.ok(footprint.includes('scene.get("linen_earth_waist_extra_clearance_mm")'));
  assert.ok(footprint.includes('"waistAbsoluteClearanceMm": round(base_clearance_mm + waist_extra_mm, 3)'));
  assert.ok(!footprint.includes("round(7.0 + waist_extra_mm"),"never label actual clearance from a guessed 7mm default");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  assert.ok(workflow.includes("TITAN_TUCKED_LAYERING_FULL_PHYSICAL_PREFLIGHT_EVIDENCE_VALIDATED"));
  assert.ok(workflow.includes('assert standard["rejectionReasonCount"] == 10'));
  assert.ok(workflow.includes('assert standard["boundaryIntersections"]["shirtTrouserTuck"] == 0'));
  assert.ok(workflow.includes('abs(standard_width - target_waist_width_mm) <= abs(control_width - target_waist_width_mm)'));

  assert.ok(workflow.includes('for extra in 0 6 9; do'),"native CC0 must retain original zero-extra control");
  assert.ok(workflow.includes('--experimental-waist-extra-clearance-mm 0'),"waist baseline must be explicitly pinned");
  assert.ok(workflow.includes('assert control["rejectionReasonCount"] == 11'),
    "native 7mm waist baseline retains its 11 physical blockers with the measured right hem correction");
  assert.ok(workflow.includes('assert standard["rejectionReasonCount"] == 10'),
    "native 10mm waist + right hem default must have exactly ten remaining blockers");
  assert.ok(workflow.includes('assert report["preflightReady"] is False'),"research variants cannot bypass production release gates");
  assert.ok(workflow.includes('assert standard["boundaryIntersections"]["shirtTrouserTuck"] == 0'));
  assert.ok(workflow.includes("TITAN_NATIVE_WAIST_LAYERING_COMPARISONS_VALIDATED_CANDIDATE_ONLY"));

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
