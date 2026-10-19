import test from "node:test";
import assert from "node:assert/strict";
import {PREVIEW_BENCHMARK_COHORTS,previewBenchmarkWarmupSample} from "../src/lib/designer/preview-performance-cohorts.ts";

test("CPU preview benchmark warm-up covers all eight front/back × body-build cohorts equally",()=>{
  const counts=new Map<string,number>();
  for(let i=0;i<1200;i++){
    const {view,build,key}=previewBenchmarkWarmupSample(i);
    assert.equal(key,`${view}/${build}`);
    counts.set(key,(counts.get(key)||0)+1);
  }
  assert.equal(PREVIEW_BENCHMARK_COHORTS.length,8);
  assert.deepEqual([...counts.keys()].sort(),[...PREVIEW_BENCHMARK_COHORTS].sort());
  for(const name of PREVIEW_BENCHMARK_COHORTS) assert.equal(counts.get(name),150,`${name} must receive equal warm-up`);
});

test("invalid warm-up indices cannot silently skip or duplicate a performance cohort",()=>{
  for(const bad of [-1,NaN,Infinity,1.2,Number.MAX_SAFE_INTEGER+1]){
    assert.throws(()=>previewBenchmarkWarmupSample(bad),RangeError);
  }
});
