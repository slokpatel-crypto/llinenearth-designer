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
    '"nearestImmutableOriginalCutEdge": list(nearest_cut_edge)',
    '"nearestTargetMovedCutEdge": list(nearest_target_cut_edge)',
    '"targetMovedCutEdgeDistanceMm": round(target_boundary_distance, 6)',
    '"leftAuthenticFaceTopology": source_face_ring_trace(left_global_face)',
    '"rightAuthenticFaceTopology": source_face_ring_trace(right_global_face)',
    '"minimumFaceAdjacencyRingsToAlteredSourceFace": minimum_seed_ring',
    '"localFaceRingCountsZeroThroughTwo": [',
    '"introducedCrossingTopology": introduced_crossings',
    '"allIntroducedCrossingsTraceDirectlyToAlteredSourceFaces": introduced_topology_traced',
    'Face rings use shared authentic source',
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
    'for item in offset["trialSegments"]',
    'assert len(target_edges) == 2 and len(immutable_edges) == 8',
    'assert tuple(row["nearestTargetMovedCutEdge"]) in target_edges',
    'assert nearest_edge in immutable_edges',
    'assert side["authenticGlobalPolygonIndex"] == expected_global',
    'assert side["minimumFaceAdjacencyRingsToAlteredSourceFace"] >= 0',
    'assert side["localFaceRingCountsZeroThroughTwo"][0] == 1',
    'assert len(introduced) == 1',
    'assert crossing_gate["introducedCrossingTopology"] == introduced',
    'assert crossing_gate["allIntroducedCrossingsTraceDirectlyToAlteredSourceFaces"] is True',
    'crossing_gate["candidateRetainedForFurtherResearch"] is (',
    '"connectedSourceNineMmTrial":targeted["researchOnlyConnectedSourceNineMmTrial"]',
  ]) assert.ok(workflow.includes(needle), needle);
  assert.equal(
    workflow.split('"tests/crotch-connected-source-nine-native.test.ts"').length - 1,
    2,
    "Native source experiment must trigger on PR and main changes"
  );
});
