import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync("src/app/operator/fabric-analyzer/FabricAnalyzerBatchPanel.tsx","utf8");

test("operator batch uses synchronous ref lock before React rerenders",()=>{
  assert.ok(source.includes("const runningRef=useRef(false)"));
  assert.ok(source.includes("if(runningRef.current || worksheet.error || !runnable.length) return;"));
  assert.ok(source.includes("runningRef.current=true;"));
  assert.ok(source.includes("runningRef.current=false;"));
  assert.ok(source.indexOf("runningRef.current=true;") < source.indexOf("setRunning(true);"));
  assert.ok(source.indexOf("runningRef.current=false;") < source.indexOf("setRunning(false);"));
});

test("operator worksheet is immutable during in-flight ingestion",()=>{
  assert.ok(source.includes("<textarea value={csvText} disabled={running}"));
  assert.ok(source.includes('type="file" accept=".csv,text/csv" hidden disabled={running}'));
  assert.ok(source.includes("if(!file || runningRef.current) return;"));
  assert.ok(source.includes("const text=await file.text();"));
  assert.ok(source.includes("if(runningRef.current) return;"));
  assert.ok(source.includes("setCsvText(text);"));
});

test("template/picker actions cannot edit active batch inputs",()=>{
  assert.ok(source.includes("async function downloadTemplate(){\n    if(runningRef.current) return;"));
  assert.ok(source.includes("disabled={running} onClick={()=>void downloadTemplate()}"));
  assert.ok(source.includes("disabled={running} onClick={()=>fileRef.current?.click()}"));
});
