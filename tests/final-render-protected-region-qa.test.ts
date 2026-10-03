import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("front photoreal QA measures protected model and studio drift before semantic review",()=>{
  const source=readFileSync("src/lib/ai-visualization.ts","utf8");

  assert.match(source,/protectedRegionChangePercent/);
  assert.match(source,/classifyProtectedRegionChange/);
  assert.match(source,/if\(view==="front"\)/);
  assert.match(source,/const protectedDeltas=PROTECTED_RENDER_BOXES\.map\(\(box\)=>boxDelta\(reference,output,box\)\)/);
  assert.match(source,/protectedRegionStatus=classifyProtectedRegionChange\(protectedRegionChange\)/);
  assert.match(source,/Deterministic protected-region check for the front view/);
  assert.match(source,/const codeProtected=protectedRegionStatus==="unavailable" \? null : protectedRegionStatus/);
  assert.match(source,/mannequinConsistency:combinedMannequin/);
  assert.match(source,/Restore the locked mannequin and studio outside the garment edit region/);
  assert.match(source,/protectedRegionChange,protectedRegionStatus/);
});

test("secondary camera views do not compare against front-only protected coordinates",()=>{
  const source=readFileSync("src/lib/ai-visualization.ts","utf8");
  const inspection=source.slice(
    source.indexOf("export async function inspectSelectedLookFashnOutput"),
    source.indexOf("function semanticCheckNeedsReview"),
  );
  assert.match(inspection,/if\(view==="front" \|\| shirtMeasured \|\| pantMeasured \|\| hasPatternTarget\)/);
  assert.match(inspection,/if\(view==="front"\) \{/);
  assert.doesNotMatch(inspection,/view!=="front"[\s\S]*protectedRegionChangePercent/);
});
