import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=()=>readFileSync("src/app/operator/stock/StockClient.tsx","utf8");
test("stock table never exposes stale physical quantities during load or failure",()=>{
  const s=source();
  const table=s.split('<section className="stockTable">')[1]?.split("</section>")[0]??"";
  assert.match(table,/snapshotState==="ready"&&stock\.map\(\(row\)=>/);
  assert.doesNotMatch(table,/\{stock\.map\(\(row\)=>/);
  assert.match(table,/snapshotState==="loading"&&<p role="status">/);
  assert.match(table,/snapshotState==="error"&&<p role="alert">/);
  assert.match(table,/Previous physical balances are hidden until verification completes/);
  assert.match(table,/snapshotState==="ready"\?"LIVE SNAPSHOT":"SNAPSHOT NOT VERIFIED"/);
});

test("failed stock ledger can be retried explicitly without enabling stock writes",()=>{
  const s=source();
  const table=s.split('<section className="stockTable">')[1]?.split("</section>")[0]??"";
  assert.match(table,/disabled=\{busy\|\|snapshotState==="loading"\}/);
  assert.match(table,/onClick=\{\(\)=>void load\(\)\}/);
  assert.match(table,/Stock balances are unavailable\. Refresh the ledger before recording, reserving or cutting cloth/);
  assert.match(s,/if\(uncertainWriteRef\.current\|\|uncertainWrite\|\|busy\|\|snapshotState!=="ready"\|\|!configured\|\|!mutationGate\.current\.enter\(\)\) return/);
  assert.match(s,/setSnapshotState\("loading"\);[\s\S]*?fetch\("\/api\/operator\/stock",\{cache:"no-store"\}\)/);
  assert.match(s,/setConfigured\(false\);\s*setStock\(\[\]\);\s*setSnapshotState\("error"\);/);
});

test("stock quantity figures require a fresh ready state after errors",()=>{
  const s=source();
  assert.match(s,/snapshotState==="ready"\?\x60\$\{totalAvailable\.toFixed\(3\)\} m\x60:"—"/);
  assert.match(s,/snapshotState==="ready"\?\x60\$\{totalReserved\.toFixed\(3\)\} m\x60:"—"/);
  assert.match(s,/snapshotState==="ready"&&stock\.map/);
});
