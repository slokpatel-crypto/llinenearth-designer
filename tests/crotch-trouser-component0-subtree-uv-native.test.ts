import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("largest original component one-cut UV trial stays measurable and rejected",()=>{
  const helper=readFileSync("scripts/blender/source-trouser-component0-subtree-uv-trial.py","utf8");
  const driver=readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  const fixture=readFileSync("tests/python/test_source_trouser_component0_subtree_uv.py","utf8");
  for(const marker of [
    "def trial_component0_balanced_subtree_uv_pack(",
    "len(retained_source_tree_edges) != 2647",
    "[len(group) for group in groups] != [1220, 715, 715]",
    '"selectionRule": "largest smaller side of one retained component-0 tree edge"',
    '"addedActualSourceCutEdgeLengthMm": round(edge_length_mm, 5)',
    '"newUnclosedSourceUvSeamCount": 1',
    '"maximumOriginalTriangleEdgeChangeMm": round(max_change_mm, 9)',
    '"sourceGeometryAndVertexIDsUnchanged": True',
    '"sourceUvExportOrSavePerformed": False',
    '"realTailorCutApproved": False',
    '"physicalBodyFitApproved": False',
    '"productionApproved": False',
  ])assert.ok(helper.includes(marker),marker);
  for(const marker of [
    'Path(__file__).with_name("source-trouser-component0-subtree-uv-trial.py")',
    'weighted_selection["retainedOriginalSourceEdges"]',
    'weighted_report["researchOnlyComponent0SubtreeUvTrial"]',
    'packed_weighted_cut["unclosedSharedUvCutCandidateEdges"] + 1',
    'subtree_summary["addedActualSourceCutEdgeLengthMm"]',
    '"sourceUvExportOrSavePerformed": False',
    '"physicalFabricAndTailorApproval": False',
  ])assert.ok(driver.includes(marker),marker);
  for(const marker of [
    "python3 tests/python/test_source_trouser_component0_subtree_uv.py",
    'weighted["researchOnlyComponent0SubtreeUvTrial"]',
    'trial["retainedSourceUvTreeJoinCountAfter"] == 2646',
    'candidate_cut["unclosedSharedUvCutCandidateEdges"]',
    'candidate_overlap["actualTrianglesInspected"] == 5300',
    'subtree_comparison["completeGarmentUvApproved"] is False',
  ])assert.ok(workflow.includes(marker),marker);
  for(const marker of [
    'assert report["targetComponentOriginalSourceFaceCount"] == 1220',
    'assert report["addedActualSourceCutEdgeLengthMm"] > 0',
    'assert after["observedInteriorOverlapTrianglePairsLowerBound"] == 0',
    "reject(source_retained=retained[:-1])",
    "reject(source_points=bad_points)",
    "reject(source_faces=bad_faces)",
  ])assert.ok(fixture.includes(marker),marker);
  for(const marker of [
    '"scripts/blender/source-trouser-component0-subtree-uv-trial.py"',
    '"tests/crotch-trouser-component0-subtree-uv-native.test.ts"',
  ])assert.equal(workflow.split(marker).length-1,2,
    "Source workflow must trigger on PR and main for the one-cut trial");
  assert.ok(!helper.includes("import bpy"));
  assert.ok(!driver.includes("save_as_mainfile"));
});
