import test from "node:test";
import assert from "node:assert/strict";
import {readdirSync,readFileSync} from "node:fs";
import {join} from "node:path";

const ROOT="src/app/api/operator";

function routePaths(directory:string):string[]{
  const paths:string[]=[];
  for(const entry of readdirSync(directory,{withFileTypes:true})){
    const path=join(directory,entry.name);
    if(entry.isDirectory())paths.push(...routePaths(path));
    else if(entry.isFile()&&entry.name==="route.ts")paths.push(path);
  }
  return paths;
}

/** The operator session verifier is ASYNC. An unawaited direct conditional
 * checks a truthy Promise and bypasses authentication. Audit every operator
 * route, including nested API paths, so this cannot recur in a new endpoint.
 * Returning the Promise is permitted only from an async authorized wrapper. */
function unsafeOperatorAuthLines(source:string):string[]{
  if(!source.includes("verifyOperatorSession"))return [];
  const asyncWrapper=/\basync\s+function\s+(?:authorized|operatorAuthorized)\s*\(/.test(source);
  const wrappers=[...source.matchAll(/\basync\s+function\s+(authorized|operatorAuthorized)\s*\(/g)]
    .map(m=>m[1]);
  const violations:string[]=[];
  for(const [i,line] of source.split("\n").entries()){
    if(/\bverifyOperatorSession\s*\(/.test(line)){
      const directAwait=/\bawait\s+verifyOperatorSession\s*\(/.test(line);
      const asyncReturn=/\breturn\s+verifyOperatorSession\s*\(/.test(line)&&asyncWrapper;
      if(!directAwait&&!asyncReturn)violations.push("line "+(i+1)+": "+line.trim());
    }
    for(const name of wrappers){
      if(new RegExp("\\b"+name+"\\s*\\(").test(line)
        &&!new RegExp("\\basync\\s+function\\s+"+name+"\\s*\\(").test(line)
        &&!new RegExp("\\bawait\\s+"+name+"\\s*\\(").test(line)){
        violations.push("line "+(i+1)+": unawaited "+name+"(): "+line.trim());
      }
    }
  }
  return violations;
}

test("all session-protected operator routes await authorization before accessing private APIs",()=>{
  const paths=routePaths(ROOT);
  assert.ok(paths.length>=30,"Operator route scan unexpectedly incomplete");
  const protectedPaths=paths.filter(path=>
    readFileSync(path,"utf8").includes("verifyOperatorSession("));
  assert.ok(protectedPaths.length>=25,
    "Expected session-protected operator routes are missing from audit");
  for(const path of protectedPaths){
    const source=readFileSync(path,"utf8");
    assert.deepEqual(unsafeOperatorAuthLines(source),[],
      path+" must not treat an unresolved Promise<boolean> as authentication");
  }
  const eligibility=readFileSync(
    "src/app/api/operator/production/delivery-eligibility/route.ts","utf8");
  assert.match(eligibility,/if\(!await verifyOperatorSession\(/);
});

test("operator auth regression detects unawaited direct and wrapped guards",()=>{
  assert.ok(unsafeOperatorAuthLines(
    'async function GET(){if(!verifyOperatorSession(token))return deny();}').length>0);
  assert.ok(unsafeOperatorAuthLines(
    'async function authorized(){return verifyOperatorSession(token);} if(!authorized())return deny();').length>0);
  assert.deepEqual(unsafeOperatorAuthLines(
    'async function authorized(){return verifyOperatorSession(token);} if(!await authorized())return deny();'),[]);
  assert.deepEqual(unsafeOperatorAuthLines(
    'if(!(await verifyOperatorSession(token)))return deny();'),[]);
});
