import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {safeOperatorProductionErrorCode}
  from "../src/lib/designer/operator-production-error.ts";

test("production diagnostics never contain customer names, recovery tokens or backend SQL",()=>{
  const privateText="CI-NEVER-LOG-SECRET-RECIPE-TOKEN customer@example.invalid SQL statement";
  for(const supplied of [
    new Error(privateText),
    new SyntaxError(privateText),
    new TypeError(privateText),
    {message:privateText,stack:privateText,cause:privateText,
      toString(){throw new Error("Unauthorized object formatting");}},
    privateText,
    null,
  ]){
    const code=safeOperatorProductionErrorCode(supplied);
    assert.match(code,/^(unknown_error|backend_timeout|malformed_response|backend_transport|production_integrity_failure)$/);
    assert.doesNotMatch(code,/CI-NEVER-LOG|SQL statement|customer@example/);
  }
  for(const name of ["CI-NEVER-LOG-SECRET","Secrets: customer@example.invalid",
    "ProductionRpcHttpError"]){
    const poisoned=new Error(privateText);
    poisoned.name=name;
    assert.equal(safeOperatorProductionErrorCode(poisoned),"production_integrity_failure",
      "Never log arbitrary backend-provided Error.name");
  }
  const timeout=new Error(privateText);
  timeout.name="TimeoutError";
  assert.equal(safeOperatorProductionErrorCode(timeout),"backend_timeout");
});

test("production GET and POST only log fixed read/write category and safe code",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const safe=readFileSync("src/lib/designer/operator-production-error.ts","utf8");
  assert.match(route,/console\.error\("\[operator\/production:read\]",/);
  assert.match(route,/console\.error\("\[operator\/production:write\]",/);
  assert.equal((route.match(/safeOperatorProductionErrorCode\(error\)/g)||[]).length,2);
  assert.equal((route.match(/error instanceof ProductionRpcHttpError\?"upstream_http_"\+error\.status/g)||[]).length,2);
  assert.doesNotMatch(route,/console\.error\("\[operator\/production\]",error\)/);
  assert.doesNotMatch(route,/console\.error\([^;]*error\.message/);
  assert.doesNotMatch(safe,/return error\.name\s*;/);
  assert.doesNotMatch(safe,/return error\.message\s*;/);
  assert.match(route,/return respond\(\{error:"Production records could not be read\."\},503\)/);
  assert.match(route,/return respond\(\{error:"Production operation could not be completed\."\},409\)/);
  assert.match(route,/"cache-control":"private, no-store"/);
  assert.match(route,/"pragma":"no-cache"/);
});
