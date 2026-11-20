import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { currentCloudCustomerId } from "../src/lib/customer-saved-design-client.ts";

const session = (data: unknown, status = 200, contentType = "application/json") =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": contentType } });

test("session verifier reads signed-in identity from same-origin uncached endpoint", async () => {
  let calls = 0;
  const owner = await currentCloudCustomerId(async (url, init) => {
    calls++;
    assert.equal(url, "/api/customer-auth/session");
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.method, undefined);
    assert.equal(init?.body, undefined);
    return session({ customer: { id: "customer-alice", email: "alice@example.invalid" } });
  });
  assert.equal(calls, 1);
  assert.equal(owner, "customer-alice");
});

test("session verifier fails closed on sign-out, provider outage, malformed content and forged claims", async () => {
  const invalid = [
    session({ customer: null }),
    session({ customer: null, error: "unavailable" }, 503),
    session({ customer: { id: "customer-bob" } }, 401),
    session({ customer: { id: "customer-bob" } }, 200, "text/html"),
    session({ customer: { id: "" } }),
    session({ customer: { id: "../unsafe" } }),
    session({ customer: { id: 123 } }),
    session({ customer: { id: "customer-bob" }, claimedOwnerId: "customer-alice" }),
  ];
  for (const response of invalid) {
    await assert.rejects(() => currentCloudCustomerId(async () => response));
  }
});

test("cloud panel scrubs stale details on tab return and compares session before and after private actions", () => {
  const src = readFileSync("src/components/CloudSavedDesignsPanel.tsx", "utf8");
  assert.match(src, /window\.addEventListener\("focus", clearPrivateView\)/);
  assert.match(src, /document\.addEventListener\("visibilitychange", onVisible\)/);
  assert.match(src, /loadedOwner\.current = null;\s*selectedOwner\.current = null;\s*setCloud\(\[\]\);\s*setSelected\(null\);/);
  assert.match(src, /loadedOwner\.current && loadedOwner\.current !== owner/);
  assert.match(src, /const current = await currentCloudCustomerId\(\)/);
  assert.match(src, /current !== owner/);
  assert.match(src, /await action\(assertOwner\);\s*await assertOwner\(\);/);
  assert.match(src, /const recovered = await getCloudDesign\(item\.id\);\s*await assertOwner\(\);/);
  assert.match(src, /await assertOwner\(\);[\s\S]*?const recovered = importCloudDesignExport\(window\.localStorage/);
  assert.match(src, /await assertOwner\(\);\s*requireSelectedOwner\(\);\s*\/\/ Explicit export is safer/);
  assert.match(src, /visibilityEpoch\.current\+\+/);
  // Confirm dialogs may emit focus events; owner rechecks still run after consent.
  assert.match(src, /if \(inFlight\.current\) return;\s*visibilityEpoch\.current\+\+/);
  assert.match(src, /if \(!window\.confirm\(`Delete cloud design/);
  assert.match(src, /if \(!window\.confirm\(`Import cloud design/);
  assert.match(src, /await assertOwner\(\);\s*requireSelectedOwner\(\);\s*\/\/ The selected cloud record/);

  assert.match(src, /selectedOwner\.current = null;/);
  assert.match(src, /selectedOwner\.current = loadedOwner\.current;/);
  assert.match(src, /selectedOwner\.current !== loadedOwner\.current/);
  assert.match(src, /requireSelectedOwner\(\);\s*\/\/ The selected cloud record/);
});
