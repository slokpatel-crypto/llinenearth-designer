import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("true original source bridge triangles unwrap to geometry-only nonproduction UV charts", () => {
  const helper=readFileSync("scripts/blender/source-crotch-bridge-flat-charts.py","utf8");
  const script=readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  const pure=readFileSync("tests/python/test_source_crotch_bridge_flat_charts.py","utf8");
  for(const needle of [
    "def flatten_original_bridge_charts(",
    "if len(faces) != 6 or len(actual_pairs) != 4:",
    '"actualCutEdgeLengthMismatchMm": round(abs(l_len-r_len), 5)',
    'if not math.isfinite(mismatch_mm) or mismatch_mm > 0.001:',
    '"maxActualBridgeEdgeLengthErrorMm": round(max(measured), 8)',
    '"sourceTrouserLegUVContinuityVerified": False',
    '"supplierFabricRepeatVerified": False',
    '"tailorSeamAllowanceApproved": False',
    '"originalSourceUVContinuityProven": False',
    '"measuredTextileScaleProven": False',
    '"productionApproved": False',
  ]) assert.ok(helper.includes(needle),needle);
  for(const needle of [
    '"source-crotch-bridge-flat-charts.py"',
    'flatten_ops["flatten_original_bridge_charts"](',
    '"TITAN_RESEARCH_CrotchBridgeUnverifiedUVOnly"',
    '"TITAN_RESEARCH_UNVERIFIED_BRIDGE_GEOMETRIC_UV"',
    'flat_mesh.from_pydata(merged_verts, [], corrected_bridge_faces)',
    'flat_layer.data[loop_id].uv = (u, v)',
    'if export.objects.get(flat_obj_name) is not None:',
    'geometric_flat["originalSourceTrouserUVPresent"] = any(',
    'geometric_flat["originalSourceGarmentUVStillMissing"] = not all(',
    'seam_winding["researchOnlyGeometricFlatBridgeCharts"] = geometric_flat',
    'geometric_flat["researchBridgeUVDisplayUnitsAreVerifiedTextileScale"] = False',
  ]) assert.ok(script.includes(needle),needle);
  assert.ok(!helper.includes("bpy.ops."),"Do not edit original Blender geometry");
  assert.ok(!script.includes("save_as_mainfile"));
  for(const needle of [
    '"scripts/blender/source-crotch-bridge-flat-charts.py"',
    '"tests/crotch-bridge-flat-charts-native.test.ts"',
    '"tests/python/test_source_crotch_bridge_flat_charts.py"',
    'python3 tests/python/test_source_crotch_bridge_flat_charts.py',
    'flat=oriented["researchOnlyGeometricFlatBridgeCharts"]',
    'flat["nativeBlenderResearchUVLoopCount"] == 18',
    'flat["researchBridgeUVDisplayUnitsAreVerifiedTextileScale"] is False',
    'chart["actualCutEdgeLengthMismatchMm"] >= 0',
    '"metricBridgeFlatChartEvidence": {',
  ]) assert.ok(workflow.includes(needle),needle);
  for(const needle of [
    '"scripts/blender/source-crotch-bridge-flat-charts.py"',
    '"tests/crotch-bridge-flat-charts-native.test.ts"',
  ]) assert.equal(workflow.split(needle).length-1,2,"Research native workflow must trigger in PR and push");
  assert.ok(pure.includes("assert flat == flatten(points,faces,pairs)"));
  assert.ok(pure.includes("must_reject(duplicated, faces,pairs)"));
});
