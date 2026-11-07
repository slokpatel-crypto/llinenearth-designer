import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateShirtFitIssues,
  styleDirectorCandidateTrouserFitIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

const malformedLocked = (field: string, plausibleId: string) => {
  const inherited = Object.create({ [field]: plausibleId });
  const accessor = Object.defineProperty({}, field, {
    get() { throw new Error("untrusted saved fit accessor"); },
  });
  const hostile = new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error("untrusted descriptor"); },
  });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  return [null, {}, inherited, accessor, hostile, revoked.proxy, { [field]: "stale_fit" }];
};

test("named shirt fit requests and bans demand a valid own-data fit ID", () => {
  const slim = Object.freeze({ fit: "slim_fit" });
  const regular = Object.freeze({ fit: "regular_classic_fit" });
  assert.deepEqual(styleDirectorCandidateShirtFitIssues("slim fit shirt", slim), []);
  assert.deepEqual(styleDirectorCandidateShirtFitIssues("no slim fit", regular), []);
  assert.equal(styleDirectorCandidateShirtFitIssues("slim fit shirt", regular)[0]?.code,
    "candidate_shirt_fit_mismatch");
  assert.equal(styleDirectorCandidateShirtFitIssues("no slim fit", slim)[0]?.code,
    "candidate_shirt_fit_mismatch");
  for (const locked of malformedLocked("fit", "regular_classic_fit")) {
    for (const wording of ["slim-fit shirt", "no slim fit"]) {
      const issues = styleDirectorCandidateShirtFitIssues(wording, locked as never);
      assert.deepEqual(issues.map(issue => issue.code), ["candidate_shirt_fit_mismatch"]);
      assert.deepEqual(styleDirectorCandidateShirtFitIssues(wording, locked as never), issues);
    }
  }
  assert.deepEqual(styleDirectorCandidateShirtFitIssues("maybe slim fit", null as never), []);
  assert.equal(slim.fit, "slim_fit");
  assert.equal(regular.fit, "regular_classic_fit");
});

test("trouser fit constraints do not approve missing or accessor-backed locked IDs", () => {
  const slim = Object.freeze({ fit: "slim_tapered" });
  const straight = Object.freeze({ fit: "straight_classic" });
  assert.deepEqual(styleDirectorCandidateTrouserFitIssues("no slim tapered", straight), []);
  assert.deepEqual(styleDirectorCandidateTrouserFitIssues("slim tapered", slim)
    .map(issue => issue.code), ["unverified_trouser_fit_photo"],
    "valid locked ID still needs photographic verification");
  assert.equal(styleDirectorCandidateTrouserFitIssues("slim tapered", straight)[0]?.code,
    "candidate_trouser_fit_mismatch");
  assert.equal(styleDirectorCandidateTrouserFitIssues("no slim tapered", slim)[0]?.code,
    "candidate_trouser_fit_mismatch");
  for (const locked of malformedLocked("fit", "straight_classic")) {
    for (const wording of ["slim tapered", "no slim tapered"]) {
      const issues = styleDirectorCandidateTrouserFitIssues(wording, locked as never);
      assert.deepEqual(issues.map(issue => issue.code), ["candidate_trouser_fit_mismatch"]);
      assert.deepEqual(styleDirectorCandidateTrouserFitIssues(wording, locked as never), issues);
    }
  }
  assert.deepEqual(styleDirectorCandidateTrouserFitIssues("maybe slim tapered", null as never), [],
    "unqualified speculative prose must not select a fit");
  assert.equal(slim.fit, "slim_tapered");
  assert.equal(straight.fit, "straight_classic");
});
