import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {verifyFabricAnalyzerBatchResult} from "../src/lib/fabric-analyzer-batch-result.ts";

test("every successful and failed fabric retains exactly one ordered result",()=>{
  const response={total:3,succeeded:2,failed:1,results:[
    {index:0,ok:true,fabricId:"fabric-a"},
    {index:1,ok:false,fabricId:"fabric-b",error:"Insufficient source"},
    {index:2,ok:true,fabricId:"fabric-c"},
  ]};
  assert.deepEqual(verifyFabricAnalyzerBatchResult(response,3),{succeeded:2,failed:1});
});

test("HTTP 200 with missing, partial or contradictory accounting never reports completion",()=>{
  const good={total:2,succeeded:1,failed:1,results:[{index:0,ok:true},{index:1,ok:false}]};
  for(const value of [
    null,[],{}, {...good,total:1}, {...good,succeeded:2}, {...good,failed:0},
    {...good,results:good.results.slice(0,1)},
    {...good,results:[good.results[1],good.results[0]]},
    {...good,results:[good.results[0],good.results[0]]},
    {...good,results:[good.results[0],null]},
    {...good,results:[{index:0,ok:"true"},{index:1,ok:false}]},
    {...good,results:[{index:0,ok:false},{index:1,ok:false}]},
  ]) {
    assert.throws(()=>verifyFabricAnalyzerBatchResult(value,2),/did not account for every submitted fabric/i);
  }
});

test("non-finite and invalid counts are rejected instead of coerced to zero",()=>{
  for(const count of [-1,NaN,Infinity,1.5,"1",null]){
    const result={total:1,succeeded:count,failed:0,results:[{index:0,ok:true}]};
    assert.throws(()=>verifyFabricAnalyzerBatchResult(result,1),/did not account/i);
  }
  assert.throws(()=>verifyFabricAnalyzerBatchResult({total:0,succeeded:0,failed:0,results:[]},0));
});

test("real Analyzer batch screen validates API accounting before incrementing success totals",()=>{
  const source=readFileSync("src/app/operator/fabric-analyzer/FabricAnalyzerBatchPanel.tsx","utf8");
  assert.match(source,/verifyFabricAnalyzerBatchResult\(result,items\.length\)/);
  assert.match(source,/succeeded\+=verified\.succeeded/);
  assert.match(source,/failed\+=verified\.failed/);
  assert.doesNotMatch(source,/succeeded\+=Number\(result\.succeeded\|\|0\)/);
  const server=readFileSync("src/app/api/operator/fabric-analyzer/batch/route.ts","utf8");
  assert.match(server,/total:results\.length/);
  assert.match(server,/results\.filter\(\(item\)=>item\.ok\)\.length/);
});
