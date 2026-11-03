import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCustomerEmail } from "../src/lib/customer-account.ts";
import {validLegacyCustomerAccessBearer} from "../src/lib/customer-auth-legacy-token.ts";
import {readFileSync} from "node:fs";

test("customer email normalization is deterministic",()=>{
  assert.equal(normalizeCustomerEmail("  Slok@Example.COM "),"slok@example.com");
  assert.equal(normalizeCustomerEmail("bad"),null);
  assert.equal(normalizeCustomerEmail("a@b"),null);
});

test("provider OTP responses and legacy account bridge are size-bounded and type-checked",()=>{
 const auth=readFileSync("src/lib/customer-auth.ts","utf8");
 const verify=readFileSync("src/app/api/customer-auth/verify/route.ts","utf8");
 assert.match(auth,/readBoundedJsonResponse\(response,MAX_VERIFY_PROVIDER_BYTES\)/);
 assert.match(auth,/readBoundedJsonResponse\(response,MAX_LEGACY_USER_PROVIDER_BYTES\)/);
 assert.match(auth,/jsonProviderResponse\(response\)/);
 assert.doesNotMatch(auth,/await response\.text\(\)/,
   "provider errors should never read unbounded private responses");
 assert.match(verify,/normalizeCustomerEmail\(session\.user\.email\)!==email/,
   "signed owner must be the email address that actually received the OTP");
 assert.match(verify,/const privateJson=\(body:unknown,status=200\)=>NextResponse\.json/);
 assert.doesNotMatch(verify,/return NextResponse\.json\(/,
   "no OTP verification result or error may skip private no-store response headers");
});

test("legacy access cookie cannot forward oversized or unsafe bearer material",()=>{
  for(const valid of ["valid-legacy","eyJhbGciOiJIUzI1NiJ9.e30.signature","a".repeat(4096)]){
    assert.equal(validLegacyCustomerAccessBearer(valid),true);
  }
  for(const invalid of ["",null,undefined,false,123,"a".repeat(4097),
    "abc\nInjected: yes","abc\rInjected: yes","bearer token","~!foo","x%0A"]){
    assert.equal(validLegacyCustomerAccessBearer(invalid),false);
  }
  const auth=readFileSync("src/lib/customer-auth.ts","utf8");
  assert.ok(auth.indexOf("if(!validLegacyCustomerAccessBearer(token)) return null")<
    auth.indexOf('const response=await authFetch("/auth/v1/user"'),
    "unsafe legacy cookies cannot reach authentication provider");
});
