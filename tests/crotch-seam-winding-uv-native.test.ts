import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("real original cut-edge seam winding is exhaustive and UV remains source-provenance-only", () => {
  const solver=readFileSync("scripts/blender/source-crotch-seam-winding.py","utf8");
  const script=readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py","utf8");
  const native=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  for (const mark of [
    "def solve_original_source_seam_winding(",
    'for mask in range(1 << len(bridge_faces)):',
    'original_unmatched_edges',
    '"originalCutEdgeOwnership": original_cut',
    '"exhaustiveWindingCombinationsChecked": 1 << len(bridge_faces)',
    '"flippedResearchBridgeFaceIndices": [',
    '"unchangedOriginalSourceWindingMismatchEdges": sorted(bad_original)',
    '"newResearchBridgeWindingMismatchEdges": sorted(bad_added)',
    '"allNewResearchBridgeTwoOwnerEdgesOppositelyWound": (',
    '"sewnGarmentApproved": False',
    '"productionApproved": False',
    '"sourceUVAndFabricRepeatVerified": False',
  ]) assert.ok(solver.includes(mark), mark);
  for (const mark of [
    '"source-crotch-seam-winding.py"',
    '"solve_original_source_seam_winding"',
    'base_faces, bridge_faces, l_remaining + r_remaining_mapped',
    '"TITAN_RESEARCH_CrotchSourceBridgeWindingOnly"',
    'corrected_mesh.from_pydata(merged_verts, [], corrected_all_faces)',
    'research.objects.link(corrected_obj)',
    'export.objects.get(corrected_name)',
    '"originalSourceUVProvenance"',
    'for layer in stage.data.uv_layers:',
    '"originalStageHasFiniteCompleteUV"',
    '"newResearchBridgeHasCertifiedPhysicalUVScale"] = False',
    '"measuredSupplierPhysicalFabricRepeatMm"] = None',
    '"sourceSewnGarmentUVApproved"] = False',
    '"researchOnlyOriginalSeamWindingAndUVProvenance":seam_winding',
  ]) assert.ok(script.includes(mark), mark);
  assert.ok(!solver.includes("bpy.ops."));
  assert.ok(!script.includes("save_as_mainfile"));
  for (const mark of [
    '"scripts/blender/source-crotch-seam-winding.py"',
    '"tests/crotch-seam-winding-uv-native.test.ts"',
    '"tests/python/test_source_crotch_seam_winding.py"',
    'python3 tests/python/test_source_crotch_seam_winding.py',
    'oriented=evidence["researchOnlyOriginalSeamWindingAndUVProvenance"]',
    'oriented["exhaustiveWindingCombinationsChecked"] == 64',
    'oriented["newResearchBridgeHasCertifiedPhysicalUVScale"] is False',
    'oriented["measuredSupplierPhysicalFabricRepeatMm"] is None',
    'oriented["sourceSewnGarmentUVApproved"] is False',
    '"originalSourceSeamWinding": {',
  ]) assert.ok(native.includes(mark), mark);
  for (const mark of [
    '"scripts/blender/source-crotch-seam-winding.py"',
    '"tests/crotch-seam-winding-uv-native.test.ts"',
  ]) assert.equal(native.split(mark).length - 1, 2, "Native workflow must include PR and push paths");
});
