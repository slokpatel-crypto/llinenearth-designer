import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {describeBatchStop,describeBatchRefreshFailure} from "../src/lib/fabric-analyzer-batch-messages.ts";

test("network error distinguishes confirmed rows from an unverified current chunk",()=>{
  const message=describeBatchStop({total:26,succeeded:10,failed:2,error:"Network timeout."});
  assert.match(message,/12\/26 rows have confirmed outcomes/);
  assert.match(message,/10 analyzed, 2 failed/);
  assert.match(message,/current chunk's result is unknown/);
  assert.match(message,/inspect saved Analyzer profiles before retrying/);
  assert.doesNotMatch(message,/all.*failed/i);
});

test("first failed chunk never claims no server work was done",()=>{
  const message=describeBatchStop({total:12,succeeded:0,failed:0,error:"Malformed response"});
  assert.match(message,/0\/12 rows have confirmed outcomes/);
  assert.match(message,/result is unknown/);
});

test("a failed view refresh does not falsely report a failed ingestion",()=>{
  const message=describeBatchRefreshFailure(12,1);
  assert.match(message,/Batch processing finished: 12 analyzed, 1 failed/);
  assert.match(message,/operator view could not refresh/);
  assert.match(message,/reload the page instead of resubmitting/);
});

test("operator UI catches post-ingestion refresh separately from processing failures",()=>{
  const ui=readFileSync("src/app/operator/fabric-analyzer/FabricAnalyzerBatchPanel.tsx","utf8");
  assert.ok(ui.includes("import { describeBatchStop, describeBatchRefreshFailure }"));
  assert.ok(ui.includes("await onComplete?.();"));
  const completion=ui.slice(ui.indexOf("      setMessage(`Batch complete:"),ui.indexOf("    }finally{",ui.indexOf("      setMessage(`Batch complete:")));
  assert.match(completion,/await onComplete\?\.\(\);\s*}catch\{\s*setMessage\(describeBatchRefreshFailure\(succeeded,failed\)\)/);
  assert.ok(completion.includes("setMessage(describeBatchStop({"));
  assert.ok(completion.includes("total:runnable.length"));
});
