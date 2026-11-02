import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("actual original crotch cut vertices are welded only in a non-export research mesh",()=>{
  const script=readFileSync("scripts/blender/prototype-crotch-source-seam-weld.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  for(const term of [
    'IDENTITY = "linen-earth-studio-model-v1"',
    'TOLERANCE_M = 0.0005',
    'STAGE = "selectedBodyShell"',
    'len(research.objects) != 8',
    'def reciprocal_real_vertex_matches(',
    'reverse_li != li or distance > TOLERANCE_M',
    'if sewn_edges == 0:',
    'if len(left_cut) != 14 or len(right_cut) != 14:',
    'if counts["closedBoundaryEdges"] != 2 * sewn_edges or counts["nonManifoldEdges"] != 0:',
    'if len(after_open) >= len(before_open_l) + len(before_open_r):',
    'if obj.name in bpy.data.collections["LinenEarthExport"].objects:',
    'mesh.from_pydata(vertices, [], polygons)',
    'if any(n > 2 for n in incidence.values()):',
    'sum(p.area <= 1e-12 or not math.isfinite(p.area)',
    'obj.hide_render = True',
    'obj["candidateOnly"] = True',
    'obj["productionApproved"] = False',
    'obj["physicalFitApproved"] = False',
    '"changesProductionGeometry": False',
    '"sewnGarmentApproved": False',
    'source["world_geometry"]',
    'TITAN_REAL_ORIGINAL_CROTCH_SOURCE_SEAM_WELD_TRIAL_UNAPPROVED',
  ]) assert.ok(script.includes(term),term);
  assert.ok(!script.includes("bpy.ops."),"a research mesh must not be written or exported");
  assert.ok(!script.includes("save_as_mainfile"));
  for(const term of [
    '"scripts/blender/prototype-crotch-source-seam-weld.py"',
    '"tests/crotch-source-weld-native.test.ts"',
    'scripts/blender/prototype-crotch-source-seam-weld.py --',
    'physical["preflightReady"] is False and physical["rejectionReasonCount"] == 10',
    'trial["sewnGarmentApproved"] is False',
    'counts["nonManifoldEdges"] == counts["degenerateFaces"] == 0',
    'counts["closedBoundaryEdges"] == 2*trial["actualJoinedInnerCutEdges"] > 0',
    'physical["boundaryIntersections"]["garmentLegToLeg"] == 89',
    'TITAN_ORIGINAL_CROTCH_SEAM_VERTEX_WELD_RESEARCH_ONLY_NOT_CLOTH_APPROVED',
    'titan-candidate-evidence/crotch-source-weld-research-only.json',
  ]) assert.ok(workflow.includes(term),term);
  const paths=['"scripts/blender/prototype-crotch-source-seam-weld.py"',
               '"tests/crotch-source-weld-native.test.ts"'];
  for(const p of paths) assert.equal(workflow.split(p).length-1,2,p);
});
