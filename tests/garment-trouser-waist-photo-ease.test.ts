import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("tailored trouser waist respects locked photo width without dropping real-source constraints",()=>{
  const author=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  const identity=JSON.parse(readFileSync("public/model-identity/linen-earth-studio-model-v1.json","utf8"));
  assert.equal(identity.physicalTargetsMm.trouserWaistWidth,344);
  assert.match(author,/hip_half = 0\.172/);
  assert.match(author,/"TrouserWaistFabric": lambda p: z\(0\.455\) <= p\.z <= trouser_waist_upper_z and abs\(p\.x-center_x\) <= hip_half/);
  assert.match(author,/shirt_torso_half_width_at_height\(p\.z, shirt_waist_guide_z, shirt_shoulder_guide_z\)/);
  assert.match(author,/safe_candidate_output\(options.output, bpy\.data\.filepath\)/);
  const preflight=readFileSync("scripts/blender/preflight-linen-earth-officewear.py","utf8");
  assert.match(preflight,/"trouserWaistWidth": 344/);
  assert.match(preflight,/elif count > allowed_pairs:/);
  assert.match(preflight,/elif tuck_overlap > 120:/);
  assert.match(preflight,/"ready": len\(reasons\) == 0/);
});
