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
    '"uvCutGraphCycleRank": cut_cycle_rank',
    '"uvCutGraphSimpleOpenPathComponentCount":',
    '"uvCutGraphSimpleClosedLoopComponentCount":',
    '"uvCutGraphBranchedOrCompoundComponentCount":',
    '"uvCutGraphInteriorDegreeOneSourceVertexCount":',
    '"uvCutGraphComponentsWithoutActualOriginalOpenBoundary":',
    '"uvCutGraphMaximumJunctionDegree":',
    '"uvCutGraphJunctionsOnActualOriginalBoundary":',
    '"uvCutGraphJunctionsOnGenuineOriginalCrotchCut":',
    '"actualLargestOriginalSourceUvCutJunctions": junction_rows[:12]',
    '"uvCutGraphMaximalSourceChainCount": len(source_chains)',
    '"uvCutGraphClosedMaximalSourceChainCount": sum(',
    '"uvCutGraphMaximalSourceChainEdgeCoverageCount": sum(',
    '"uvCutGraphLongestOriginalSourceChainLengthMm": (',
    '"actualLongestOriginalSourceUvCutChains": source_chains[:12]',
    '"originalSourceComponentMinimumVertexIndex":',
    'classification["realOriginalSourceUvCutNetworkLengthMm"] = round(',
    '"actualLongestBranchedOriginalSourceUvCutChains": branched_chain_rows[:12]',
    '"actualBranchedOriginalSourceUvCutNetworks": [',
    '"actualHighestGapBranchedOriginalSourceUvCutChains":',
    '"maximumOriginalSourceUvSeamGapMm": round(',
    '"originalSourceEdgeAtMaximumUvSeamGap": list(chain_max_edge)',
    "Original source UV chain gaps do not cover global maximum.",
    "Original UV component seam gap mismatches genuine source paths.",
    "Original branched UV source chains have incomplete component ownership.",
    '"originalSourceVertexPath": list(chain)',
    "Original source UV chain path inventory omitted real cut edges.",
    "Original UV source chain path is not a real unique cut edge.",
    '"actualLargestGapUvCutEdges": [',
    '"realTailorCutLinesApproved": False',
    '"sourcePanelUVContinuityVerified": False',
    '"measuredSupplierTextileRepeatMm": None',
    '"productionApproved": False',
  ])assert.ok(helper.includes(needle),needle);
  for(const needle of [
    "def classify_original_source_uv_cut_component(",
    "def trace_original_source_uv_cut_chains(",
    "Original UV maximal chains did not cover every source edge.",
    "Original source maximal chain lengths/edges do not reconcile.",
    'shape = "simple-open-path"',
    'shape = "simple-closed-loop"',
    'shape = "branched-or-compound"',
    "cycle_rank = edges - len(component) + 1",
    "if visited != component:",
    "Original UV cut graph component is disconnected.",
    "Original source UV cut junction inventory is inconsistent.",
    '"realOriginalSourcePositionMm": [',
    '"touchesGenuineOriginalCrotchCut":',
    "cut_cycle_rank = len(uv_unclosed) - len(cut_graph) + len(network_components)",
    "Original UV cut graph failed independent Euler accounting.",
  ])assert.ok(helper.includes(needle),"source-panel topology classifier missing: "+needle);
  for(const needle of [
    'path_report["uvCutGraphTopology"] == "simple-open-path"',
    'assert trace(path_graph, (1,2,3)) == [[1,2,3]]',
    'assert trace(loop_graph, (1,2,3,4)) == [[1,2,3,4,1]]',
    'assert trace(branch_graph, (1,2,3,4)) == [',
    'assert trace(branch_and_loop, (1,2,3,4)) == [',
    'assert flat["uvCutGraphMaximalSourceChainCount"] == 0',
    'assert curved["uvCutGraphMaximalSourceChainEdgeCoverageCount"] == (',
    'actual_source_edges = {',
    'top_chains = curved["actualLongestOriginalSourceUvCutChains"]',
    'branched = curved["actualBranchedOriginalSourceUvCutNetworks"]',
    'branch_chains = curved["actualLongestBranchedOriginalSourceUvCutChains"]',
    'gap_ranked = curved["actualHighestGapBranchedOriginalSourceUvCutChains"]',
    'row["maximumOriginalSourceUvSeamGapMm"] > 0.001',
    'r["originalSourceVertexPath"][0] ==',
    'loop_report["uvCutGraphTopology"] == "simple-closed-loop"',
    'branch_report["uvCutGraphTopology"] == "branched-or-compound"',
    'assert curved["uvCutGraphCycleRank"] == (',
    'disjoint_path_and_loop = edge_graph((',
    'two_disjoint_loops = edge_graph((',
    'assert flat["actualLargestOriginalSourceUvCutJunctions"] == []',
    'junctions = curved["actualLargestOriginalSourceUvCutJunctions"]',
  ])assert.ok(synthetic.includes(needle),"missing source topology test: "+needle);
  // Every original UV/face/edge input must be a genuine measured source
  // primitive, never coerced from numeric-looking strings or booleans.
  for(const needle of [
    "isinstance(v, bool) or not isinstance(v, (int, float))",
    "type(i) is not int or i < 0 or i >= len(vertices)",
    "isinstance(k, bool) or not isinstance(k, (int, float))",
    "Original source crotch edge must contain literal integer vertex IDs.",
  ])assert.ok(helper.includes(needle),"source input provenance gate: "+needle);
  for(const needle of [
    "for forged in (False, 0.2, \"0\"):",
    "for forged in (True, \"0.0\", None, complex(0,0)):",
    "rejected(flat_points,bad_faces,flat_tree",
    "rejected(flat_points,faces,bad_uv,cuts",
  ])assert.ok(synthetic.includes(needle),"invalid source regression: "+needle);
  assert.ok(!helper.includes("face = tuple(int(i) for i in raw_face)"));
  assert.ok(!helper.includes("coord = [tuple(float(k) for k in uv) for uv in raw_uv]"));
  assert.ok(!helper.includes("xyz = tuple(float(v) for v in point)"));
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
    'cut_network["uvCutGraphCycleRank"] == (',
    '"uvCutGraphSimpleOpenPathComponentCount"',
    '"uvCutGraphBranchedOrCompoundComponentCount"',
    '"uvCutGraphInteriorDegreeOneSourceVertexCount"',
    'chains=cut_network["actualLongestOriginalSourceUvCutChains"]',
    'branched=cut_network["actualBranchedOriginalSourceUvCutNetworks"]',
    '"actualLongestBranchedOriginalSourceUvCutChains"',
    'highest_gap_branches=cut_network[',
    '"actualHighestGapBranchedOriginalSourceUvCutChains"',
    'tuple(row["originalSourceEdgeAtMaximumUvSeamGap"]) in {',
    'row["maximumOriginalSourceUvSeamGapMm"] > 0.001',
    'assert len(branched) == cut_network[',
    'row["originalSourceComponentMinimumVertexIndex"] in branch_ids',
    'type(row["originalSourceVertexPath"]) is list',
    'reported_chain_edges=[',
    'len(set(reported_chain_edges)) == len(reported_chain_edges)',
    'assert cut_network[\n                  "uvCutGraphMaximalSourceChainEdgeCoverageCount"',
    'assert cut_network[\n                  "uvCutGraphLongestOriginalSourceChainLengthMm"',
    'row["uvCutGraphMaximalChainEdgeCoverageCount"] == (',
    '"uvCutGraphJunctionsOnGenuineOriginalCrotchCut"',
    'junctions=cut_network["actualLargestOriginalSourceUvCutJunctions"]',
    'cut_network["uvCutGraphMaximumJunctionDegree"] == max(',
    'row["realOriginalSourcePositionMm"]',
    'row["uvCutGraphTopology"] in (',
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
