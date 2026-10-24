import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/operator/fabric-analyzer/FabricAnalyzerBatchPanel.tsx", "utf8");
const upload = source.slice(source.indexOf("  async function pickFile("), source.indexOf("  async function runBatch()"));
const batch = source.slice(source.indexOf("  async function runBatch()"), source.indexOf("  return <section"));

test("latest selected CSV wins even if an earlier File.text() resolves last", () => {
  assert.ok(source.includes("const csvRevisionRef=useRef(0);"));
  assert.ok(upload.includes("const revision=++csvRevisionRef.current;"));
  assert.ok(upload.includes("const text=await file.text();"));
  assert.ok(upload.includes("if(runningRef.current || csvRevisionRef.current!==revision) return;"));
  assert.ok(upload.indexOf("if(runningRef.current || csvRevisionRef.current!==revision) return;") < upload.indexOf("setCsvText(text);"));
  assert.equal(upload.match(/csvRevisionRef.current!==revision/g)?.length, 2, "also suppress stale file-read errors");
});

test("manual worksheet editing invalidates any unresolved file import", () => {
  const manual = source.slice(source.indexOf("  function editCsvText("), source.indexOf("  async function pickFile("));
  assert.ok(manual.includes("if(runningRef.current) return;"));
  assert.ok(manual.includes("csvRevisionRef.current+=1;"));
  assert.ok(manual.indexOf("csvRevisionRef.current+=1;") < manual.indexOf("setCsvText(value);"));
  assert.ok(source.includes("onChange={(event)=>editCsvText(event.target.value)}"));
});

test("starting a batch makes already-pending CSV reads obsolete", () => {
  assert.ok(batch.includes("if(runningRef.current || worksheet.error || !runnable.length) return;"));
  assert.ok(batch.includes("runningRef.current=true;\n    csvRevisionRef.current+=1;"));
  assert.ok(batch.indexOf("csvRevisionRef.current+=1;") < batch.indexOf("setRunning(true);"));
});

test("failed reads surface an error without overwriting the previous worksheet", () => {
  const catchBody=upload.slice(upload.indexOf("}catch{"));
  assert.ok(catchBody.includes("if(runningRef.current || csvRevisionRef.current!==revision) return;"));
  assert.ok(catchBody.includes("setMessage(`Could not read ${file.name}. Please choose a valid CSV file.`);"));
  assert.ok(!catchBody.includes("setCsvText("));
});

test("the native picker resets so reselecting the same file always fires a change", () => {
  assert.ok(source.includes('event.currentTarget.value="";void pickFile(file);'));
  assert.ok(source.includes('disabled={running} onChange={(event)=>{const file=event.currentTarget.files?.[0]||null;'));
});
