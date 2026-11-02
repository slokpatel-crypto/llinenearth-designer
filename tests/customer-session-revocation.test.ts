import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  hashCustomerSessionBearer,
  requireCustomerSessionRevocationAck,
} from "../src/lib/customer-session-revocation-contract.ts";
import {createCustomerSessionToken} from "../src/lib/customer-session-token.ts";

const secret="a dedicated synthetic secret for customer signing";
const identity={id:"123e4567-e89b-12d3-a456-426614174000",email:"owner@example.test"};

test("revocation hashes valid signed bearer without persisting its plaintext",()=>{
  const a=createCustomerSessionToken(secret,identity,Date.parse("2026-11-02T18:00:00Z"));
  const b=createCustomerSessionToken(secret,identity,Date.parse("2026-11-02T18:00:01Z"));
  const digest=hashCustomerSessionBearer(a);
  assert.match(digest,/^[0-9a-f]{64}$/);
  assert.notEqual(digest,hashCustomerSessionBearer(b));
  assert.notEqual(digest,a);
  assert.equal(hashCustomerSessionBearer(a),digest);
  for(const value of ["", "invalid", "x".repeat(4097)]){
    assert.throws(()=>hashCustomerSessionBearer(value),/Invalid customer session/);
  }
});

test("revocation checks and writes require exact boolean RPC acknowledgments",()=>{
  assert.equal(requireCustomerSessionRevocationAck(true),true);
  assert.equal(requireCustomerSessionRevocationAck(false),false);
  for(const value of [undefined,null,0,1,"true","false",[],{},[true],{revoked:false}]){
    assert.throws(()=>requireCustomerSessionRevocationAck(value),/Invalid customer session/);
  }
});

test("sign-out is fail closed and account UI cannot acknowledge a 503 as successful logout",()=>{
  const logout=readFileSync("src/app/api/customer-auth/logout/route.ts","utf8");
  const account=readFileSync("src/app/account/page.tsx","utf8");
  const auth=readFileSync("src/lib/customer-auth.ts","utf8");
  assert.match(logout,/await revokeCustomerSessionBearer\(signedCookie\)/);
  assert.ok(logout.indexOf("await revokeCustomerSessionBearer")<logout.indexOf('const response=NextResponse.json({ok:true}'));
  assert.match(logout,/status:503/);
  assert.match(account,/if\(!response.ok\)/);
  assert.match(account,/Secure sign-out could not be completed/);
  assert.match(auth,/if\(customerSessionRevocationRequired\(\)\)return null/);
  assert.match(auth,/await customerSessionBearerAllowed\(signedCookie\)/);
});

test("signed-cookie presence is authoritative, including empty and duplicate values",()=>{
  const auth=readFileSync("src/lib/customer-auth.ts","utf8");
  const marker=auth.indexOf("const signedCookieParts=");
  const legacy=auth.indexOf("if(customerSessionRevocationRequired())return null");
  assert.ok(marker>=0&&marker<legacy);
  assert.match(auth,/if\(signedCookieParts\.length\)/);
  assert.match(auth,/if\(signedCookieParts\.length!==1\)return null/);
  assert.ok(auth.indexOf("verifySignedCustomerSession(signedCookie)")<legacy,
    "only truly absent signed-cookie names may use the temporary legacy path");
});

test("migration stores digest only and forbids public RPC and direct table access",()=>{
  const sql=readFileSync("supabase/migrations/20261103_customer_session_revocation.sql","utf8");
  assert.match(sql,/token_hash text primary key/);
  assert.doesNotMatch(sql,/access_token|refresh_token|session_plaintext|customer_email/);
  assert.match(sql,/revoke all on table private.customer_session_revocations from public,anon,authenticated,service_role/);
  assert.match(sql,/revoke all on function public.customer_session_is_revoked\(text\) from public,anon,authenticated/);
  assert.match(sql,/revoke all on function public.customer_session_revoke\(text\) from public,anon,authenticated/);
  assert.match(sql,/grant execute on function public.customer_session_revoke\(text\) to service_role/);
});
