import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateTrouserFront,
  styleDirectorCandidateFrontConstructionIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

const codes = (wording: string, pleat: string) =>
  styleDirectorCandidateFrontConstructionIssues(
    wording, Object.freeze({ pleat }),
  ).map(issue => issue.code);

test("postposed unwanted count bans prohibit only the named canonical pleat count", () => {
  for (const ending of [
    "aren't wanted", "aren’t wanted", "are unwanted",
    "should not be selected", "must not be used",
  ]) {
    const doubleBan = `double pleats ${ending}`;
    assert.equal(styleDirectorCandidateTrouserFront(doubleBan), null, doubleBan);
    assert.deepEqual(codes(doubleBan, "double_pleat_forward"),
      ["candidate_trouser_pleat_mismatch"], doubleBan);
    assert.deepEqual(codes(doubleBan, "single_pleat_forward"), [], doubleBan);
    assert.deepEqual(codes(doubleBan, "flat_front"), [], doubleBan);
    assert.deepEqual(codes(doubleBan, "double_pleat_forward"),
      codes(doubleBan, "double_pleat_forward"), "deterministic replay");
    const singleBan = `single pleats ${ending}`;
    assert.equal(styleDirectorCandidateTrouserFront(singleBan), null, singleBan);
    assert.deepEqual(codes(singleBan, "single_pleat_forward"),
      ["candidate_trouser_pleat_mismatch"], singleBan);
    assert.deepEqual(codes(singleBan, "double_pleat_forward"), [], singleBan);
  }
});

test("contracted optional count wording is neutral while independent positive count remains binding", () => {
  for (const ending of ["aren't required", "aren’t needed", "aren't mandatory"]) {
    const wording = `double pleats ${ending}`;
    assert.equal(styleDirectorCandidateTrouserFront(wording), null, wording);
    assert.deepEqual(codes(wording, "single_pleat_reverse"), [], wording);
    assert.deepEqual(codes(wording, "double_pleat_reverse"), [], wording);
  }
  const independent = "double pleats aren't needed; single pleat required";
  assert.equal(styleDirectorCandidateTrouserFront(independent), "pleated");
  assert.deepEqual(codes(independent, "single_pleat_reverse"), []);
  assert.deepEqual(codes(independent, "double_pleat_reverse"),
    ["candidate_trouser_pleat_mismatch"]);
  const conflicting = "double pleats aren't wanted; double pleats required";
  assert.deepEqual(codes(conflicting, "double_pleat_reverse"),
    ["candidate_trouser_pleat_mismatch"],
    "explicitly prohibited and requested count must not be approved");
});

test("postposed unwanted direction bans require the opposite proven locked direction", () => {
  for (const ending of [
    "aren't wanted", "aren’t wanted", "are unwanted",
    "should not be selected", "must not be used",
  ]) {
    const forwardBan = `forward pleats ${ending}`;
    assert.equal(styleDirectorCandidateTrouserFront(forwardBan), null, forwardBan);
    assert.deepEqual(codes(forwardBan, "single_pleat_forward"),
      ["candidate_trouser_pleat_mismatch"], forwardBan);
    assert.deepEqual(codes(forwardBan, "single_pleat_reverse"), [], forwardBan);
    const reverseBan = `reverse pleats ${ending}`;
    assert.equal(styleDirectorCandidateTrouserFront(reverseBan), null, reverseBan);
    assert.deepEqual(codes(reverseBan, "double_pleat_reverse"),
      ["candidate_trouser_pleat_mismatch"], reverseBan);
    assert.deepEqual(codes(reverseBan, "double_pleat_forward"), [], reverseBan);
  }
  assert.deepEqual(codes("forward pleats aren't wanted; reverse pleats required", "single_pleat_reverse"), []);
  assert.deepEqual(codes("forward pleats aren't wanted; reverse pleats required", "single_pleat_forward"),
    ["candidate_trouser_pleat_mismatch"]);
});

test("optional direction is neutral and cannot defeat a separate required direction", () => {
  for (const suffix of ["aren't needed", "aren’t required", "aren't mandatory"]) {
    const optional = `forward pleats ${suffix}`;
    assert.equal(styleDirectorCandidateTrouserFront(optional), null, optional);
    assert.deepEqual(codes(optional, "double_pleat_forward"), [], optional);
    assert.deepEqual(codes(optional, "double_pleat_reverse"), [], optional);
    const independent = `${optional}; reverse pleats required`;
    assert.equal(styleDirectorCandidateTrouserFront(independent), "pleated", independent);
    assert.deepEqual(codes(independent, "double_pleat_reverse"), [], independent);
    assert.deepEqual(codes(independent, "double_pleat_forward"),
      ["candidate_trouser_pleat_mismatch"], independent);
  }
  assert.deepEqual(codes("reverse pleats required", "single_pleat_reverse"), []);
  assert.deepEqual(codes("reverse pleats required", "single_pleat_forward"),
    ["candidate_trouser_pleat_mismatch"]);
});
