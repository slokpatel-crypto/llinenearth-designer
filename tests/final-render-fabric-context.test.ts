import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("final-render fabric context preserves each full swatch and separates garments",()=>{
  const source=readFileSync("src/lib/ai-visualization.ts","utf8");

  assert.match(source,/FABRIC_CONTEXT_PANEL_WIDTH=500/);
  assert.match(source,/FABRIC_CONTEXT_HEIGHT=620/);
  assert.match(source,/FABRIC_CONTEXT_GUTTER=32/);
  assert.match(source,/async function fabricContextPanel\(bytes:Buffer\|undefined\)/);
  assert.match(source,/fit:"contain"/);
  assert.match(source,/background:FABRIC_CONTEXT_BACKGROUND/);
  assert.match(source,/withoutEnlargement:false/);
  assert.doesNotMatch(source,/resize\(500,620,\{fit:"cover"\}\)/);
  assert.match(source,/const rightOffset=FABRIC_CONTEXT_PANEL_WIDTH\+FABRIC_CONTEXT_GUTTER/);
  assert.match(source,/width:FABRIC_CONTEXT_PANEL_WIDTH\*2\+FABRIC_CONTEXT_GUTTER/);
  assert.match(source,/\{input:right,left:rightOffset,top:0\}/);
  assert.match(source,/neutral gutter deliberately keeps shirt and trouser references[\s\S]*without adding labels\/text/);
  assert.match(source,/LEFT PANEL is the exact shirt-fabric reference; RIGHT PANEL is the exact trouser-fabric reference\. Ignore the neutral strip between them\./);
  assert.doesNotMatch(source,/LEFT HALF is the exact shirt-fabric reference/);
  assert.match(source,/shirt left panel, neutral separator, trouser right panel/);
  assert.match(source,/webp\(\{quality:96,nearLossless:true,smartSubsample:true\}\)/);
});
