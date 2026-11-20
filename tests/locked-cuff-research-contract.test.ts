import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("native source cuff geometry research preserves unchanged body and rejects false fit",()=>{
  const script=readFileSync("scripts/blender/research-locked-cuff-alignment.py","utf8");
  const native=readFileSync("tests/blender/test_locked_cuff_research.py","utf8");
  const validation=readFileSync("tests/python/test_locked_cuff_research_report.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-research-cuff-alignment.yml","utf8");
  for(const token of [
    'ID="linen-earth-studio-model-v1"',
    'PHOTO="/designer/studio-tucked.webp"',
    'SHIFTS=(0.,10.,20.,30.,37.)',
    'def contact_counts(objects)',
    'def move_cuffs(objects,heights,shift_mm)',
    'originalSourcePreserved":True',
    'if not 540<=spacing<=620:',
  ]) assert.ok(script.includes(token),token);
  assert.match(script,/len\(counts\)!=21/);
  assert.match(script,/restore\(objs,vertices\)/);
  assert.match(script,/hashlib\.sha256\(src\.read_bytes\(\)\)\.hexdigest\(\)!=sha/);
  assert.match(native,/TITAN_NATIVE_BOUND_CUFF_GEOMETRY_RESEARCH_FIXTURES_PASSED/);
  assert.match(validation,/New true garment contact was hidden/);
  assert.match(validation,/Falsified original identity or physical approval/);
  assert.match(workflow,/TITAN_CUFF_NATIVE_REPORT_VERIFIED/);
  assert.match(workflow,/tests\/blender\/test_locked_cuff_research\.py/);
  assert.match(workflow,/--python scripts\/blender\/research-locked-cuff-alignment\.py/);
  assert.doesNotMatch(workflow,/public\/models\//);
});
