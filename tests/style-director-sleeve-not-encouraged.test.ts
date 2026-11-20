import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateSleeve,
  styleDirectorCandidateSleeveIssues,
  styleDirectorCandidateRollUpSleeveIntent,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

const codes = (candidate: string, sleeve: string) =>
  styleDirectorCandidateSleeveIssues(candidate, Object.freeze({ sleeve })).map(issue => issue.code);

test("sleeve lengths that are not encouraged are exclusions, not requested cuts", () => {
  for (const length of ["Short sleeves", "Half sleeve", "Long sleeves", "Full sleeve"]) {
    const forbidden = /^(?:Short|Half)/.test(length) ? "half_sleeve" : "full_sleeve";
    const permitted = forbidden === "half_sleeve" ? "full_sleeve" : "half_sleeve";
    for (const rejection of ["are not encouraged", "is not encouraged", "aren't encouraged", "isn’t encouraged"]) {
      const candidate = `${length} ${rejection}`;
      assert.equal(styleDirectorCandidateSleeve(candidate), null, candidate);
      assert.deepEqual(codes(candidate, forbidden), ["candidate_sleeve_mismatch"], candidate);
      assert.deepEqual(codes(candidate, permitted), [], candidate);
      assert.deepEqual(styleDirectorCandidateWordingIssues(candidate), [], candidate);
      assert.deepEqual(codes(candidate, forbidden), ["candidate_sleeve_mismatch"], "repeatability");
    }
  }
});

test("roll-up styled is not encouraged: preserve locked sleeve construction", () => {
  for (const candidate of [
    "Roll-up Styled is not encouraged",
    "Roll-up sleeves aren't encouraged",
    "Roll-up Styled isn’t encouraged",
  ]) {
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(candidate), {
      requested: false, prohibited: true, ambiguous: false,
    }, candidate);
    assert.deepEqual(codes(candidate, "roll_up_styled"), ["candidate_sleeve_mismatch"], candidate);
    assert.deepEqual(codes(candidate, "half_sleeve"), [], candidate);
    assert.deepEqual(styleDirectorCandidateWordingIssues(candidate), [], candidate);
  }
  const independent = "Roll-up Styled is not encouraged; short sleeves required";
  assert.deepEqual(codes(independent, "half_sleeve"), []);
  assert.deepEqual(codes(independent, "roll_up_styled"), ["candidate_sleeve_mismatch"]);
  assert.deepEqual(styleDirectorCandidateWordingIssues("Roll-up Styled is not encouraged; Roll-up Styled shirt"),
    [{ code: "ambiguous_candidate_sleeve", explanation: "This proposed shirt names both short and long sleeves; confirm one sleeve construction before approving the recommendation." }]);
});

test("excluded and rejected sleeve constructions do not become positive cuts", () => {
  for (const length of ["Short sleeves", "Half sleeve", "Long sleeves", "Full sleeve"]) {
    const forbidden = /^(?:Short|Half)/.test(length) ? "half_sleeve" : "full_sleeve";
    const permitted = forbidden === "half_sleeve" ? "full_sleeve" : "half_sleeve";
    for (const rejection of ["are excluded", "is rejected", "are ruled out"]) {
      const candidate = `${length} ${rejection}`;
      assert.equal(styleDirectorCandidateSleeve(candidate), null, candidate);
      assert.deepEqual(codes(candidate, forbidden), ["candidate_sleeve_mismatch"], candidate);
      assert.deepEqual(codes(candidate, permitted), [], candidate);
      assert.deepEqual(codes(candidate, forbidden), ["candidate_sleeve_mismatch"], "repeatability");
    }
  }
  for (const candidate of ["Roll-up Styled is excluded", "Roll-up sleeves are rejected", "Roll-up Styled ruled out"]) {
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(candidate), {
      requested: false, prohibited: true, ambiguous: false,
    }, candidate);
    assert.deepEqual(codes(candidate, "roll_up_styled"), ["candidate_sleeve_mismatch"], candidate);
    assert.deepEqual(codes(candidate, "half_sleeve"), [], candidate);
  }
  const independent = "Short sleeves are excluded; full sleeves required";
  // This helper only proposes the short-sleeve/open-hem override; it does not infer full sleeves.
  assert.equal(styleDirectorCandidateSleeve(independent), null);
  assert.deepEqual(codes(independent, "full_sleeve"), []);
  assert.deepEqual(codes(independent, "half_sleeve"), ["candidate_sleeve_mismatch"]);
});

test("disapproved or incompatible sleeve constructions remain exclusions", () => {
  for (const length of ["Short sleeves", "Half sleeve", "Long sleeves", "Full sleeve"]) {
    const forbidden = /^(?:Short|Half)/.test(length) ? "half_sleeve" : "full_sleeve";
    const permitted = forbidden === "half_sleeve" ? "full_sleeve" : "half_sleeve";
    for (const rejection of ["are not approved", "isn't approved", "are not compatible", "isn’t appropriate"]) {
      const candidate = `${length} ${rejection}`;
      assert.equal(styleDirectorCandidateSleeve(candidate), null, candidate);
      assert.deepEqual(codes(candidate, forbidden), ["candidate_sleeve_mismatch"], candidate);
      assert.deepEqual(codes(candidate, permitted), [], candidate);
      assert.deepEqual(codes(candidate, forbidden), ["candidate_sleeve_mismatch"], "repeatability");
    }
  }
  for (const candidate of [
    "Roll-up Styled is not approved",
    "Roll-up sleeves aren't compatible",
    "Roll-up Styled isn’t appropriate",
  ]) {
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(candidate), {
      requested: false, prohibited: true, ambiguous: false,
    }, candidate);
    assert.deepEqual(codes(candidate, "roll_up_styled"), ["candidate_sleeve_mismatch"], candidate);
    assert.deepEqual(codes(candidate, "half_sleeve"), [], candidate);
  }
  const independent = "Short sleeves are not approved; full sleeves required";
  assert.equal(styleDirectorCandidateSleeve(independent), null);
  assert.deepEqual(codes(independent, "full_sleeve"), []);
  assert.deepEqual(codes(independent, "half_sleeve"), ["candidate_sleeve_mismatch"]);
});
