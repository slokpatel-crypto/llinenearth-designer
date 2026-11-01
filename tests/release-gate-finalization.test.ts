import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("TITAN M149 readiness cannot report a pass before the final release contract",()=>{
  const script=readFileSync("scripts/release-readiness.mjs","utf8");
  const lastGate=script.lastIndexOf("requireTokens(");
  const finalFailure=script.lastIndexOf("if (failed) {");
  const finalSuccess=script.lastIndexOf('console.log("\\nLinen Earth release foundation is ready.");');
  assert.ok(lastGate>0&&finalFailure>lastGate&&finalSuccess>finalFailure,
    "ALL appended release gates must run BEFORE the final failed-check and pass report");
  assert.equal(script.match(/if \(failed\) \{/g)?.length,1,
    "Never permit an early success decision before a later release gate");
  assert.equal(script.slice(finalSuccess).includes("requireTokens("),false,
    "A silently ignored release gate was appended after the ready message");
  for(const marker of [
    "M140: the native helper alone is insufficient",
    "M149: same original UUID with changed write epoch",
    "verify-production-native-web-locks-browser.cjs",
    "verify-production-status-receipt-same-key-epoch-browser.cjs",
  ])assert.ok(script.slice(0,finalFailure).includes(marker),
    "A critical signed browser safety gate must precede the final outcome: "+marker);
});
