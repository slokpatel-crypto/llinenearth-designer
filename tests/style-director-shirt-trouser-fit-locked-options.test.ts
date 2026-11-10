import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateShirtFitIssues,
  styleDirectorCandidateTrouserFitIssues,
  styleDirectorCandidateShirtFit,
  styleDirectorCandidateShirtFitIntent,
  styleDirectorCandidateTrouserFit,
  styleDirectorCandidateTrouserFitIntent,
  styleDirectorCandidateWordingIssues,
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

test("with-or-without shirt fit alternatives require review and preserve every locked fit", () => {
  const candidates = [
    ["slim fit", "slim_fit"],
    ["regular fit", "regular_classic_fit"],
    ["relaxed fit", "relaxed_fit"],
    ["boxy / oversized fit", "boxy_oversized"],
    ["athletic taper fit", "athletic_taper"],
  ] as const;
  for (const [label] of candidates) {
    for (const wording of ["with or without " + label, "with or without a " + label]) {
      assert.deepEqual(styleDirectorCandidateShirtFitIntent(wording), {
        requested: null, prohibited: [], ambiguous: true,
      }, wording);
      assert.equal(styleDirectorCandidateShirtFit(wording, []), null, wording);
      assert.deepEqual(styleDirectorCandidateWordingIssues(wording)
        .map(issue => issue.code), ["ambiguous_candidate_shirt_fit"], wording);
      for (const [, id] of candidates) {
        const saved = Object.freeze({ fit: id });
        const before = JSON.stringify(saved);
        assert.deepEqual(styleDirectorCandidateShirtFitIssues(wording, saved), [], wording);
        assert.equal(JSON.stringify(saved), before);
      }
    }
  }
});

test("with-or-without trouser fit alternatives require review for all versioned fits", () => {
  const candidates = [
    ["slim tapered fit", "slim_tapered"],
    ["straight classic fit", "straight_classic"],
    ["regular tapered fit", "regular_tapered"],
    ["korean straight wide fit", "korean_straight_wide"],
    ["korean tapered fit", "korean_tapered"],
    ["baggy wide fit", "baggy_wide"],
    ["wide leg drape fit", "wide_leg_drape"],
    ["pleated straight fit", "pleated_straight"],
    ["cargo utility fit", "cargo_utility"],
    ["jean cut suiting fit", "jean_cut_suiting_fit"],
  ] as const;
  for (const [label] of candidates) {
    for (const wording of ["with or without " + label, "with or without a " + label]) {
      assert.deepEqual(styleDirectorCandidateTrouserFitIntent(wording), {
        requested: null, prohibited: [], ambiguous: true,
      }, wording);
      assert.equal(styleDirectorCandidateTrouserFit(wording), null, wording);
      // Wide-leg drape also names an independently ambiguous silhouette;
      // preserving both review gates is the correct fail-closed result.
      const expectedCodes = label === "wide leg drape fit"
        ? ["ambiguous_candidate_trouser_fit", "ambiguous_candidate_wide_leg"]
        : ["ambiguous_candidate_trouser_fit"];
      assert.deepEqual(styleDirectorCandidateWordingIssues("plain shirt", wording)
        .map(issue => issue.code), expectedCodes, wording);
      for (const [, id] of candidates) {
        const saved = Object.freeze({ fit: id });
        const before = JSON.stringify(saved);
        assert.deepEqual(styleDirectorCandidateTrouserFitIssues(wording, saved), [], wording);
        assert.equal(JSON.stringify(saved), before);
      }
    }
  }
});

test("undecided shirt and trouser fits preserve separately named firm instructions", () => {
  assert.deepEqual(styleDirectorCandidateShirtFitIntent(
    "with or without slim fit; no relaxed fit"), {
    requested: null, prohibited: ["relaxed_fit"], ambiguous: true,
  });
  assert.deepEqual(styleDirectorCandidateTrouserFitIntent(
    "with or without slim tapered fit; no cargo utility fit"), {
    requested: null, prohibited: ["cargo_utility"], ambiguous: true,
  });
  assert.deepEqual(styleDirectorCandidateShirtFitIntent("without slim fit"), {
    requested: null, prohibited: ["slim_fit"], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateTrouserFitIntent("without slim tapered fit"), {
    requested: null, prohibited: ["slim_tapered"], ambiguous: false,
  });
});
