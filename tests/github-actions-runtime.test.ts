import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflows=[
  ".github/workflows/ci.yml",
  ".github/workflows/build-linen-earth-os.yml",
  ".github/workflows/normalize-lockfile.yml",
  ".github/workflows/regenerate-lock.yml",
];

test("repository workflows use current GitHub Actions Node 24 runtimes",()=>{
  for(const path of workflows){
    const workflow=readFileSync(path,"utf8");
    assert.match(workflow,/actions\/checkout@v7/,path+" checkout runtime");
    assert.match(workflow,/actions\/setup-node@v7/,path+" setup-node runtime");
    assert.doesNotMatch(workflow,/actions\/checkout@v4/,path+" old checkout runtime");
    assert.doesNotMatch(workflow,/actions\/setup-node@v4/,path+" old setup-node runtime");
  }
});

test("CI still tests the project on its locked Node 22 line with npm cache",()=>{
  const workflow=readFileSync(".github/workflows/ci.yml","utf8");
  assert.match(workflow,/node-version: 22/);
  assert.match(workflow,/cache: npm/);
});
