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

test("Vercel Git config disables every automatic deployment including main",()=>{
  const config=JSON.parse(fs.readFileSync("vercel.json","utf8")) as {
    git?:{deploymentEnabled?:boolean};
    ignoreCommand?:string;
  };
  assert.equal(config.git?.deploymentEnabled,false,
    "No branch, including main, may trigger automatic Vercel deployment");
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

test("approved identity-honesty branch builds only as preview",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"fix/garment-viewer-identity-honesty-20261015",
    VERCEL_GIT_COMMIT_MESSAGE:"test viewer identity honesty",
    VERCEL_ENV:"preview",
  });
  assert.equal(result.status,1);
  assert.match(result.stdout,/Approved protected preview branch/);
});

test("ordinary primary main commits are ignored until a deployment milestone",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:"Merge customer photo-match status",
    VERCEL_ENV:"production",
  });
  assert.equal(result.status,0);
  assert.match(result.stdout,/no \[deploy\] milestone marker/);
});

test("explicitly marked primary main commit continues the production build",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:"[deploy] Roadmap v2 major milestone",
    VERCEL_ENV:"production",
  });
  assert.equal(result.status,1);
  assert.match(result.stdout,/continue production build/);
});

test("deployment marker is case-insensitive",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:"[DEPLOY] customer photo milestone",
    VERCEL_ENV:"production",
  });
  assert.equal(result.status,1);
});

test("a later incidental [deploy] mention cannot authorize production",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:"docs: describe the [deploy] marker for future use",
    VERCEL_ENV:"production",
  });
  assert.equal(result.status,0);
  assert.match(result.stdout,/no \[deploy\] milestone marker/);
});

test("blank commit subject with body-only deploy marker is not approval",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:"\\n[deploy] copied from release instructions",
    VERCEL_ENV:"production",
  });
  assert.equal(result.status,0);
  assert.match(result.stdout,/no \\[deploy\\] milestone marker/);
});

test("ordinary subject followed by deploy marker in body is not approval",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:"docs: explain deployment\\n\\n[deploy] only on approved release subjects",
    VERCEL_ENV:"production",
  });
  assert.equal(result.status,0);
  assert.match(result.stdout,/no \\[deploy\\] milestone marker/);
});

test("explicit deploy marker in subject stays accepted with a commit body",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:"[deploy] independently approved milestone\\n\\nRelease notes",
    VERCEL_ENV:"production",
  });
  assert.equal(result.status,1);
  assert.match(result.stdout,/continue production build/);
});

test("main deploy marker cannot authorize a preview build",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:"[deploy] milestone",
    VERCEL_ENV:"preview",
  });
  assert.equal(result.status,0);
  assert.match(result.stdout,/requires VERCEL_ENV=production/);
});

test("missing Vercel environment skips even an explicitly marked main commit",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:"[deploy] milestone",
    VERCEL_ENV:undefined,
  });
  assert.equal(result.status,0);
  assert.match(result.stdout,/requires VERCEL_ENV=production/);
});

test("a deployment marker without a word boundary is not approval",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:"[deploy]ment instructions",
    VERCEL_ENV:"production",
  });
  assert.equal(result.status,0);
  assert.match(result.stdout,/no \[deploy\] milestone marker/);
});

test("missing project ID skips build even on a marked main commit",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:undefined,
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:"[deploy] milestone",
  });
  assert.equal(result.status,0);
  assert.match(result.stdout,/VERCEL_PROJECT_ID unavailable.*ignore build/);
});

test("blank main commit message cannot implicitly authorize a build",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:"   ",
    VERCEL_ENV:"production",
  });
  assert.equal(result.status,0);
  assert.match(result.stdout,/COMMIT_MESSAGE unavailable.*ignore build/);
});

test("missing Vercel branch metadata skips the unverified build",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:undefined,
    VERCEL_GIT_COMMIT_MESSAGE:undefined,
  });
  assert.equal(result.status,0);
  assert.match(result.stdout,/ignore build without a verified branch/);
});

test("missing commit-message metadata on main skips the unverified build",()=>{
  const result=runIgnore({
    VERCEL_PROJECT_ID:PRIMARY_PROJECT_ID,
    VERCEL_GIT_COMMIT_REF:"main",
    VERCEL_GIT_COMMIT_MESSAGE:undefined,
    VERCEL_ENV:"production",
  });
  assert.equal(result.status,0);
  assert.match(result.stdout,/COMMIT_MESSAGE unavailable.*ignore build/);
});
