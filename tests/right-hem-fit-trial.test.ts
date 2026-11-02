import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("native right-hem taper is optional, guide-based, bounded and remains a full physical fit trial",()=>{
  const author=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  assert.ok(author.includes('"--experimental-right-hem-taper-mm", type=float, default=5.0'),
    "candidate must use measured 5mm real source while explicit no-taper control is preserved");
  assert.ok(author.includes('locked_guide_height(bpy.context.scene, "LE_GUIDE_RIGHT_HEM")'));
  assert.ok(author.includes('measure_guided_right_hem_taper(obj, right_hem_guide_z, right_hem_taper_mm)'));
  assert.ok(author.includes('if name == "TrouserLegRFabric":'));
  assert.ok(author.includes('not 0 <= right_hem_taper_mm <= 8'));
  assert.ok(author.includes('if abs(p.z - guide_z) <= 0.028'));
  assert.ok(author.includes('safe_candidate_output(options.output, bpy.data.filepath)'));
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  assert.ok(workflow.includes('--experimental-right-hem-taper-mm 0.0'),"retain original 0mm source control");
  assert.ok(workflow.includes('assert standard["rejectionReasonCount"] == 10'),"keep exact ten original hard defects");
  assert.ok(workflow.includes('assert evidence["rejectionReasonCount"] <= 10'),"all native gates remain active");

  for(const lockedGate of [
    "TITAN_REAL_RIGHT_HEM_TAPER_NATIVE_FIT_VALIDATED_CANDIDATE_ONLY",
    'assert trial["rejectionReasonCount"] <= baseline["rejectionReasonCount"] - 1',
    'assert trial["boundaryIntersections"][key] <= original',
    'assert trial["identityFitMeasurementsMm"][key] == original',
    'assert trial_width < original_width',
  ]){
    assert.ok(workflow.includes(lockedGate),lockedGate);
  }
});
