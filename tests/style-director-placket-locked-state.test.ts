import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorCandidatePlacketIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

// A prohibited front construction is not proven safe by inherited,
// accessor-backed or unreadable saved state. Never execute getters.
test("placket restrictions require a canonical own locked option", () => {
  const forbidden = "No hidden placket";
  const expected = ["candidate_placket_mismatch"];
  let getterCalls = 0;
  const inherited = Object.create({ placket: "standard_visible_placket" });
  const accessor = Object.defineProperty({}, "placket", {
    enumerable: true,
    get() { getterCalls++; throw new Error("untrusted placket getter"); },
  });
  const trap = new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error("unreadable saved placket"); },
  });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const locked of [inherited, accessor, trap, revoked.proxy, {}, null]) {
    const input = locked as Pick<StyleSpecV2["shirt"], "placket">;
    const first = styleDirectorCandidatePlacketIssues(forbidden, input);
    assert.deepEqual(first.map(issue => issue.code), expected);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(forbidden, input), first);
  }
  assert.equal(getterCalls, 0, "saved accessors must not be executed");
  const valid = Object.freeze(Object.assign(Object.create(null), {
    placket: "standard_visible_placket",
  })) as Pick<StyleSpecV2["shirt"], "placket">;
  assert.deepEqual(styleDirectorCandidatePlacketIssues(forbidden, valid), []);
  assert.equal(valid.placket, "standard_visible_placket");
  assert.deepEqual(styleDirectorCandidatePlacketIssues(forbidden, {
    placket: "hidden_fly_front",
  }), [{ code: "candidate_placket_mismatch",
    explanation: "The requested or prohibited shirt placket conflicts with the locked versioned construction; confirm the front before tailoring." }]);
});

test("explicit placket bans reject only the prohibited canonical construction", () => {
  const cases = [
    ["No standard placket", "standard_visible_placket", "hidden_fly_front"],
    ["Without hidden placket", "hidden_fly_front", "standard_visible_placket"],
    ["French placket is forbidden", "french_placket", "standard_visible_placket"],
    ["Covered placket must not be used", "covered_placket", "standard_visible_placket"],
    ["Contrast placket is not allowed", "contrast_placket", "standard_visible_placket"],
  ] as const;
  for (const [instruction, banned, permitted] of cases) {
    const lockedBanned = Object.freeze({ placket: banned });
    const lockedPermitted = Object.freeze({ placket: permitted });
    const first = styleDirectorCandidatePlacketIssues(instruction, lockedBanned);
    assert.deepEqual(first.map(issue => issue.code), ["candidate_placket_mismatch"], instruction);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(instruction, lockedBanned), first);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(instruction, lockedPermitted), [], instruction);
    assert.equal(lockedBanned.placket, banned);
    assert.equal(lockedPermitted.placket, permitted);
  }
});
