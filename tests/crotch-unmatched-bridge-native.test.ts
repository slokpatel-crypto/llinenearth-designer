import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("four actual unmatched cut edges are only bridged in research mesh with strict native geometry checks",()=>{
  const code=readFileSync("scripts/blender/prototype-crotch-unmatched-source-bridge.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  for(const needle of [
    'IDENTITY = "linen-earth-studio-model-v1"',
    'STAGE = "selectedBodyShell"',
    'len(research.objects)!=8',
    'reciprocal_real_vertex_matches',
    'if len(l_remaining)!=4 or len(r_remaining_mapped)!=4:',
    'MAX_UNMATCHED_MM = 80.0',
    'seam_connector_faces',
    'mesh.from_pydata(merged_verts,[],all_faces)',
    'if any(n>2 for n in owners.values()):',
    'degenerate=sum(not math.isfinite(p.area)',
    'bridge_body_overlaps=body_tree.overlap(geom_ops["real_tree"](bridge_geom))',
    'bridge_body_pairs=len(bridge_body_overlaps)',
    '"actualBodyContactByOriginalCutEdgePair":per_bridge_pair',
    'obj.hide_render=True',
    'obj["candidateOnly"]=True',
    'obj["productionApproved"]=False',
    'obj["sewnGarmentApproved"]=False',
    '"finalClothQAApproved":False',
    '"changesProductionGeometry":False',
    'if export.objects.get(name) is not None:',
    'TITAN_ORIGINAL_FOUR_CROTCH_EDGES_BRIDGED_RESEARCH_ONLY',
  ]) assert.ok(code.includes(needle),needle);
  assert.ok(!code.includes("bpy.ops."),"Do not save or mutate original source");
  assert.ok(!code.includes("save_as_mainfile"));
  assert.ok(code.includes("research.objects.link(obj)"));
  assert.ok(code.includes("if export.objects.get(name) is not None:"));
  for(const required of [
    '"scripts/blender/prototype-crotch-unmatched-source-bridge.py"',
    '"tests/crotch-unmatched-bridge-native.test.ts"',
    'scripts/blender/prototype-crotch-unmatched-source-bridge.py --',
    'trial["unmatchedCutEdgesBefore"] == {"left":4,"right":4}',
    'assert trial["changesProductionGeometry"] is False',
    'assert trial["degenerateFaces"] == trial["nonManifoldEdges"] == 0',
    'assert physical["preflightReady"] is False and physical["rejectionReasonCount"] == 10',
    'TITAN_REAL_FOUR_EDGE_CROTCH_BRIDGE_MEASURED_NEVER_PRODUCTION_APPROVED',
    'titan-candidate-evidence/crotch-unmatched-bridge-research-only.json',
  ]) assert.ok(workflow.includes(required),required);
  for(const entry of ['"scripts/blender/prototype-crotch-unmatched-source-bridge.py"',
                      '"tests/crotch-unmatched-bridge-native.test.ts"'])
    assert.equal(workflow.split(entry).length-1,2,entry);
});
