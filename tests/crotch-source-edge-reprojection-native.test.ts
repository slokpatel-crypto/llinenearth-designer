import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("native source seam relocation moves only separate real-body research geometry", () => {
  const code = readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py", "utf8");
  const workflow = readFileSync(".github/workflows/titan-native-source-candidate.yml", "utf8");
  for (const evidence of [
    "def trial_source_cut_edge_reprojection(",
    '"testedNormalOffsetMm": offset_mm',
    '"sourceCutBoundaryCoordinatesChanged": signed_offset_mm != 0',
    '"signedBodyNormalOffsetMm": signed_offset_mm',
    '"sourceEdgeSamplesBelowSevenMm": sum(',
    '"positiveNormalOffsetSweepMm": [7.0, 9.0, 11.0]',
    '"jointSampledTargetObserved": bool(joint_sampled_candidates)',
    '"jointSampledZeroBVHAndSevenMmCandidateLabels": joint_sampled_candidates',
    'positive_nine = measure("positiveBodyNormal9Mm", 9.0)',
    'positive_eleven = measure("positiveBodyNormal11Mm", 11.0)',
    '"sampledNearestOriginalBodyDistanceMm": readings',
    '"strictOriginalBodyPairImprovementObserved": (',
    '"strictOriginalBodyContactAreaImprovementObserved": (',
    '"strictSampledSevenMmImprovementObserved": (',
    '"changesProductionGeometry": False',
    '"productionApproved": False',
    "body_tree.find_nearest(point)",
    "body_tree.find_nearest(sample)",
    "points[index] = closest + unit_normal * (signed_offset_mm / 1000.0)",
    "if not math.isfinite(delta_mm) or delta_mm > 25:",
    'research.objects.link(obj)',
    'bpy.data.collections[EXPORT].objects.get(name)',
    '"researchOnlySourceCutEdgeReprojectionTrial": source_edge_reprojection',
  ]) assert.ok(code.includes(evidence), evidence);
  assert.ok(!code.includes("bpy.ops."), "Original source .blend must not be altered");
  assert.ok(!code.includes("save_as_mainfile"));
  for (const evidence of [
    '"tests/crotch-source-edge-reprojection-native.test.ts"',
    'source_offset=targeted["researchOnlySourceCutEdgeReprojectionTrial"]',
    'source_control["sourceEdgeSamplesBelowSevenMm"] == 14',
    'row["sourceCutBoundaryCoordinatesChanged"] is (name != "unchangedControl")',
    'assert set(source_variants) == set(expected_offsets)',
    'assert row["signedBodyNormalOffsetMm"] == expected_offsets[name]',
    'source_offset["positiveNormalOffsetSweepMm"] == [7.0,9.0,11.0]',
    'source_offset["jointSampledTargetObserved"] is bool(expected_joint)',
    'source_offset["strictSampledSevenMmImprovementObserved"]',
    'source_offset["productionApproved"] is False',
    '"sourceCutEdgeReprojectionTrial":targeted["researchOnlySourceCutEdgeReprojectionTrial"]',
  ]) assert.ok(workflow.includes(evidence), evidence);
  assert.equal(
    workflow.split('"tests/crotch-source-edge-reprojection-native.test.ts"').length - 1,
    2,
    "Native source workflow must run for exact-head changes"
  );
});
