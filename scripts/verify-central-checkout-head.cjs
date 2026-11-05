"use strict";
// Ensure the central source-parity job tested the exact event-selected commit,
// rather than GitHub's transient pull/merge result. This runs read-only.
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");

const shaPattern = /^[0-9a-f]{40}$/;

function verifyCheckoutHead(expectedHead, actualHead) {
  assert.ok(typeof expectedHead === "string" && shaPattern.test(expectedHead),
    "Missing or invalid expected event head SHA");
  assert.ok(typeof actualHead === "string" && shaPattern.test(actualHead),
    "Missing or invalid checked-out HEAD SHA");
  assert.equal(actualHead, expectedHead,
    "Source parity checkout is not the exact event head; refusing synthetic merge or stale ref");
  return expectedHead;
}

function selfTest() {
  const a = "a".repeat(40);
  const b = "b".repeat(40);
  assert.equal(verifyCheckoutHead(a, a), a);
  assert.throws(() => verifyCheckoutHead("", a), /invalid expected event head/);
  assert.throws(() => verifyCheckoutHead("not-a-sha", a), /invalid expected event head/);
  assert.throws(() => verifyCheckoutHead(a, ""), /invalid checked-out HEAD/);
  assert.throws(() => verifyCheckoutHead(a, b), /not the exact event head/);
  assert.throws(() => verifyCheckoutHead(a, a.toUpperCase()),
    /invalid checked-out HEAD/);
  process.stdout.write("PASS: checkout SHA guard rejects missing, malformed and mismatched heads\n");
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  const actual = execFileSync("git", ["rev-parse", "HEAD"],
    { encoding: "utf8", timeout: 5000 }).trim();
  const sha = verifyCheckoutHead(process.env.EXPECTED_HEAD, actual);
  process.stdout.write("PASS: source parity checked out exact event HEAD " + sha + "\n");
}
