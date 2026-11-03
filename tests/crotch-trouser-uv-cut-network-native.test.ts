import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("actual source UV cut graph counts physical mesh edges without inventing sewing or textile facts",()=>{
  const helper=readFileSync("scripts/blender/source-trouser-uv-cut-network.py","utf8");
  const native=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  const source=readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py","utf8");
  const synthetic=readFileSync("tests/python/test_source_trouser_uv_cut_network.py","utf8");
  for(const needle of [
    "def audit_original_source_uv_cut_network(",
    "len(original_faces) != 2650 or len(face_uv_loops) != 2650",
    "len(original_cut_edges) != 8",
    "if any(len(value) > 2 for value in owners.values()):",
    "len(owners.get(edge, [])) != 1",
    'tree_report["nonTreeCycleUnclosedUvEdges"]',
    '"originalSharedSourceEdgeCount": shared_edges',
    '"unclosedSharedUvCutCandidateEdges": len(uv_unclosed)',
    '"totalRealGeometryOfUvCutCandidatesMm": round(total_cut_mm, 5)',
    '"uvCutCandidateDegreeHistogram": {',
    '"uvCutCandidateDegreeThreePlusSourceVertices": sum(',
    '"uvCutCandidateGraphComponentCount": len(network_components)',
    '"actualLargestGapUvCutEdges": [',
    '"realTailorCutLinesApproved": False',
    '"sourcePanelUVContinuityVerified": False',
    '"measuredSupplierTextileRepeatMm": None',
    '"productionApproved": False',
  ])assert.ok(helper.includes(needle),needle);
  assert.ok(!helper.includes("bpy.ops."),"No mutation of actual original 3D mesh");
  for(const needle of [
    '"source-trouser-uv-cut-network.py"',
    'cut_audit_ops["audit_original_source_uv_cut_network"]',
    'merged_verts, base_faces, tree_study["face_uv_loops"]',
    'seam_winding["researchOnlyOriginalSourceUvCutNetworkEvidence"] = cut_audit',
  ])assert.ok(source.includes(needle),needle);
  for(const needle of [
    '"scripts/blender/source-trouser-uv-cut-network.py"',
    '"tests/crotch-trouser-uv-cut-network-native.test.ts"',
    '"tests/python/test_source_trouser_uv_cut_network.py"',
    'python3 tests/python/test_source_trouser_uv_cut_network.py',
    'cut_network=oriented["researchOnlyOriginalSourceUvCutNetworkEvidence"]',
    'cut_network["unclosedSharedUvCutCandidateEdges"] == (',
    'cut_network["uvCutCandidateDegreeThreePlusSourceVertices"] >= 0',
    'cut_network["realTailorCutLinesApproved"] is False',
    '"originalSourceUvCutNetworkEvidence": {',
  ])assert.ok(native.includes(needle),needle);
  for(const needle of [
    '"scripts/blender/source-trouser-uv-cut-network.py"',
    '"tests/crotch-trouser-uv-cut-network-native.test.ts"',
  ])assert.equal(native.split(needle).length-1,2,"Both native PR and push triggers required");
  assert.ok(synthetic.includes("assert curved["));
  assert.ok(synthetic.includes("must_reject")===false,"Use explicit rejected() negative tests");
  assert.ok(synthetic.includes("rejected(bad_points,faces,flat_tree"));
  assert.ok(!source.includes("save_as_mainfile"));
});
