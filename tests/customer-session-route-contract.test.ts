import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// Source-level guard; built-Next HTTP verification remains a separate release gate.
const route=readFileSync(new URL("../src/app/api/customer-auth/session/route.ts",import.meta.url),"utf8");

test("session lookup outage cannot be represented as an ordinary signed-out HTTP 200",()=>{
  assert.match(route,/catch\s*\{/);
  assert.match(route,/status\s*:\s*503/);
  assert.match(route,/Customer session temporarily unavailable/);
  assert.match(route,/cache-control["']?\s*:\s*["']private, no-store, max-age=0/);
  assert.match(route,/pragma["']?\s*:\s*["']no-cache/);
});

test("session outage logging never serializes upstream errors",()=>{
  assert.match(route,/catch\s*\{/);
  assert.doesNotMatch(route,/console\.(?:error|warn|log)\([^\n]*,\s*(?:error|err)\s*\)/);
  assert.match(route,/details redacted/);
});

test("upstream identity-provider 5xx is not treated as an expired customer session",()=>{
  const auth=readFileSync(new URL("../src/lib/customer-auth.ts",import.meta.url),"utf8");
  assert.match(auth,/response\.status\s*>=\s*500\)\s*throw new Error\("Customer identity provider unavailable\."\)/);
  assert.match(auth,/if\(!response\.ok\) return null/);
});
