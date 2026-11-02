import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("experimental inner-leg seam displacement must not affect original candidate or safety gates",()=>{
  const author=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  assert.ok(author.includes('"--experimental-inner-leg-seam-gap-mm", type=float, default=0.0'),
    "real production candidate must retain original leg geometry");
  assert.ok(author.includes('not 0 <= leg_seam_gap_mm <= 6'),"trials must be physically bounded");
  assert.ok(author.includes('if obj.name not in ("TrouserLegLFabric", "TrouserLegRFabric") or gap_mm == 0'));
  assert.ok(author.includes('trial_inner_leg_seam_separation('));
  assert.ok(author.includes('obj, center_x, min_z, height, leg_seam_gap_mm,'));
  assert.ok(author.includes('body, clearance_m, options.experimental_inner_leg_seam_reproject'),
    "trial must explicitly retain true source-body clearance and never change the default");
  assert.ok(author.includes('sign = -1.0 if obj.name == "TrouserLegLFabric" else 1.0'));
  assert.ok(author.includes('lower = min_z + height * 0.32'));
  assert.ok(author.includes('upper = min_z + height * 0.54'));
  assert.ok(author.includes("safe_candidate_output(options.output, bpy.data.filepath)"));
  assert.ok(workflow.includes('for seam_gap in 2 4 6; do'));
  assert.ok(workflow.includes('assert standard["rejectionReasonCount"] == 10'));
  assert.ok(workflow.includes('assert standard["boundaryIntersections"]["garmentLegToLeg"] == 89'));
  assert.ok(workflow.includes('assert trial["preflightReady"] is False'));
  assert.ok(workflow.includes('if name not in ("legCenterSpacingMm",)'));
  assert.ok(workflow.includes('"collisionRegressions": increased'));
  assert.ok(workflow.includes('TITAN_REAL_INNER_LEG_TRIAL_EVIDENCE_COMPLETE_NO_AUTO_SELECTION'));
  assert.ok(author.includes('"--experimental-inner-leg-seam-reproject", action="store_true"'));
  assert.ok(author.includes("if options.experimental_inner_leg_seam_reproject and options.experimental_inner_leg_seam_gap_mm == 0"));
  assert.ok(author.includes('group = obj.vertex_groups.new(name="LE_UNSAVED_MOVED_CROTCH_ONLY")'));
  assert.ok(author.includes('reprojection.wrap_mode = "OUTSIDE_SURFACE"'));
  assert.ok(author.includes('reprojection.offset = clearance_m'));
  assert.ok(workflow.includes('TITAN_INNER_SEAM_REPROJECTED_CANDIDATE_ONLY_NO_AUTO_SELECTION'));
  assert.ok(workflow.includes('--experimental-inner-leg-seam-reproject'));

});
