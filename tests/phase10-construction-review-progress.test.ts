import test from "node:test";
import assert from "node:assert/strict";
import { summarizeConstructionReviews } from "../src/lib/designer/construction-review-summary.ts";

test("construction review completion counts both approve and reject decisions",()=>{
  assert.deepEqual(
    summarizeConstructionReviews({approved:6,rejected:4,pending:0,total:10}),
    {approved:6,rejected:4,pending:0,total:10,decided:10,completionPercent:100},
  );
  assert.equal(
    summarizeConstructionReviews({approved:5,rejected:2,pending:3,total:10}).completionPercent,
    70,
  );
  assert.equal(
    summarizeConstructionReviews({approved:0,rejected:0,pending:0,total:0}).completionPercent,
    0,
  );
});

test("construction review completion is bounded by total options",()=>{
  const summary=summarizeConstructionReviews({approved:8,rejected:5,pending:0,total:10});
  assert.equal(summary.decided,10);
  assert.equal(summary.completionPercent,100);
});
