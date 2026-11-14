import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("maximum real original source edge forest compares cuts without inventing fabric approvals",()=>{
  const selector=readFileSync("scripts/blender/source-trouser-max-retained-uv.py","utf8");
  const connector=readFileSync("scripts/blender/source-trouser-dual-tree-uv.py","utf8");
  const blender=readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  const fixture=readFileSync("tests/python/test_source_trouser_max_retained_uv.py","utf8");
  for(const v of [
    "def select_original_source_max_retained_uv_tree(points, original_faces, original_cut_edges):",
    "len(original_faces) != 2650 or len(original_cut_edges) != 8",
    "if any(len(rows) > 2 for rows in owners.values()):",
    "shared.sort(key=lambda v: (-v[0], v[1], v[2], v[3]))",
    "if join(left, right):",
    '"retainedOriginalSourceEdges": [list(edge) for edge in retained]',
    '"minimumOmittedOriginalSourceEdgeLengthMm": round(remaining, 5)',
    '"actualCuttingLinesApproved": False',
    '"overlapFreeUvApproved": False',
    '"fabricScaleAndGrainApproved": False',
    '"productionApproved": False',
  ])assert.ok(selector.includes(v),v);
  for(const v of [
    "def select_original_source_branch_aware_uv_trial(",
    "branch_penalty_mm=100.0, max_candidate_edges=48",
    "predecessor = {start: None}",
    '"candidateResearchObjectiveMm": round(after[3], 5)',
    '"actualUvClosureMeasured": False',
    '"tailorSeamsApproved": False',
    "def compare_measured_original_source_uv_research_candidates(",
    '"measuredResearchParetoImprovement": improvement',
    '"measuredTradeoffObserved": (',
    '"sewnTextileCutLinesApproved": False',
  ])assert.ok(selector.includes(v),v);
  for(const v of [
    "preferred_tree_edges=None):",
    "expected_original_component_count = None",
    "allowed_tree = None",
    "if len(allowed_tree) != len(local) - expected_original_component_count:",
    "Selected edges disconnected a real original source component.",
    '"selectedForestSource": (',
  ])assert.ok(connector.includes(v),v);
  for(const v of [
    '"source-trouser-max-retained-uv.py"',
    'weighted_ops["select_original_source_max_retained_uv_tree"]',
    'preferred_tree_edges=weighted_selection["retainedOriginalSourceEdges"]',
    '"TITAN_RESEARCH_OriginalTrouserMaximumRetainedUvOnly"',
    '"TITAN_RESEARCH_UNVERIFIED_MAXIMUM_RETAINED_SOURCE_EDGES"',
    "weighted_mesh.from_pydata(merged_verts, [], base_faces)",
    "research.objects.link(weighted_obj)",
    "export.objects.get(weighted_object_name)",
    "len(weighted_body) != unchanged_source_pairs",
    '"researchOnlyOriginalSourceMaxRetainedUvEvidence"] = weighted_report',
    '"maxRetainedActualCutLengthChangeVsBfsMm"] = round(',
    '"researchOnlyBranchAwareSourceUvEvidence"] = branch_report',
    '"actualSourceUvCutNetworkEvidence"] = branch_audit',
    '"nativeBodyContactsInvariantFromUnchangedSource"] = unchanged_source_pairs',
    '"independentMeasuredUvParetoComparison"] = weighted_ops[',
  ])assert.ok(blender.includes(v),v);
  for(const v of [
    '"scripts/blender/source-trouser-max-retained-uv.py"',
    '"tests/crotch-trouser-max-retained-uv-native.test.ts"',
    '"tests/python/test_source_trouser_max_retained_uv.py"',
    'python3 tests/python/test_source_trouser_max_retained_uv.py',
    'weighted=oriented["researchOnlyOriginalSourceMaxRetainedUvEvidence"]',
    'max_selection["maximumRetainedTreeEdgeCount"] == 2647',
    'weighted["physicalSewnCrotchPatternApproved"] is False',
    '"maxRetainedOriginalSourceUvExperiment": {',
    'pareto=branch["independentMeasuredUvParetoComparison"]',
    'assert pareto["measuredResearchParetoImprovement"] is False',
    'assert pareto["measuredTradeoffObserved"] is True',
  ])assert.ok(workflow.includes(v),v);
  for(const v of [
    '"scripts/blender/source-trouser-max-retained-uv.py"',
    '"tests/crotch-trouser-max-retained-uv-native.test.ts"',
  ])assert.equal(workflow.split(v).length-1,2,"Original source native workflow PR and push must trigger");
  for(const marker of [
    "minimumOriginalSourceTriangleAreaMm2",
    "Original source quad contains a collapsed real 3D triangle.",
    "Original source cut edges require literal integer IDs.",
    "type(x) is not int or x < 0 or x >= len(verts)",
    "not isinstance(x, (int, float))",
  ])assert.ok(selector.includes(marker), "real source metric guard missing: "+marker);
  for(const marker of [
    "reject_source(collapsed, faces, cuts)",
    "for impostor in (False, 0.2, \"0\"):",
    'assert abs(summary["minimumOriginalSourceTriangleAreaMm2"] - 50.0)',
  ])assert.ok(fixture.includes(marker), "collapsed source fixture missing: "+marker);
  assert.ok(!selector.includes("face = tuple(int(x) for x in face_raw)"));
  assert.ok(!selector.includes("xyz = tuple(float(x) for x in pt)"));
  assert.ok(fixture.includes("assert result == select(points, original_faces, original_cut_edges)"));
  assert.ok(fixture.includes("reject_tree(good + [good[0]])"));
  assert.ok(fixture.includes("reject_comparison(baseline_audit, forgery,"));
  assert.ok(fixture.includes("assert equal_verdict[\"measuredResearchParetoImprovement\"] is False"));
  assert.ok(!selector.includes("bpy.ops."),"Selector must be pure and side-effect free");
  assert.ok(!blender.includes("save_as_mainfile"),"Original garment mesh must never be saved");
});
