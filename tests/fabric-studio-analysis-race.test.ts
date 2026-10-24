import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync("src/components/FabricStudio.tsx","utf8");

test("Fabric Studio invalidates old asynchronous results on all selection boundaries",()=>{
  for(const boundary of [
    /function changeSource\(next: SourceMode\)\s*\{\s*analysisRevision\.current \+= 1/,
    /function changeGarment\(next: GarmentKind\)\s*\{\s*analysisRevision\.current \+= 1/,
    /function chooseStock\(fabric: FabricColorway\)\s*\{\s*analysisRevision\.current \+= 1/,
    /function loadFile\(next: File \| null\)\s*\{\s*if \(!next\) return;\s*analysisRevision\.current \+= 1/,
    /onClick=\{\(\) => \{ analysisRevision\.current \+= 1; setStockLine\(line\)/,
    /useEffect\(\(\) => \(\) => \{ analysisRevision\.current \+= 1; \}, \[\]\)/
  ]){
    assert.match(source,boundary);
  }
});

test("late or superseded fabric analysis must not commit profile, mode or errors",()=>{
  assert.match(source,/const revision = \+\+analysisRevision\.current/);
  assert.match(source,/const selectedFile = file/);
  assert.match(source,/const consentForRequest = aiConsent/);
  assert.match(source,/await extractVisualSignals\(selectedFile\);\s*if \(revision !== analysisRevision\.current\) return/);
  assert.match(source,/await fileToBase64\(selectedFile\);\s*if \(revision !== analysisRevision\.current\) return/);
  assert.match(source,/const data = await response\.json\(\);\s*if \(revision !== analysisRevision\.current\) return/);
  assert.match(source,/catch \(caught\) \{\s*if \(revision !== analysisRevision\.current\) return/);
});

test("consent cannot change halfway through an in-flight fabric scan",()=>{
  assert.match(source,/const consentForRequest = aiConsent/);
  assert.match(source,/checked=\{aiConsent\} disabled=\{status === "analyzing"\}/);
});
