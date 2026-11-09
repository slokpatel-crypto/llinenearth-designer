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
    "def trial_component0_ranked_two_cut_uv_pack(",
    "len(retained_source_tree_edges) != 2647",
    "[len(group) for group in groups] != [1220, 715, 715]",
    '"selectionRule": "largest smaller side of one retained component-0 tree edge"',
    '"candidateRankWithinBalancedTreeCuts": candidate_rank',
    'type(candidate_rank) is not int or not 0 <= candidate_rank < 48',
    'not 0 < translation_fraction <= 1',
    '"translationFractionOfOutsidePack": round(',
    '"fullOutsidePackTranslationMm": [',
    'len(candidate_ranks) != 2',
    'candidate_ranks[0] >= candidate_ranks[1]',
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
    'weighted_report["researchOnlyComponent0CappedTreeCutSurvey"]',
    'weighted_report["researchOnlyComponent0CappedTwoCutSurvey"]',
    'weighted_report["researchOnlyComponent0Rank18ConstrainedPlacementSurvey"]',
    'weighted_report["researchOnlyComponent0Rank18NearZeroPlacementSurvey"]',
    'for placement_step in range(1, 17):',
    'translation_fraction=translation_fraction',
    'translation_fraction = placement_step / 256.0',
    'near_zero_selected = min(near_zero_eligible',
    'for candidate_rank in range(1, 24):',
    '"strictResearchEligible": (',
    'for right in budget_ranks[index + 1:]',
    '"exactlyTwoNewUnclosedUvSeams": exact_two_new_seams',
    '"noMaximumUvGapRegression": no_max_gap_regression',
    '"noBranchJunctionRegression": no_branch_regression',
    'subtree_tree_report["verifiedTreeConnectedSharedEdges"] -= 1',
    'subtree_tree_report["nonTreeCycleUnclosedUvEdges"] += 1',
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
    'weighted["researchOnlyComponent0CappedTreeCutSurvey"]',
    'weighted["researchOnlyComponent0CappedTwoCutSurvey"]',
    '"researchOnlyComponent0Rank18ConstrainedPlacementSurvey"',
    '"researchOnlyComponent0Rank18NearZeroPlacementSurvey"',
    'assert survey["evaluatedCandidateCount"] == 24',
    'assert row["candidateUnclosedSharedUvSeams"] == 2586',
    'assert two_cut["evaluatedCandidatePairCount"] == 10',
    'assert row["candidateUnclosedSharedUvSeams"] == 2587',
    'assert constrained["evaluatedTranslationFractionCount"] == 16',
    'assert near_zero["evaluatedTranslationFractionCount"] == 16',
    'round(step/256.0,8) for step in range(1,17)',
    'assert row["candidateRank"] == 18',
    'row["measuredAddedCutNetworkLengthMm"] -',
    ') <= 0.0001',
  ])assert.ok(workflow.includes(marker),marker);
  assert.ok(!workflow.includes(
    'assert row["measuredAddedCutNetworkLengthMm"] == ('
  ),"independently rounded lengths must not use exact float equality");
  for(const marker of [
    'assert report["targetComponentOriginalSourceFaceCount"] == 1220',
    'assert report["addedActualSourceCutEdgeLengthMm"] > 0',
    'assert report["translationFractionOfOutsidePack"] == 1.0',
    'translation_fraction=0.5',
    'for rank in range(4)',
    'two_cut_trial(points, faces, loops, retained, [0, 2])',
    'assert len({tuple(row["report"]["removedRetainedOriginalSourceEdge"])',
    'for rank in (-1, 48, 1.0, True, "1"):',
    'for fraction in (0, -1, 1.00001, math.nan, math.inf, True, "0.5"):',
    'for ranks in (None, [], [0], [0, 1, 2], [0, 0], [2, 0]',
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
