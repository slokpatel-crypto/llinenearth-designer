import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("real crotch seam-locality evidence uses actual original boundary and never promotes geometry",()=>{
  const diagnostic=readFileSync("scripts/blender/diagnose-crotch-seam-proximity.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  for(const required of [
    'IDENTITY = "linen-earth-studio-model-v1"',
    'scene.get("linen_earth_research_crotch_stages_emitted") is not True',
    'research = bpy.data.collections.get(RESEARCH)',
    'source.get("candidateOnly") is not True',
    'source.get("productionApproved") is not False',
    'or source.get("sourceStage") != CUT_STAGE',
    'def actual_centerline_source_segments(geom, center_x):',
    'if any(n > 2 for n in edges.values()):',
    'nearest_segment_distance_mm(center(geometry[side], face), seams[side])',
    '"contactPairProximityBinsMm": bins',
    '"candidateOnly": True',
    '"productionApproved": False',
    '"changesProductionGeometry": False',
    '"physicalFitApproved": False',
    '"metricCaveat":',
  ]) assert.ok(diagnostic.includes(required),required);
  for(const required of [
    '"scripts/blender/diagnose-crotch-seam-proximity.py"',
    '"tests/crotch-source-seam-proximity.test.ts"',
    'scripts/blender/diagnose-crotch-seam-proximity.py --',
    'TITAN_REAL_CROTCH_SEAM_SOURCE_LOCALITY_MEASURED_NOT_SEWING_APPROVED',
    'count == measured["actualFinalLegLegBVHPairs"]',
    'count == stages["actualFinalGarmentLegContactPairs"]',
    'assert actual["rejectionReasonCount"] == 10',
    'assert measured["changesProductionGeometry"] is False',
    'assert 0 <= bucket["bothLegFacesNear"] <= bucket["eitherLegFaceNear"] <= count',
    'titan-candidate-evidence/crotch-source-seam-proximity.json',
  ]) assert.ok(workflow.includes(required),required);
  assert.equal((workflow.match(/- name: Measure genuine source cut-boundary proximity/g)||[]).length,1);
  assert.equal((workflow.match(/"scripts\/blender\/diagnose-crotch-seam-proximity.py"/g)||[]).length,2);
  assert.equal((workflow.match(/"tests\/crotch-source-seam-proximity.test.ts"/g)||[]).length,2);
});
