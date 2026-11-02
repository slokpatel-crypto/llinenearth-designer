import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {stockWritesEnabled} from "../src/lib/designer/stock-write-rollout.ts";

test("stock movement rollout is denied by default; only exact server opt-in enables it",()=>{
  for(const setting of [undefined,"","disabled","true","1","ENABLED","enabled "," enabled","yes"])
    assert.equal(stockWritesEnabled(setting),false,String(setting));
  assert.equal(stockWritesEnabled("enabled"),true);
});

test("stock POST checks rollout approval after authentication/origin and before parsing or touching RPC",()=>{
  const src=readFileSync("src/app/api/operator/stock/route.ts","utf8");
  const post=src.split("export async function POST(")[1]??"";
  const auth=post.indexOf("if(!await authorized())");
  const origin=post.indexOf("stockMutationRequestError(request)");
  const gate=post.indexOf("if(!stockWritesEnabled())");
  const parse=post.indexOf("readBoundedStockMutationJson(request)");
  const rpc=post.indexOf('rpc<string>("fabric_stock_record_v3"');
  assert.ok(auth>=0&&origin>auth&&gate>origin&&parse>gate&&rpc>parse,
    "only authorized same-origin callers can be evaluated; disabled rollout must block all writes before any privileged RPC");
  assert.match(post,/Stock writes are disabled pending rollout approval\./);
  const get=src.split("export async function GET(")[1]?.split("export async function POST(")[0]??"";
  assert.ok(get.includes("writesEnabled:stockWritesEnabled()"));
  assert.ok(get.includes("writesEnabled:false"));
  assert.ok(get.includes('rpc<unknown>("fabric_stock_snapshot_v2"')||
    get.includes('"fabric_stock_snapshot_v2"'),
    "read-only flag must never make the existing ledger unreadable");
  assert.match(src,/cache-control":"private, no-store"/);
});

test("operator stock actions require server-confirmed rollout AND verified ledger",()=>{
  const src=readFileSync("src/app/operator/stock/StockClient.tsx","utf8");
  const load=src.split("  async function load():Promise<boolean>{")[1]?.split("  useEffect(")[0]??"";
  assert.match(src,/useState\(false\)/);
  assert.match(load,/typeof data\.writesEnabled!=="boolean"/);
  assert.match(load,/setWritesEnabled\(data\.writesEnabled\)/);
  assert.match(load,/catch\{[\s\S]*setWritesEnabled\(false\)/);
  assert.match(src,/Stock ledger is readable, but all stock movements are disabled/);
  const submit=src.split("  async function post(")[1]?.split("  const totalAvailable=")[0]??"";
  assert.ok(submit.indexOf('if(!writesEnabled){mutationGate.current.exit();return;}')<
    submit.indexOf('fetch("/api/operator/stock"'),
    "UI must refuse a click even if disabled buttons are bypassed");
  assert.match(submit,/if\\(httpStatus===423\\)\\{[\\s\\S]*setWritesEnabled\\(false\\)/);
  assert.ok(submit.indexOf("setWritesEnabled(false)")<submit.indexOf("mutationGate.current.exit();setBusy(false);"));
  const matches=src.match(/disabled=\{uncertainWrite\|\|busy\|\|snapshotState!=="ready"\|\|!configured\|\|!writesEnabled\|\|/g)??[];
  assert.equal(matches.length,4,
    "record, reserve, consume, and release must all be disabled when rollout is off");
});
