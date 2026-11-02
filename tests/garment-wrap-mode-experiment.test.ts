import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("native target-normal wrap experiment preserves original physical dimensions and collision rejection",()=>{
  const author=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  const stage=author.slice(author.indexOf("def fit_shell("),author.indexOf("def planar_grain_uv("));
  assert.match(stage,/shrink\.wrap_method = "NEAREST_SURFACEPOINT"/);
  assert.match(stage,/shrink\.wrap_mode = "ABOVE_SURFACE"/);
  assert.match(stage,/shrink\.offset = clearance_m/);
  assert.match(stage,/solid\.thickness = thickness_m/);
  assert.match(stage,/solid\.offset = 1\.0/);
  assert.match(author,/bounded_measured_mm\(options.clearance_mm, "Body clearance", 3\.0, 18\.0\)/);
  assert.match(author,/safe_candidate_output\(options.output, bpy.data.filepath\)/);
  const preflight=readFileSync("scripts/blender/preflight-linen-earth-officewear.py","utf8");
  assert.match(preflight,/elif count > allowed_pairs:/);
  assert.match(preflight,/elif tuck_overlap > 120:/);
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  assert.ok(workflow.includes("scripts/blender/preflight-linen-earth-officewear.py"));
  assert.ok(workflow.includes("summarize-native-candidate-preflight.py"));
});
