import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const fixture=createRequire(import.meta.url)("../scripts/ci-verified-stock-fixture.cjs") as {
  rowsFor:(input:unknown)=>unknown;
  metadataRowsFor:(method:string,path:string,apiKey:string)=>unknown;
  FIXTURE_KEY:string;
};

test("isolated CI fixture supplies exact synthetic rows, never real supplier evidence",()=>{
  assert.deepEqual(fixture.rowsFor({p_fabric_ids:["shirt-1","trouser-2"]}),[
    {fabric_id:"shirt-1",available_metres:"5.000",provenance_ready:true,
      manual_event_count:1,provenance_event_count:1,legacy_unverified_event_count:0},
    {fabric_id:"trouser-2",available_metres:"5.000",provenance_ready:true,
      manual_event_count:1,provenance_event_count:1,legacy_unverified_event_count:0},
  ]);
  for(const input of [null,{},[],{p_fabric_ids:["dup","dup"]},
    {p_fabric_ids:[" good"]},{p_fabric_ids:[["coerced"]]},
    {p_fabric_ids:Array.from({length:501},(_,i)=>String(i))}]){
    assert.equal(fixture.rowsFor(input),null);
  }
});

test("CI stock fixture refuses to start outside GitHub Actions",()=>{
  const {GITHUB_ACTIONS,CI,...safeEnv}=process.env;
  const result=spawnSync(process.execPath,["scripts/ci-verified-stock-fixture.cjs"],{
    cwd:process.cwd(),env:safeEnv,encoding:"utf8",timeout:3000,
  });
  assert.equal(result.status,2);
  assert.match(result.stderr,/Refusing synthetic stock fixture outside GitHub Actions CI/);
});


test("CI-only metadata fixture distinguishes reachable empty ledger from failed lookup",()=>{
  const valid="/rest/v1/style_events?select=at%2Cpayload&type=eq.operator_note&source=eq.operator&order=at.desc&limit=1000";
  assert.deepEqual(fixture.metadataRowsFor("GET",valid,fixture.FIXTURE_KEY),[]);
  for(const [method,path,key] of [
    ["POST",valid,fixture.FIXTURE_KEY],
    ["GET",valid,"not-a-ci-key"],
    ["GET","/rest/v1/style_events?type=eq.any&source=eq.operator",fixture.FIXTURE_KEY],
    ["GET","/rest/v1/style_events?type=eq.operator_note&source=eq.any",fixture.FIXTURE_KEY],
    ["GET","/rest/v1/rpc/fabric_stock_snapshot_v2",fixture.FIXTURE_KEY],
  ])assert.equal(fixture.metadataRowsFor(method,path,key),null);
});
