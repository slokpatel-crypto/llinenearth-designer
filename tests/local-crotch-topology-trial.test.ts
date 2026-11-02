import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("optional native inner-crotch topology experiment never changes default garment fit",()=>{
  const code=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  for(const text of [
    '"--experimental-local-crotch-cuts", type=int, choices=(0, 1, 2), default=0',
    'if obj.name not in ("TrouserLegLFabric", "TrouserLegRFabric") or cuts == 0:',
    'bmesh.ops.subdivide_edges(bm, edges=selected, cuts=cuts, use_grid_fill=True)',
    'abs(mid.x - center_x) <= 0.030',
    'abs(mid.y) <= 0.150',
    'lower <= mid.z <= upper',
    'trial_local_crotch_edge_refinement(obj, body_center_x, body_min_z, body_height, crotch_cuts)',
    'if len(obj.data.vertices) <= before_vertices or len(obj.data.polygons) <= before_faces:',
    'options.experimental_waist_refinement_level, waist_extra_m,',
    'crotch_cuts, center_x, min_z, height',
    '"linen_earth_experimental_local_crotch_cuts"',
    'safe_candidate_output(options.output, bpy.data.filepath)',
  ]) assert.ok(code.includes(text),text);
  assert.ok(!code.includes('default=1,\n                        help="Research only: subdivide measured inner-crotch'),
    "trial must never become default");
  for(const text of [
    'for cuts in 1 2; do',
    'TITAN_REAL_LOCAL_CROTCH_REFINEMENT_EXPERIMENT_RECORDED_CANDIDATE_ONLY',
    'assert standard["rejectionReasonCount"] == 10',
    'assert standard["boundaryIntersections"]["garmentLegToLeg"] == 89',
    'assert data["preflightReady"] is False',
    'assert contact["garmentLegToLeg"] == diag["measurements"]["legLegPolygonContactPairs"]',
    '"worsenedActualCollisionTypes": regressions',
    '"mayAutoPromote": False',
    'assert item["productionApproved"] is False',
  ]) assert.ok(workflow.includes(text),text);
});
