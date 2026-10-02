import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";

const PRIMARY_PROJECT_ID="prj_b3rwwOl5OI0VV3qYyKXPFOloCllT";

function runIgnore(env:Record<string,string|undefined>){
  const result=spawnSync(process.execPath,["scripts/vercel-ignore.mjs"],{
    cwd:process.cwd(),
    env:{...process.env,...env},
    encoding:"utf8",
  });
  return {status:result.status,stdout:result.stdout,stderr:result.stderr};
}

test("Vercel Git config disables every branch except main",()=>{
  const config=JSON.parse(fs.readFileSync("vercel.json","utf8")) as {
    git?:{deploymentEnabled?:Record<string,boolean>};
    ignoreCommand?:string;
  };
  assert.equal(config.git?.deploymentEnabled?.["**"],false);
  assert.equal(config.git?.deploymentEnabled?.main,true);
  assert.equal(config.ignoreCommand,"node scripts/vercel-ignore.mjs");
});

test("duplicate Vercel projects are ignored even on a marked main commit",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:"prj_duplicate",
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:"[deploy] milestone",
  });
  assert.equal(result.status,0);
  assert.match(result.stdout,/Duplicate Vercel project/);
});

test("primary Vercel project ignores preview branches",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"feature/preview",
    VERCEL_GIT_COMMIT_MESSAGE:"[deploy] preview",
  });
  assert.equal(result.status,0);
  assert.match(result.stdout,/preserve production build quota/);
});

test("ordinary primary main commits are ignored until a deployment milestone",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:"Merge customer photo-match status",
  });
  assert.equal(result.status,0);
  assert.match(result.stdout,/no \[deploy\] milestone marker/);
});

test("explicitly marked primary main commit continues the production build",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:"[deploy] Roadmap v2 major milestone",
  });
  assert.equal(result.status,1);
  assert.match(result.stdout,/continue production build/);
});

test("deployment marker is case-insensitive",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:"[DEPLOY] customer photo milestone",
  });
  assert.equal(result.status,1);
});

test("missing Vercel branch metadata fails safe by continuing",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:undefined,
    VERCEL_GIT_COMMIT_MESSAGE:undefined,
  });
  assert.equal(result.status,1);
  assert.match(result.stdout,/continue build fail-safe/);
});

test("missing commit-message metadata on main fails safe by continuing",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:undefined,
  });
  assert.equal(result.status,1);
  assert.match(result.stdout,/COMMIT_MESSAGE unavailable/);
});
