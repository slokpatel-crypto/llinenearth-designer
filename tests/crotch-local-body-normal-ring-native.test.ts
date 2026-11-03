import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("local source ring body-normal projection stays experimental with exact physical provenance", () => {
  const script=readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  for(const needle of [
    "ring_normal_targets_mm=()",
    "if ring_weights and ring_normal_targets_mm:",
    "for ring, target_mm in enumerate(ring_normal_targets_mm, start=1):",
    "source_location, source_normal, body_polygon, sample_distance = body_tree.find_nearest(vertices[index])",
    "target_point = source_location + source_normal.normalized() * (target_mm / 1000.0)",
    "if (not math.isfinite(move) or move > 25.0",
    '"ringOriginalBodyNormalTargetsMm": list(ring_normal_targets_mm)',
    '"Positive9MmLocalBodyNormalRing7Mm", 9.0',
    '"Positive9MmLocalBodyNormalTwoRings7And4Mm", 9.0',
    '"localBodyNormalOneRing7Mm": local_body_one',
    '"localBodyNormalTwoRings7And4Mm": local_body_two',
    '"falloffSameOriginalFaceRegionContactEvidence": regional_attribution',
    '"productionApproved": False',
    '"changesProductionGeometry": False',
    'research.objects.link(obj)',
    'bpy.data.collections[EXPORT].objects.get(name)',
  ]) assert.ok(script.includes(needle), needle);
  assert.ok(!script.includes("bpy.ops."), "No actual original Blender scene writes");
  assert.ok(!script.includes("save_as_mainfile"));
  for(const needle of [
    '"tests/crotch-local-body-normal-ring-native.test.ts"',
    '"localBodyNormalOneRing7Mm":[7.0]',
    '"localBodyNormalTwoRings7And4Mm":[7.0,4.0]',
    'candidate["ringOriginalBodyNormalTargetsMm"] == expected_original_body_targets[label]',
    'candidate["movedNeighborVertexCountsByRing"]["2"]',
    '"localBodyNormalRingMetrics": {',
    'connected["falloffSameOriginalFaceRegionContactEvidence"]["localBodyNormalOneRing7Mm"]',
  ]) assert.ok(workflow.includes(needle), needle);
  assert.equal(
    workflow.split('"tests/crotch-local-body-normal-ring-native.test.ts"').length-1, 2,
    "Both pull request and main CI paths include source provenance test"
  );
});
