import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeCustomerEmail } from "../src/lib/customer-account.ts";
import { secureSameOriginRequestError } from "../src/lib/secure-json-request.ts";
import {
  CUSTOMER_AUTH_JSON_MAX_BYTES,
  MAX_CUSTOMER_AUTH_RATE_KEYS,
  customerAuthRateBlocked,
  customerAuthEmailRateBlocked,
  parseCustomerAuthEmail,
  parseCustomerOtpCode,
  type CustomerAuthRateState,
} from "../src/lib/customer-auth-request.ts";

test("customer email normalization is deterministic",()=>{
  assert.equal(normalizeCustomerEmail("  Slok@Example.COM "),"slok@example.com");
  assert.equal(normalizeCustomerEmail("bad"),null);
  assert.equal(normalizeCustomerEmail("a@b"),null);
});

test("public OTP routes never coerce JSON arrays, objects or numeric codes",()=>{
  assert.equal(parseCustomerAuthEmail("  Slok@Example.COM "),"slok@example.com");
  for(const value of [["slok@example.com"],{email:"slok@example.com"},42,null,true])
    assert.equal(parseCustomerAuthEmail(value),null);
  assert.equal(parseCustomerOtpCode(" 123 456 "),"123456");
  assert.equal(parseCustomerOtpCode("ABCDEF"),"ABCDEF");
  for(const value of [["123456"],123456,{},false,null,"","12 34","x".repeat(13),"abcdef!"])
    assert.equal(parseCustomerOtpCode(value),null);
  assert.equal(CUSTOMER_AUTH_JSON_MAX_BYTES,4_096);
});

function state():CustomerAuthRateState{return {identities:new Map(),global:new Map()};}

test("OTP sends retain eight requests per ten minutes; verify has a separate attempt budget",()=>{
  const s=state();
  for(let i=0;i<8;i++) assert.equal(customerAuthRateBlocked(s,"otp","203.0.113.1",1_000),false);
  assert.equal(customerAuthRateBlocked(s,"otp","203.0.113.1",1_000),true);
  for(let i=0;i<12;i++) assert.equal(customerAuthRateBlocked(s,"verify","203.0.113.1",1_000),false);
  assert.equal(customerAuthRateBlocked(s,"verify","203.0.113.1",1_000),true);
  assert.equal(customerAuthRateBlocked(s,"otp","203.0.113.1",601_001),false);
});

test("rotating forwarded addresses cannot bypass the global best-effort OTP budget",()=>{
  const s=state();
  for(let i=0;i<300;i++)
    assert.equal(customerAuthRateBlocked(s,"otp",`192.0.${Math.floor(i/256)}.${i%256}`,1_000),false);
  assert.equal(customerAuthRateBlocked(s,"otp","198.51.100.1",1_000),true);
  assert.equal(customerAuthRateBlocked(s,"otp","198.51.100.1",601_001),false);
});

test("mailbox-level throttling resists rotating IPs without retaining plaintext email",()=>{
  const s=state();
  const email="customer@example.com";
  for(let i=0;i<4;i++) assert.equal(customerAuthEmailRateBlocked(s,"otp",email,1_000),false);
  assert.equal(customerAuthEmailRateBlocked(s,"otp",email,1_000),true);
  for(let i=0;i<10;i++) assert.equal(customerAuthEmailRateBlocked(s,"verify",email,1_000),false);
  assert.equal(customerAuthEmailRateBlocked(s,"verify",email,1_000),true);
  assert.equal([...s.identities.keys()].some(key=>key.includes(email)),false);
  assert.equal(customerAuthEmailRateBlocked(s,"otp",email,601_001),false);
});

test("auth request counters are memory-bounded and reject malformed forwarded identities",()=>{
  const s=state();
  for(let i=0;i<MAX_CUSTOMER_AUTH_RATE_KEYS*2;i++){
    customerAuthRateBlocked(s,"verify",`2001:db8::${i.toString(16)}`,1_000);
    assert.ok(s.identities.size<=MAX_CUSTOMER_AUTH_RATE_KEYS);
  }
  assert.equal(s.global.size,1);
  const malformed=state();
  assert.equal(customerAuthRateBlocked(malformed,"otp","x".repeat(100_000),1_000),false);
  assert.equal(customerAuthRateBlocked(malformed,"otp","",1_000),false);
  assert.equal(malformed.identities.get("otp:unknown")?.count,2);
  assert.equal(customerAuthRateBlocked(malformed,"otp","203.0.113.1",Number.NaN),true);
});

test("cross-site logout is rejected without changing the cookie contract",()=>{
  const target="https://linenearth.example/api/customer-auth/logout";
  const req=(headers:Record<string,string>)=>new Request(target,{method:"POST",headers});
  assert.deepEqual(secureSameOriginRequestError(req({origin:"https://other.example"})),{
    status:403,error:"Cross-site changes are not allowed.",
  });
  assert.deepEqual(secureSameOriginRequestError(req({"sec-fetch-site":"same-site"})),{
    status:403,error:"Cross-site changes are not allowed.",
  });
  assert.equal(secureSameOriginRequestError(req({origin:"https://linenearth.example","sec-fetch-site":"same-origin"})),null);
  const source=readFileSync("src/app/api/customer-auth/logout/route.ts","utf8");
  assert.ok(source.includes("secureSameOriginRequestError(request)"));
  assert.ok(source.includes("if(unsafe) return NextResponse.json"));
  assert.ok(source.includes('response.cookies.set(name,""'));
});

test("both customer auth POST routes reject unsafe JSON before reaching Supabase",()=>{
  for(const path of ["src/app/api/customer-auth/otp/route.ts","src/app/api/customer-auth/verify/route.ts"]){
    const source=readFileSync(path,"utf8");
    assert.match(source,/secureJsonRequestError\(request,CUSTOMER_AUTH_JSON_MAX_BYTES\)/);
    assert.match(source,/readSecureJsonObject\(request,CUSTOMER_AUTH_JSON_MAX_BYTES\)/);
    assert.match(source,/customerAuthRateBlocked\(rate,/);
    assert.match(source,/customerAuthEmailRateBlocked\(rate,/);
    assert.match(source,/SecureJsonBodyTooLarge/);
    assert.match(source,/SecureJsonBodyInvalid/);
    assert.doesNotMatch(source,/await request\.json\(\)/);
    assert.match(source,/cache-control":"private, no-store, max-age=0"/);
  }
});
