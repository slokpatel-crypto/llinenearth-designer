import test from "node:test";
import assert from "node:assert/strict";
import {
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
  createCustomerSessionToken,
  verifyCustomerSessionToken,
} from "../src/lib/customer-session-token.ts";

const secret="customer-session-secret-that-is-definitely-long-enough-123";

test("customer session token round-trips verified identity",()=>{
  const now=Date.parse("2026-10-01T10:00:00Z");
  const token=createCustomerSessionToken(secret,{
    id:"123e4567-e89b-12d3-a456-426614174000",
    email:"Slok@Example.COM",
  },now);
  assert.deepEqual(verifyCustomerSessionToken(secret,token,now+1000),{
    id:"123e4567-e89b-12d3-a456-426614174000",
    email:"slok@example.com",
  });
});

test("customer session rejects tampering and expiry",()=>{
  const now=Date.parse("2026-10-01T10:00:00Z");
  const token=createCustomerSessionToken(secret,{
    id:"123e4567-e89b-12d3-a456-426614174000",
    email:null,
  },now);
  assert.equal(verifyCustomerSessionToken(secret,token+"x",now+1000),null);
  assert.equal(
    verifyCustomerSessionToken(secret,token,now+CUSTOMER_SESSION_MAX_AGE_SECONDS*1000+1),
    null,
  );
});

test("customer session requires a strong signing secret",()=>{
  assert.throws(()=>createCustomerSessionToken("short",{
    id:"123e4567-e89b-12d3-a456-426614174000",email:null,
  }),/too short/);
});
