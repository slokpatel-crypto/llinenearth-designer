import test from "node:test";
import assert from "node:assert/strict";
import { nextUnlabelledBenchmarkIndex } from "../src/lib/designer/benchmark-progress.ts";

test("Designer benchmark advances to the next unlabelled case",()=>{
  const ids=["a","b","c","d"];
  assert.equal(nextUnlabelledBenchmarkIndex(ids,new Set(["a","b"]),0),2);
  assert.equal(nextUnlabelledBenchmarkIndex(ids,new Set(["a","c"]),0),1);
});

test("Designer benchmark wraps around to an earlier unlabelled case",()=>{
  const ids=["a","b","c","d"];
  assert.equal(nextUnlabelledBenchmarkIndex(ids,new Set(["b","c","d"]),2),0);
});

test("Designer benchmark returns null when all cases are labelled",()=>{
  const ids=["a","b","c"];
  assert.equal(nextUnlabelledBenchmarkIndex(ids,new Set(ids),1),null);
  assert.equal(nextUnlabelledBenchmarkIndex([],new Set(),0),null);
});
