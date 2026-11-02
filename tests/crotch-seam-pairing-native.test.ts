import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("actual original crotch source edge pairing is native, fail-closed and never approves a sewn garment",()=>{
  const source=readFileSync("scripts/blender/diagnose-crotch-seam-pairing.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  for(const required of [
    'IDENTITY = "linen-earth-studio-model-v1"',
    'STAGE = "selectedBodyShell"',
    'scene.get("linen_earth_research_crotch_stages_emitted") is not True',
    'len(research.objects) != 8',
    'sourceStage',
    'sourceOpenBoundaryEvidence',
    'actual_centerline_source_segments',
    'def nearest_point_to_segment(point, segment):',
    'fraction = max(0.0, min(1.0,',
    'mutualNearestEdgeCount',
    'unmatchedOriginalSourceEdgeIndices',
    'unmatched_left = sorted(set(range(len(forward))) - mutual_left)',
    'midpointToOtherCutEdgeMm',
    '"changesProductionGeometry": False',
    '"productionApproved": False',
    '"physicalFitApproved": False',
    '"metricCaveat":',
    'TITAN_REAL_CROTCH_SOURCE_SEAM_PAIRING_UNAPPROVED',
  ]) assert.ok(source.includes(required),required);
  assert.ok(!source.includes("bpy.ops."),"research must not mutate Blender geometry");
  for(const required of [
    '"scripts/blender/diagnose-crotch-seam-pairing.py"',
    '"tests/crotch-seam-pairing-native.test.ts"',
    '--python scripts/blender/diagnose-crotch-seam-pairing.py --',
    'TITAN_REAL_CROTCH_SOURCE_CUT_EDGE_ALIGNMENT_MEASURED_NO_BRIDGE_APPROVAL',
    'assert rejected["preflightReady"] is False and rejected["rejectionReasonCount"] == 10',
    'assert pairing["physicalFitApproved"] is False',
    'pairing["changesProductionGeometry"] is False',
    'assert left == proximity["actualSourceBoundaryEdges"]["left"]["nearCenterlineBoundaryEdges"] > 0',
    'assert right == proximity["actualSourceBoundaryEdges"]["right"]["nearCenterlineBoundaryEdges"] > 0',
    'assert len(indexes) == total - pairing["mutualNearestEdgeCount"] == 4',
    'titan-candidate-evidence/crotch-source-seam-pairing.json',
  ]) assert.ok(workflow.includes(required),required);
  assert.equal((workflow.match(/"scripts\/blender\/diagnose-crotch-seam-pairing.py"/g)||[]).length,2);
  assert.equal((workflow.match(/"tests\/crotch-seam-pairing-native.test.ts"/g)||[]).length,2);
});
