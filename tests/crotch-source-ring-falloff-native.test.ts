import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("native original trouser source-face ring falloff stays non-export and reports worsening honestly", () => {
  const code = readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py", "utf8");
  const workflow = readFileSync(".github/workflows/titan-native-source-candidate.yml", "utf8");
  for (const needle of [
    "for face in base_faces:",
    "neighbours.setdefault(a, set()).add(b)",
    "source_rings = {i: 0 for i in source_indices}",
    "for depth in (1, 2):",
    'def make(label, signed_offset_mm, ring_weights=()):',
    '"Positive9MmOneRingHalf", 9.0, (0.5,)',
    '"Positive9MmTwoRing", 9.0, (0.66, 0.33)',
    "nearest_source = min(",
    "movement = seed_displacements[nearest_source] * weight",
    "points[index] = vertices[index] + movement",
    '"movedNeighborVertexCountsByRing": {',
    '"alteredOriginalSourceFaceIndices": altered_source_faces',
    '"originalSourceMeshRingVertexCounts": {',
    '"falloffTrials": {',
    '"falloffAllAlteredSourceFaceNormalFlips": {',
    '"falloffReducedAdjacentBodyPairsObserved": {',
    '"changesProductionGeometry": False',
    '"productionApproved": False',
    "research.objects.link(obj)",
  ]) assert.ok(code.includes(needle), needle);
  assert.ok(!code.includes("bpy.ops."), "Original Blender scene must not change");
  assert.ok(!code.includes("save_as_mainfile"), "No unapproved Blender write/export");

  for (const needle of [
    '"tests/crotch-source-ring-falloff-native.test.ts"',
    'falloffs=connected["falloffTrials"]',
    '"oneRingHalf":[0.5]',
    '"twoRing":[0.66,0.33]',
    'assert rings["0"] == 4 and rings["1"] > 0 and rings["2"] > 0',
    'connected["falloffAllAlteredSourceFaceNormalFlips"]',
    'candidate["sourceEdgeReadingsUnderSevenMm"] == 0',
    'observed_less[label] is (',
    '"sourceFalloffAdjacentBodyPairs": {',
  ]) assert.ok(workflow.includes(needle), needle);
  assert.equal(
    workflow.split('"tests/crotch-source-ring-falloff-native.test.ts"').length - 1,
    2,
    "Exact-head source native CI must trigger from any PR or main change"
  );
});
