import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateSleeveIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("explicit sleeve instructions need a canonical own-data locked option", () => {
  const full = Object.freeze({ sleeve: "full_sleeve" });
  const half = Object.freeze({ sleeve: "half_sleeve" });
  const rolled = Object.freeze({ sleeve: "roll_up_styled" });
  const matching = [
    ["short sleeves", half, full],
    ["long sleeves", full, half],
    ["no short sleeves", full, half],
    ["no long sleeves", half, full],
    ["roll-up sleeves", rolled, full],
    ["no roll-up sleeves", full, rolled],
  ] as const;
  for (const [wording, allowed, forbidden] of matching) {
    assert.deepEqual(styleDirectorCandidateSleeveIssues(wording, allowed), [], wording);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(wording, forbidden).map(x => x.code),
      ["candidate_sleeve_mismatch"], wording);
  }
  // An inherited property, throwing getter, revoked proxy or stale ID is
  // never evidence that a production restriction was satisfied.
  const inherited = Object.create({ sleeve: "full_sleeve" });
  const getter = Object.defineProperty({}, "sleeve", {
    get() { throw new Error("saved sleeve getter must not execute"); },
  });
  const hostile = new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error("untrusted sleeve descriptor"); },
  });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const locked of [
    null, {}, inherited, getter, hostile, revoked.proxy,
    { sleeve: "obsolete_sleeve" }, { sleeve: "spread_collar" },
  ]) {
    for (const wording of [
      "short sleeves", "long sleeves", "no short sleeves",
      "no long sleeves", "roll-up sleeves", "no roll-up sleeves",
    ]) {
      const issues = styleDirectorCandidateSleeveIssues(wording, locked as never);
      assert.deepEqual(issues.map(x => x.code), ["candidate_sleeve_mismatch"], wording);
      assert.deepEqual(styleDirectorCandidateSleeveIssues(wording, locked as never), issues,
        "repeated untrusted review must be deterministic");
    }
  }
  for (const neutral of [
    "dress shirt", "optional short sleeves", "maybe long sleeves",
    "roll-up sleeves optional", "short sleeves and long sleeves",
  ]) {
    assert.deepEqual(styleDirectorCandidateSleeveIssues(neutral, null as never), [], neutral);
  }
  assert.equal(full.sleeve, "full_sleeve");
  assert.equal(half.sleeve, "half_sleeve");
  assert.equal(rolled.sleeve, "roll_up_styled");
});
