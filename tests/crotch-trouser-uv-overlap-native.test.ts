import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("original scanned-source UV overlap audit preserves bounded and non-production evidence",()=>{
  const pure=readFileSync("scripts/blender/source-trouser-uv-overlap-audit.py","utf8");
  const driver=readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  const fixture=readFileSync("tests/python/test_source_trouser_uv_overlap.py","utf8");
  for(const key of [
    "def audit_original_source_uv_triangle_overlaps(",
    "len(original_faces) != 2650 or len(face_uv_loops) != 2650",
    "if type(max_pair_tests) is not int or not 1 <= max_pair_tests <= 250000:",
    "triangle_number = len(triangles)",
    "_intersection_area(previous_tri, tri)",
    '"observedInteriorOverlapTrianglePairsLowerBound": overlapping',
    '"auditTruncated": truncated',
    '"canClaimNoInteriorOverlapInThisUvLayout": not truncated and overlapping == 0',
    '"completeGarmentUvOverlapFreeApproved": False',
    '"physicalSourceFitApproved": False',
    '"productionApproved": False',
    "def compare_original_source_uv_overlap_evidence(",
    '"candidateWorsenedRealUvInteriorOverlap": (delta > 0) if both_complete else None',
    '"bothFullResearchUvScansComplete": both_complete',
  ])assert.ok(pure.includes(key),key);
  for(const key of [
    'Path(__file__).with_name("source-trouser-uv-overlap-audit.py")',
    'uv_overlap_audit(base_faces, weighted_uv["face_uv_loops"])',
    'uv_overlap_audit(base_faces, branch_uv["face_uv_loops"])',
    '"researchOnlyOriginalSourceUvOverlapEvidence"] = weighted_overlap',
    '"researchOnlyOriginalSourceUvOverlapEvidence"] = branch_overlap',
    '"completeGarmentUvOverlapFreeApproved"',
    '"researchOnlyOriginalSourceUvOverlapComparison"] = uv_overlap_ops[',
  ])assert.ok(driver.includes(key),key);
  for(const key of [
    'python3 tests/python/test_source_trouser_uv_overlap.py',
    'weighted["researchOnlyOriginalSourceUvOverlapEvidence"]',
    'branch["researchOnlyOriginalSourceUvOverlapEvidence"]',
    'overlap["auditTruncated"]',
    'assert overlap["productionApproved"] is False',
    'comparison=branch["researchOnlyOriginalSourceUvOverlapComparison"]',
    'assert comparison["candidateWorsenedRealUvInteriorOverlap"] is True',
  ])assert.ok(workflow.includes(key),key);
  for(const key of [
    'assert baseline["observedInteriorOverlapTrianglePairsLowerBound"] == 0',
    'assert overlap["observedInteriorOverlapTrianglePairsLowerBound"] > 0',
    'assert bounded["auditTruncated"] is True',
    'assert bounded["canClaimNoInteriorOverlapInThisUvLayout"] is False',
    "rejects(faces, inverted)",
    'assert unknown["candidateOverlapTrianglePairDelta"] is None',
    "reject_comparison(baseline, forged)",
  ])assert.ok(fixture.includes(key),key);
  for(const key of [
    '"scripts/blender/source-trouser-uv-overlap-audit.py"',
    '"tests/crotch-trouser-uv-overlap-native.test.ts"',
  ])assert.equal(workflow.split(key).length-1,2,
    "Original source workflow must trigger for both PR and main push");
  assert.ok(!pure.includes("import bpy"),"Pure UV diagnostic must not import Blender");
  assert.ok(!driver.includes("save_as_mainfile"),"Research driver cannot save original garment scene");
});
