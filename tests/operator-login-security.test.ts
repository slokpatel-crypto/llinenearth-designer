import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  OPERATOR_LOGIN_JSON_MAX_BYTES,
  MAX_OPERATOR_LOGIN_RATE_KEYS,
  operatorLoginRateBlocked,
  parseOperatorLoginPassword,
  type OperatorLoginRateState,
} from "../src/lib/operator-login-request.ts";
import { secureJsonRequestError } from "../src/lib/secure-json-request.ts";

function state():OperatorLoginRateState{return {identities:new Map(),global:null};}

test("operator passwords must be literal bounded strings, not coerced or truncated",()=>{
  assert.equal(parseOperatorLoginPassword("exact opaque secret"),"exact opaque secret");
  assert.equal(parseOperatorLoginPassword(" x ")," x ");
  for(const value of [[],["secret"],{},123456,true,null,"","x".repeat(301)])
    assert.equal(parseOperatorLoginPassword(value),null);
  assert.equal(OPERATOR_LOGIN_JSON_MAX_BYTES,4_096);
});

test("operator login limits each IP to eight attempts in fifteen minutes",()=>{
  const s=state();
  for(let i=0;i<8;i++)
    assert.equal(operatorLoginRateBlocked(s,"203.0.113.10",1_000),false);
  assert.equal(operatorLoginRateBlocked(s,"203.0.113.10",1_000),true);
  assert.equal(operatorLoginRateBlocked(s,"203.0.113.10",901_001),false);
});

test("operator login has a global attempt budget against forwarded-IP rotation",()=>{
  const s=state();
  for(let i=0;i<300;i++)
    assert.equal(operatorLoginRateBlocked(s,`198.51.${Math.floor(i/256)}.${i%256}`,1_000),false);
  assert.equal(operatorLoginRateBlocked(s,"203.0.113.77",1_000),true);
  assert.equal(operatorLoginRateBlocked(s,"203.0.113.77",901_001),false);
});

test("operator login identity cache is bounded and never evicts active counters",()=>{
  const s=state();
  for(let i=0;i<8;i++)
    assert.equal(operatorLoginRateBlocked(s,"203.0.113.1",1_000),false);
  for(let i=1;i<MAX_OPERATOR_LOGIN_RATE_KEYS;i++)
    operatorLoginRateBlocked(s,`2001:db8::${i.toString(16)}`,1_000);
  assert.equal(s.identities.size,MAX_OPERATOR_LOGIN_RATE_KEYS);
  assert.equal(operatorLoginRateBlocked(s,"203.0.113.2",1_000),true);
  assert.equal(operatorLoginRateBlocked(s,"203.0.113.1",1_000),true);
  assert.equal(s.identities.size,MAX_OPERATOR_LOGIN_RATE_KEYS);
  assert.equal(operatorLoginRateBlocked(s,"203.0.113.2",901_001),false);
  assert.ok(s.identities.size<=MAX_OPERATOR_LOGIN_RATE_KEYS);
});

test("operator login route enforces secure JSON before any password check",()=>{
  const source=readFileSync("src/app/api/operator/login/route.ts","utf8");
  assert.match(source,/secureJsonRequestError\(request,OPERATOR_LOGIN_JSON_MAX_BYTES\)/);
  assert.match(source,/readSecureJsonObject\(request,OPERATOR_LOGIN_JSON_MAX_BYTES\)/);
  assert.match(source,/operatorLoginRateBlocked\(registry,ip\)/);
  assert.match(source,/parseOperatorLoginPassword\(body.password\)/);
  assert.doesNotMatch(source,/await request\.json\(\)/);
  assert.doesNotMatch(source,/String\(body.password/);
  const target="https://linenearth.example/api/operator/login";
  const request=(headers:Record<string,string>)=>new Request(target,{
    method:"POST",headers:{"content-type":"application/json",...headers},body:"{}",
  });
  assert.equal(secureJsonRequestError(request({origin:"https://outside.example"}),OPERATOR_LOGIN_JSON_MAX_BYTES)?.status,403);
  assert.equal(secureJsonRequestError(request({"sec-fetch-site":"same-site"}),OPERATOR_LOGIN_JSON_MAX_BYTES)?.status,403);
  assert.equal(secureJsonRequestError(request({origin:"https://linenearth.example"}),OPERATOR_LOGIN_JSON_MAX_BYTES),null);
});
