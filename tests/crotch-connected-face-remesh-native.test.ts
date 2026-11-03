import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("actual crotch original source faces are replaced by equal-topology connected native research triangulations", () => {
  const code = readFileSync("scripts/blender/prototype-crotch-connected-face-remesh.py", "utf8");
  const source = readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py", "utf8");
  const native = readFileSync(".github/workflows/titan-native-source-candidate.yml", "utf8");

  for (const needle of [
    "def trial_connected_face_retriangulation(",
    "if len(touched) != 6 or len(set(touched)) != 6:",
    "if any(i_vertex in source_vertices for i_vertex in face)",
    "source_vertices = {v for edge in original_cut_edges for v in edge}",
    "original_open, original_edge_counts = seam_ops[\"edge_topology\"](",
    "points[vertex] = closest + direction.normalized() * 0.009",
    "for original_id, face in enumerate(original_faces):",
    "central = sum((points[v] for v in face), points[face[0]].copy() * 0.0) / len(face)",
    "projected = nearest + direction.normalized() * 0.009",
    "faces.append((face[local], face[(local + 1) % len(face)], centroid_id))",
    "provenance[str(original_id)] = affected_ids",
    "if set(original_open) != set(new_open)",
    "mesh.from_pydata(mesh_points, [], faces)",
    'bpy.data.collections["LinenEarthExport"].objects.get(name)',
    "body_tree.overlap(geom_ops[\"real_tree\"](data))",
    '"untouchedOriginalSourceBodyPairs": len(other)',
    '"researchBridgeBodyPairs": len(bridge)',
    '"bodyContactedRemeshedOriginalAreaMm2": round(contact_area, 4)',
    '"bodyGuidedSourceFaceNormalReversals": normal_reversal_count',
    '"equalTopologyBodyGuidedCentroidSweepMm": {',
    '"bodyGuidedSourceFaceNormalReversalsByOffsetMm": flipped_per_offset',
    'projected_points7.append(projected_7)',
    'projected_points11.append(projected_11)',
    'candidate7 = make("BodyGuidedCentres7Mm", projected_points7)',
    'candidate11 = make("BodyGuidedCentres11Mm", projected_points11)',
    '"productionApproved": False',
    '"changesProductionGeometry": False',
  ]) assert.ok(code.includes(needle), needle);
  assert.ok(source.includes('"researchOnlyConnectedFaceRetriangulation"'));
  assert.ok(source.includes('"prototype-crotch-connected-face-remesh.py"'));
  assert.ok(!code.includes("bpy.ops."), "No Blender save or export operation allowed");
  assert.ok(!code.includes("save_as_mainfile"));

  for (const needle of [
    '"scripts/blender/prototype-crotch-connected-face-remesh.py"',
    '"tests/crotch-connected-face-remesh-native.test.ts"',
    'remesh=targeted["researchOnlyConnectedFaceRetriangulation"]',
    'remesh["originalOpenSourceBoundaryEdges"] == remesh["remeshOpenSourceBoundaryEdges"] == 126',
    'remesh_control["untouchedOriginalSourceBodyPairs"] == remesh_candidate["untouchedOriginalSourceBodyPairs"]',
    'remesh_control["researchBridgeBodyPairs"] == remesh_candidate["researchBridgeBodyPairs"]',
    'remesh["bodyGuidedSourceFaceNormalReversals"]',
    'remesh_sweep=remesh["equalTopologyBodyGuidedCentroidSweepMm"]',
    'assert set(remesh_sweep) == {"7","9","11"}',
    'for remesh_row in (remesh_control,*remesh_sweep.values()):',
    'remesh_flip_sweep=remesh["bodyGuidedSourceFaceNormalReversalsByOffsetMm"]',
    '"connectedOriginalFaceRetriangulation":targeted["researchOnlyConnectedFaceRetriangulation"]',
  ]) assert.ok(native.includes(needle), needle);
  for (const needle of [
    '"scripts/blender/prototype-crotch-connected-face-remesh.py"',
    '"tests/crotch-connected-face-remesh-native.test.ts"',
  ]) assert.equal(native.split(needle).length - 1, 2, "Native workflow must listen for PR and main changes");
});
