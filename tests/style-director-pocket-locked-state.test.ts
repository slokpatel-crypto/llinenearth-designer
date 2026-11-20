import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorCandidatePocketIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

// An untrusted saved pocket cannot satisfy an explicit pocket prohibition.
// Never execute a getter while inspecting a locked design.
test("pocket exclusions fail closed on untrusted locked state", () => {
  let getterCalls = 0;
  const inherited = Object.create({ pocket: "no_pocket" });
  const accessor = Object.defineProperty({}, "pocket", {
    enumerable: true,
    get() { getterCalls++; throw new Error("untrusted pocket getter"); },
  });
  const trap = new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error("unreadable pocket"); },
  });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  const expected = ["candidate_pocket_mismatch"];
  for (const locked of [inherited, accessor, trap, revoked.proxy, {}, null]) {
    const input = locked as Pick<StyleSpecV2["shirt"], "pocket">;
    const first = styleDirectorCandidatePocketIssues("No flap pocket", input);
    assert.deepEqual(first.map(issue => issue.code), expected);
    assert.deepEqual(styleDirectorCandidatePocketIssues("No flap pocket", input), first);
  }
  assert.equal(getterCalls, 0);
  const safe = Object.freeze(Object.assign(Object.create(null), {
    pocket: "no_pocket",
  })) as Pick<StyleSpecV2["shirt"], "pocket">;
  assert.deepEqual(styleDirectorCandidatePocketIssues("No flap pocket", safe), []);
  assert.equal(safe.pocket, "no_pocket");
  assert.deepEqual(styleDirectorCandidatePocketIssues("No flap pocket", {
    pocket: "flap_pocket",
  }).map(issue => issue.code), expected);
});

test("explicit patch pocket requests preserve locked canonical construction", () => {
  assert.deepEqual(styleDirectorCandidatePocketIssues("Patch pocket shirt", {
    pocket: "single_patch_pocket",
  }), []);
  assert.deepEqual(styleDirectorCandidatePocketIssues("Patch pocket shirt", {
    pocket: "no_pocket",
  }).map(issue => issue.code), ["candidate_pocket_mismatch"]);
  assert.deepEqual(styleDirectorCandidatePocketIssues("No pocket shirt", {
    pocket: "no_pocket",
  }), []);
  assert.deepEqual(styleDirectorCandidatePocketIssues("No pocket shirt", {
    pocket: "single_patch_pocket",
  }).map(issue => issue.code), ["candidate_pocket_mismatch"]);
});
