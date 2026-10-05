import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Style Director real-model contract carries canonical garment types",()=>{
  const agent=readFileSync("src/lib/style-director-agent.ts","utf8");
  for(const token of [
    "styleSpec: StyleSpecV2",
    "styleSpecForDirectorCandidate",
    'spec.shirt.type="camp_collar_resort"',
    'spec.shirt.type="band_collar_shirt"',
    'spec.shirt.type="casual_shirt"',
    'spec.shirt.type="dress_shirt"',
    'spec.pant.type="wide_leg_relaxed_drape"',
    'spec.pant.type="pleated_trouser"',
    'spec.pant.type="formal_flat_front"',
    "styleSpec=styleSpecForDirectorCandidate(candidate,best.style)",
  ]) assert.ok(agent.includes(token),token);
});

test("Style Director handoff signs and verifies StyleSpec rather than legacy style alone",()=>{
  const handoff=readFileSync("src/lib/designer/style-director-handoff.ts","utf8");
  const api=readFileSync("src/app/api/style-director/handoff/route.ts","utf8");
  const page=readFileSync("src/app/style-director/page.tsx","utf8");
  const designer=readFileSync("src/components/DesignerModule.tsx","utf8");

  assert.ok(handoff.includes('const VERSION="v2"'));
  assert.ok(handoff.includes('version:"linen-earth-style-director-handoff-v2"'));
  assert.ok(handoff.includes("styleSpec:StyleSpecV2"));
  assert.ok(handoff.includes("canonical(payload.styleSpec)===canonical(observed.styleSpec)"));
  assert.ok(api.includes("validateStyleSpecV2(body.styleSpec)"));
  assert.ok(page.includes("styleSpec:JSON.stringify(selectedLook.realModel.styleSpec)"));
  assert.ok(page.includes("styleSpec:selectedLook.realModel.styleSpec"));
  assert.ok(designer.includes('const routedStyleSpec = params.get("styleSpec")'));
  assert.ok(designer.includes("styleSpec:nextStyleSpec || fromLegacyStyle(nextStyle)"));
});

test("Style Director result visibly names the selected garment types",()=>{
  const page=readFileSync("src/app/style-director/page.tsx","utf8");
  assert.ok(page.includes("optionById(selectedLook.realModel.styleSpec.shirt.type)"));
  assert.ok(page.includes("optionById(selectedLook.realModel.styleSpec.pant.type)"));
});
