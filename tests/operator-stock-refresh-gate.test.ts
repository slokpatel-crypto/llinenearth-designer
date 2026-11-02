import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=()=>readFileSync("src/app/operator/stock/StockClient.tsx","utf8");

test("stock ledger reload suppresses previously verified metres while fetching",()=>{
  const s=source();
  const load=s.split("  async function load():Promise<boolean>{")[1]?.split("  useEffect(")[0]??"";
  assert.ok(load.includes('setSnapshotState("loading")'));
  assert.ok(load.indexOf('setSnapshotState("loading")')<load.indexOf('fetch("/api/operator/stock"'));
  assert.match(load,/if\(!response\.ok\) throw new Error\("Stock ledger request failed\."\)/);
  assert.match(load,/data\.configured!==true/);
  assert.match(load,/setConfigured\(true\);\s*setStock\(data\.stock as StockRow\[\]\);\s*setSnapshotState\("ready"\);\s*return true/);
  assert.match(load,/catch\{\s*\/\/ Never show[\s\S]*setConfigured\(false\);\s*setStock\(\[\]\);\s*setSnapshotState\("error"\);\s*return false/);
});

test("stock login redirect and malformed HTTP 200 fail closed",()=>{
  const load=source().split("  async function load():Promise<boolean>{")[1]?.split("  useEffect(")[0]??"";
  assert.match(load,/if\(response\.status===401\)\{\s*setConfigured\(false\);setStock\(\[\]\);setSnapshotState\("error"\);/);
  assert.match(load,/window\.location\.href="\/operator\/login\?next=\/operator\/stock";\s*return false/);
  assert.ok(load.includes('!("configured" in data)||data.configured!==true'));
});

test("valid stock mutation acknowledgment cannot masquerade as refreshed live stock",()=>{
  const s=source();
  const post=s.split("  async function post(")[1]?.split("  const totalAvailable=")[0]??"";
  const ack=post.indexOf("requireStockClientAcknowledgment(body.action,data)");
  const loaded=post.indexOf("const refreshed=await load()");
  const message=post.indexOf("setMessage(refreshed?success:");
  assert.ok(ack>=0&&loaded>ack&&message>loaded);
  assert.match(post,/Stock operation acknowledged, but ledger refresh is unavailable\. Check the ledger before retrying\./);
  assert.doesNotMatch(post,/setMessage\(success\);await load\(\)/);
  assert.match(post,/finally\\{[\\s\\S]*mutationGate\\.current\\.exit\\(\\);setBusy\\(false\\);/);
  assert.ok(post.indexOf("uncertainJournal.current.clearPending()")<
    post.indexOf("mutationGate.current.exit();setBusy(false);"),
    "pending stock state must be resolved before the client-side mutation gate unlocks");
  assert.ok(s.includes('disabled={uncertainWrite||busy||snapshotState!=="ready"||'),
    "writes remain prohibited until the next successful ledger refresh");
});
