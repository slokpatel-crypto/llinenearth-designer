import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("connected original source cut seam tests REAL adjacent trouser faces and preserves export isolation", () => {
  const source = readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py", "utf8");
  const workflow = readFileSync(".github/workflows/titan-native-source-candidate.yml", "utf8");
  for (const needle of [
    "def trial_connected_source_edge_nine_mm(",
    'affected_source_faces = {',
    'if any(vertex in source_indices for vertex in face)',
    'target_bridge_faces = set(range(',
    '"TITAN_RESEARCH_ConnectedCrotchSource_" + label',
    "mesh.from_pydata(points, [], faces)",
    "points[index] = nearest_point + direction * (signed_offset_mm / 1000.0)",
    'if bpy.data.collections[EXPORT].objects.get(name) is not None:',
    'pairs = body_tree.overlap(geom_ops["real_tree"](measured))',
    'geom_ops["geometric_intersection_witness"](',
    'geom_ops["intersection_segment_witnesses"](',
    '"positiveNineMmAuthenticLegCrossingAndBodyGate": crossing_body_gate',
    'witness["experimentalBridgeFacesExcluded"] = len(bridge_faces)',
    '"strictCrossingSegmentReductionObserved": strict_crossing_reduction',
    '"noWholeSourceBodyBVHPairRegressionObserved": no_body_collision_regression',
    '"candidateRetainedForFurtherResearch": (',
    '"allCrossingSegmentsLocalized": len(localized) == len(segments)',
    '"immutableOriginalCutBoundaryDistanceMm": round(boundary_distance, 6)',
    '"scannedBodyHeightOctileCounts": octiles',
    'no safe distance, cloth thickness',
    '"originalSourceAdjacentFaceCount": len(affected_source_faces)',
    '"targetBridgeBodyBVHPairs": sum(',
    '"adjacentOriginalSourceBodyBVHPairs": sum(',
    '"sourceAdjacentFaceNormalFlipsAfterNineMm": changed_winding',
    '"localBridgeBodyCollisionImprovementObserved": (',
    '"localAdjacentSourceBodyCollisionImprovementObserved": (',
    '"changesProductionGeometry": False',
    '"researchOnlyConnectedSourceNineMmTrial"',
    "No continuous",
  ]) assert.ok(source.includes(needle), needle);
  assert.ok(!source.includes("bpy.ops."), "Do not modify/save the original source");
  assert.ok(!source.includes("save_as_mainfile"));
  for (const needle of [
    '"tests/crotch-connected-source-nine-native.test.ts"',
    'connected=targeted["researchOnlyConnectedSourceNineMmTrial"]',
    'connected["originalOpenBoundaryEdgeCount"] == offset["openSourceBoundaryEdgesAfterBridge"] == 126',
    'src_nine["sourceEdgeReadingsUnderSevenMm"] == 0',
    'connected["sourceAdjacentFaceNormalFlipsAfterNineMm"]',
    'connected["localBridgeBodyCollisionImprovementObserved"]',
    'connected["positiveNineMmAuthenticLegCrossingAndBodyGate"]',
    'locality=witness["crossingLocality"]',
    'assert locality["allCrossingSegmentsLocalized"] is True',
    'assert sum(locality["scannedBodyHeightOctileCounts"]) == locality["crossingSegmentCount"]',
    'crossing_gate["candidateRetainedForFurtherResearch"] is (',
    '"connectedSourceNineMmTrial":targeted["researchOnlyConnectedSourceNineMmTrial"]',
  ]) assert.ok(workflow.includes(needle), needle);
  assert.equal(
    workflow.split('"tests/crotch-connected-source-nine-native.test.ts"').length - 1,
    2,
    "Native source experiment must trigger on PR and main changes"
  );
});
