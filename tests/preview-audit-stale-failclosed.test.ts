import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(
  "src/app/operator/preview-option-coverage/PreviewOptionCoverageClient.tsx","utf8"
);

test("preview audit fails closed when a stale or malformed fetch cannot validate latest approval",()=>{
  assert.ok(source.includes('useState<"loading"|"ready"|"error">("loading")'));
  assert.ok(source.includes("const epoch=++loadEpoch.current"));
  assert.ok(source.includes('if(epoch!==loadEpoch.current) return false'));
  assert.ok(source.includes('setSummary(null)'));
  assert.ok(source.includes('setRows([]);setSummary(null);setConfigured(false)'));
  assert.ok(source.includes('setSelectedId("");setNote("")'));
  assert.ok(source.includes('typeof data.summary.gateComplete!=="boolean"'));
  assert.ok(source.includes('typeof data.summary.catalogueComplete!=="boolean"'));
  assert.ok(source.includes('setSnapshotState("error")'));
});

test("operator preview audit cannot approve while loading, failed or backend unconfigured",()=>{
  assert.ok(source.includes('if(!selected||busy||!configured||snapshotState!=="ready") return;'));
  assert.ok(source.includes('disabled={busy||snapshotState!=="ready"||!configured}'));
  assert.ok(source.includes('disabled={busy||snapshotState!=="ready"||!configured||selected.livePreview==="none"'));
  assert.ok(source.includes('snapshotState!=="ready"?"UNVERIFIED"'));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("Refresh preview evidence"));
});
