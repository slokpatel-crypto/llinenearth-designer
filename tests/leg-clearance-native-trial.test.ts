import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("real leg clearance trials keep standard candidate intact and full native physical gates",()=>{
  const author=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  assert.ok(author.includes('"--experimental-leg-extra-clearance-mm", type=float, default=0.0'),
    "standard five-panel clearance and both leg meshes must remain unmodified");
  assert.ok(author.includes('"Experimental extra leg body clearance", 0.0, 6.0'));
  assert.ok(author.includes("clearance_m + leg_extra_m > 0.018"),"do not exceed original absolute clearance limit");
  assert.ok(author.includes('obj.name in ("TrouserLegLFabric", "TrouserLegRFabric")'));
  assert.ok(author.includes("shrink.offset = effective_clearance"),"same real body projection, no bypass");
  assert.ok(author.includes('obj["linen_earth_fit_clearance_mm"] = round(actual_clearance * 1000.0, 3)'));
  assert.ok(author.includes("safe_candidate_output(options.output, bpy.data.filepath)"));
  for(const pattern of [
    "for extra in 3 6; do",
    "--experimental-leg-extra-clearance-mm",
    'assert baseline["rejectionReasonCount"] == 10',
    'assert original["garmentLegToLeg"] == 89',
    'assert original["bodyTrouserLegL"] == 336',
    'assert original["bodyTrouserLegR"] == 358',
    'assert trial["preflightReady"] is False',
    '"contactRegressions": regressions',
    '"safeToAutoPromote": False',
    "TITAN_REAL_LEG_CLEARANCE_NATIVE_TRIALS_MEASURED_NO_AUTO_PROMOTION",
  ]){
    assert.ok(workflow.includes(pattern),pattern);
  }
});
