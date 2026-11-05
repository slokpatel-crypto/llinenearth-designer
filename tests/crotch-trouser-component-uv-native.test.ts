import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("true original-source UV disconnected-component pack never becomes sewn cloth",()=>{
  const helper=readFileSync("scripts/blender/source-trouser-component-uv-pack.py","utf8");
  const driver=readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  const fixture=readFileSync("tests/python/test_source_trouser_component_uv_pack.py","utf8");
  for(const marker of [
    "def pack_original_source_uv_face_components(",
    "len(original_faces) != 2650 or len(face_uv_loops) != 2650",
    "originalSourceFaceGraphComponentCount",
    "components = []",
    "queue = deque([root])",
    "packed[face_id] = [",
    '"maximumOriginalTriangleEdgeChangeMm": round(max_change, 9)',
    '"sourceGeometryAndVertexIDsUnchanged": True',
    '"originalSourceUvTreeUnchanged": True',
    '"physicalTextileWidthOrRepeatKnown": False',
    '"realTailorSeamsApproved": False',
    '"sourcePanelsOverlapFreeApproved": False',
    '"physicalBodyClearanceApproved": False',
    '"productionApproved": False',
  ])assert.ok(helper.includes(marker),marker);
  for(const marker of [
    'Path(__file__).with_name("source-trouser-component-uv-pack.py")',
    'rigid_pack(base_faces, unshifted["face_uv_loops"])',
    'uv_overlap_audit(base_faces, packed["face_uv_loops"])',
    '"audit_original_source_uv_cut_network"',
    '"researchOnlyRigidSourceUvComponentPackingEvidence"',
    '"unclosedSourceUvSeamCountUnchanged": True',
    '"sourceUvExportOrSavePerformed": False',
    '"tailorCutAndFitApproved": False',
  ])assert.ok(driver.includes(marker),marker);
  for(const marker of [
    "python3 tests/python/test_source_trouser_component_uv_pack.py",
    'source_report["researchOnlyRigidSourceUvComponentPackingEvidence"]',
    'assert pack_report["originalSourceFaceGraphComponentCount"] == 3',
    'assert pack_report["originalSourceComponentFaceCounts"] == [1220,715,715]',
    'assert packed["sourceUvExportOrSavePerformed"] is False',
    'assert pack_report["maximumOriginalTriangleEdgeChangeMm"] <= 0.000001',
    'assert comparison["candidateOverlapTrianglePairDelta"] <= 0',
  ])assert.ok(workflow.includes(marker),marker);
  for(const marker of [
    'assert one["face_uv_loops"] == loops',
    'assert summary["originalSourceFaceGraphComponentCount"] == 2',
    'assert before["observedInteriorOverlapTrianglePairsLowerBound"] > 0',
    'assert after["observedInteriorOverlapTrianglePairsLowerBound"] == 0',
    'assert summary["productionApproved"] is False',
    'reject(faces, inverted)',
    'reject(nonmanifold, loops)',
  ])assert.ok(fixture.includes(marker),marker);
  for(const marker of [
    '"scripts/blender/source-trouser-component-uv-pack.py"',
    '"tests/crotch-trouser-component-uv-native.test.ts"',
  ])assert.equal(workflow.split(marker).length-1,2,
    "Original 3D source workflow must trigger on PR and main changes");
  assert.ok(!helper.includes("import bpy"),"Keep native UV translation helper pure");
  assert.ok(!driver.includes("save_as_mainfile"),"Never persist new source in production assets");
});
