import test from "node:test";
import assert from "node:assert/strict";
import { buildDesignerBenchmarkCases, DESIGNER_BENCHMARK_VERSION } from "../src/lib/designer/benchmark.ts";

const shirts=Array.from({length:13},(_,i)=>({id:`shirt-${String(i+1).padStart(2,"0")}`}));
const pants=Array.from({length:9},(_,i)=>({id:`pant-${String(i+1).padStart(2,"0")}`}));

test("Designer benchmark matrix is stable and covers 48 context cases",()=>{
  const first=buildDesignerBenchmarkCases(shirts,pants);
  const second=buildDesignerBenchmarkCases([...shirts].reverse(),[...pants].reverse());
  assert.equal(DESIGNER_BENCHMARK_VERSION,"designer-benchmark-v1");
  assert.equal(first.length,48);
  assert.deepEqual(first,second);
  assert.equal(new Set(first.map((item)=>item.id)).size,48);
  assert.deepEqual(new Set(first.map((item)=>item.occasion)),new Set(["Casual","Smart-Casual","Semi-Formal","Formal"]));
  assert.deepEqual(new Set(first.map((item)=>item.climate)),new Set(["Not specified","Hot / humid","Cool","Air-conditioned"]));
  assert.deepEqual(new Set(first.map((item)=>item.intention)),new Set(["Understated","Balanced","Expressive"]));
  assert(first.some((item)=>item.anchorShirtId!=="shirt-01"));
  assert(first.some((item)=>item.anchorPantId!=="pant-01"));
});

test("Designer benchmark stays empty when a garment side has no stock",()=>{
  assert.deepEqual(buildDesignerBenchmarkCases([],pants),[]);
  assert.deepEqual(buildDesignerBenchmarkCases(shirts,[]),[]);
});
