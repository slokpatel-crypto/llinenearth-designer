import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("research-only open leg rim cannot weaken regular physical six-piece garment production",()=>{
  const author=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  for(const expected of [
    '"--experimental-leg-solidify-offset", type=float, choices=(-1.0, 0.0, 1.0), default=1.0',
    'solid.offset = 1.0',
    'if leg_solidify_offset not in (-1.0, 0.0, 1.0)',
    'solid.offset = leg_solidify_offset',
    'options.experimental_leg_solidify_offset',
    '"linen_earth_research_leg_solidify_offset"',
  ]) assert.ok(author.includes(expected),expected);
  for(const expected of [
    '"--experimental-leg-rim-off", action="store_true"',
    'solid.use_rim = True',
    'if leg_rim_off and obj.name in ("TrouserLegLFabric", "TrouserLegRFabric")',
    'solid.use_rim = False',
    'options.experimental_leg_rim_off',
    '"linen_earth_research_leg_rim_off"',
    'safe_candidate_output(options.output, bpy.data.filepath)',
  ]) assert.ok(author.includes(expected),expected);
  for(const expected of [
    '--experimental-leg-rim-off',
    'TITAN_REAL_RIMLESS_CROTCH_PHYSICAL_EXPERIMENT',
    'TITAN_RIMLESS_TEST_COMPLETED_NOT_PRODUCTION_APPROVED',
    'open_edges["left"] > 0 and open_edges["right"] > 0',
    '"neverPromote": True',
    'assert trial["preflightReady"] is False',
    'assert original["rejectionReasonCount"] == 10',
    'assert item["candidateOnly"] is True and item["productionApproved"] is False',
  ]) assert.ok(workflow.includes(expected),expected);
  for(const expected of [
    '--experimental-leg-solidify-offset "$offset"',
    'TITAN_REAL_CLOSED_SOLIDIFY_OFFSET_VARIANTS_MEASURED_NO_AUTO_PROMOTION',
    'assert actual_edges <= max_edges',
    'assert report["preflightReady"] is False',
    '"worsenedCollisionTypes": regressions',
    '"productionApproved": False',
  ]) assert.ok(workflow.includes(expected),expected);
});
