import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("actual 2650-face original trouser UV study never upgrades synthetic cloth provenance", () => {
  const helper=readFileSync("scripts/blender/source-trouser-provisional-uv.py","utf8");
  const original=readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  const python=readFileSync("tests/python/test_source_trouser_provisional_uv.py","utf8");
  for(const invariant of [
    "def study_original_source_trouser_uv(points, faces, source_cut_edges):",
    "if len(faces) != 2650 or not points or len(source_cut_edges) != 8:",
    "len(face) < 3 or len(set(face)) != len(face)",
    "if any(len(owners) > 2 for owners in edge_owners.values()):",
    '"displayUvDiscontinuousSharedEdges": discontinuous_edges',
    '"provisionalUvCollapsedFaceCount": collapsed_display_faces',
    '"maximumDisplayUvEdgeStretchErrorMm": round(max_edge_error, 5)',
    '"rmsDisplayUvEdgeStretchErrorMm": round(',
    '"originalSourcePanelUVApproved": False',
    '"sourceToBridgeUVContinuityVerified": False',
    '"textureGrainDirectionVerified": False',
    '"physicalTextileScaleVerified": False',
    '"measuredSupplierFabricRepeatMm": None',
    '"productionApproved": False',
  ]) assert.ok(helper.includes(invariant), invariant);
  for(const invariant of [
    '"source-trouser-provisional-uv.py"',
    '"study_original_source_trouser_uv"',
    'merged_verts, base_faces, l_remaining + r_remaining_mapped',
    '"TITAN_RESEARCH_OriginalTrouserPanelsProvisionalUVOnly"',
    '"TITAN_RESEARCH_UNVERIFIED_ORIGINAL_SOURCE_CYLINDER"',
    'source_uv_mesh.from_pydata(merged_verts, [], base_faces)',
    'source_uv_layer.data[loop_index].uv = coordinate',
    'research.objects.link(source_uv_obj)',
    'export.objects.get(source_uv_name)',
    'uv_body_pairs = body_tree.overlap(geom_ops["real_tree"](uv_geo))',
    'if len(uv_body_pairs) != unchanged_source_pairs:',
    'uv_report["originalSourceUVFromGarmentProduction"] = False',
    'seam_winding["researchOnlyOriginalSourcePanelUvSurvey"] = uv_report',
  ]) assert.ok(original.includes(invariant),invariant);
  assert.ok(!helper.includes("bpy.ops."),"The source-UV helper must be pure");
  assert.ok(!original.includes("save_as_mainfile"),"No source garment file mutation");
  for(const invariant of [
    '"scripts/blender/source-trouser-provisional-uv.py"',
    '"tests/crotch-trouser-provisional-uv-native.test.ts"',
    '"tests/python/test_source_trouser_provisional_uv.py"',
    'python3 tests/python/test_source_trouser_provisional_uv.py',
    'source_uv=oriented["researchOnlyOriginalSourcePanelUvSurvey"]',
    'source_uv["actualOriginalSourceFaceCount"] == 2650',
    'source_uv["nativeOriginalSourceUvLoopCount"] == source_uv["provisionalUvLoopCount"]',
    'source_uv["displayUvContinuousSharedEdges"]',
    'source_uv["sourceToBridgeUVContinuityVerified"] is False',
    '"provisionalActualSourceTrouserUvEvidence": {',
  ]) assert.ok(workflow.includes(invariant),invariant);
  for(const invariant of [
    '"scripts/blender/source-trouser-provisional-uv.py"',
    '"tests/crotch-trouser-provisional-uv-native.test.ts"',
  ]) assert.equal(workflow.split(invariant).length-1,2,"PR and push native triggers must include real source UV study");
  assert.ok(python.includes("assert result == again"));
  assert.ok(python.includes("must_reject(broken_points, faces, cut_edges)"));
});
