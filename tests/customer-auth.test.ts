import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCustomerEmail } from "../src/lib/customer-auth.ts";

test("customer email normalization is deterministic",()=>{
  assert.equal(normalizeCustomerEmail("  Slok@Example.COM "),"slok@example.com");
  assert.equal(normalizeCustomerEmail("bad"),null);
  assert.equal(normalizeCustomerEmail("a@b"),null);
});
