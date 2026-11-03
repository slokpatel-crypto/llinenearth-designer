import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("real source original 2650-quad metric islands remain explicitly unstitched", () => {
  const helper=readFileSync("scripts/blender/source-trouser-quad-metric-uv.py","utf8");
  const script=readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py","utf8");
  const native=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  const testPy=readFileSync("tests/python/test_source_trouser_quad_metric_uv.py","utf8");
  for (const v of [
    "def unfold_original_trouser_source_quads(points, faces, original_cut_edges):",
    'if len(faces) != 2650 or len(original_cut_edges) != 8 or not points:',
    'len(face) != 4 or len(set(face)) != 4',
    "triangles_3d=_tri_area_3d(a,b,c)+_tri_area_3d(a,c,d)",
    "if not math.isfinite(error) or error>0.001:",
    '"actualOriginalSourceUvLoopCount":sum(len(r) for r in uv_faces)',
    '"unstitchedUvIslandCount":len(faces)',
    '"maximumActualQuadTriangleEdgeErrorMm":round(max_edge_error_mm,8)',
    '"provisionalUvDiscontinuousSharedEdges":mismatch_edges',
    '"flatChartsHaveConnectedGarmentUV":False',
    '"realSourceToBridgeUVJoined":False',
    '"supplierFabricRepeatMm":None',
    '"productionApproved":False',
  ]) assert.ok(helper.includes(v),v);
  for (const v of [
    '"source-trouser-quad-metric-uv.py"',
    'quad_ops["unfold_original_trouser_source_quads"]',
    '"TITAN_RESEARCH_OriginalTrouserQuadsUnstitchedMetricUVOnly"',
    '"TITAN_RESEARCH_UNSTITCHED_METRIC_QUAD_ISLANDS"',
    'quad_mesh.from_pydata(merged_verts, [], base_faces)',
    'quad_layer.data[loop_id].uv = coord',
    'research.objects.link(quad_obj)',
    'export.objects.get(quad_name)',
    'len(quad_body_contacts) != unchanged_source_pairs',
    'seam_winding["researchOnlyUnstitchedOriginalQuadMetricUvSurvey"] = qr',
    'qr["originalSourceUvProvenance"] = source_stage_uv_provenance',
  ]) assert.ok(script.includes(v),v);
  assert.ok(!helper.includes("bpy.ops."),"Original source research must not mutate Blender scene");
  assert.ok(!script.includes("save_as_mainfile"),"The source scene cannot be saved");
  for (const v of [
    '"scripts/blender/source-trouser-quad-metric-uv.py"',
    '"tests/crotch-trouser-quad-metric-uv-native.test.ts"',
    '"tests/python/test_source_trouser_quad_metric_uv.py"',
    'python3 tests/python/test_source_trouser_quad_metric_uv.py',
    'quads=oriented["researchOnlyUnstitchedOriginalQuadMetricUvSurvey"]',
    'quads["actualOriginalSourceQuadCount"] == 2650',
    'quads["nativeUvLoopsAssigned"] == 10600',
    'quads["originalBodyBVHPairsStillUnchanged"]',
    'quads["flatChartsHaveConnectedGarmentUV"] is False',
    '"unstitchedOriginalSourceQuadMetricUvEvidence": {',
  ]) assert.ok(native.includes(v),v);
  for(const v of [
    '"scripts/blender/source-trouser-quad-metric-uv.py"',
    '"tests/crotch-trouser-quad-metric-uv-native.test.ts"',
  ]) assert.equal(native.split(v).length-1,2,"Both source PR and main native paths must trigger");
  assert.ok(testPy.includes("assert result==again"));
  assert.ok(testPy.includes("must_reject(broken,quads,cuts)"));
});
