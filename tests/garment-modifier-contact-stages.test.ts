import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("real Blender source records full garment-body intersection stages without weakening fit",()=>{
  const author=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  const routine=author.slice(author.indexOf("def fit_shell("),author.indexOf("def planar_grain_uv("));
  assert.ok(routine.startsWith("def fit_shell("),"actual authoring must be present");
  for(const stage of ["selectedBodyShell","afterSmoothing","afterBodyClearance","afterClothThickness"]){
    assert.ok(routine.includes('record_stage("'+stage+'")'),"missing measured "+stage);
  }
  assert.ok(author.includes("BVHTree.FromPolygons"),"contact counts must use real Blender geometry");
  assert.ok(author.includes("epsilon=0.0005"),"preserve original world-space preflight epsilon");
  assert.ok(routine.includes('shrink.wrap_mode = "OUTSIDE_SURFACE"'),"never silently change original clearance mode");
  assert.ok(routine.includes('solid.thickness = thickness_m'));
  assert.ok(author.includes("safe_candidate_output(options.output, bpy.data.filepath)"));
  const diagnostic=readFileSync("scripts/blender/diagnose-linen-earth-contact.py","utf8");
  assert.ok(diagnostic.includes("verified_modifier_stages(obj, source_polygon_tree)"));
  assert.ok(diagnostic.includes("final_measured = len(body_polygon_tree.overlap(polygon_world_bvh(obj)))"));
  assert.ok(diagnostic.includes('"productionApproved": False'));
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  assert.ok(workflow.includes("test_garment_modifier_contact_stages.py"));
  assert.ok(workflow.includes('contact-diagnostics.json'));
  assert.ok(workflow.includes("scripts/blender/summarize-native-candidate-preflight.py"));
});
