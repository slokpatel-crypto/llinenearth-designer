import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("native Blender contact evidence measures the unchanged six-panel authoring pipeline",()=>{
  const author=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  const diagnostics=readFileSync("tests/blender/diagnose_garment_contact_stages.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  assert.ok(diagnostics.includes("real_apply = author.apply_modifier"));
  assert.ok(diagnostics.includes("real_apply(obj, modifier)"));
  assert.ok(diagnostics.includes("author.apply_modifier = traced_apply"));
  assert.ok(diagnostics.includes("author.main()"));
  assert.ok(diagnostics.includes("preflight.intersection_pair_count(body, obj)"),
    "measure the same world-space BVH routine as release preflight");
  assert.ok(diagnostics.includes("if count is None:"),
    "missing contact evidence must abort instead of being counted as zero");
  assert.ok(diagnostics.includes("set(observations) != set(author.GARMENT_OBJECTS)"));
  for(const name of ["LE_BODY_CLEARANCE","LE_GARMENT_SMOOTH","LE_CLOTH_THICKNESS"])
    assert.ok(diagnostics.includes(name),name);
  assert.match(diagnostics,/"candidateOnly": True/);
  assert.match(diagnostics,/"productionApproved": False/);
  assert.ok(workflow.includes("--python tests/blender/diagnose_garment_contact_stages.py"));
  assert.ok(workflow.includes("garment-contact-stages.json"));
  assert.ok(workflow.includes("summarize-native-candidate-preflight.py"));
  assert.ok(!author.includes("TITAN_CONTACT_STAGE"),
    "measurement instrumentation must not alter production authoring");
});
