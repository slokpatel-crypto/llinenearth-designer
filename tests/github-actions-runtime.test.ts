import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("CI uses current GitHub Actions Node 24 runtimes while testing project Node 22",()=>{
  const workflow=readFileSync(".github/workflows/ci.yml","utf8");
  assert.match(workflow,/uses: actions\/checkout@v7/);
  assert.match(workflow,/uses: actions\/setup-node@v7/);
  assert.match(workflow,/node-version: 22/);
  assert.match(workflow,/cache: npm/);
  assert.doesNotMatch(workflow,/actions\/checkout@v4/);
  assert.doesNotMatch(workflow,/actions\/setup-node@v4/);
});
