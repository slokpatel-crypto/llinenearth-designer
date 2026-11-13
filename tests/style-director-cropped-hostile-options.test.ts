import assert from "node:assert/strict";
import test from "node:test";
import { styleDirectorProposedCroppedHem } from "../src/lib/designer/style-director-compatibility.ts";

// Saved construction IDs must be primitive canonical strings. Never coerce
// arbitrary objects while deciding whether a tailor may propose a cropped hem.
test("cropped hem proposal ignores executable or boxed option values", () => {
  let coercions = 0;
  const hostile = Object.freeze({
    toString() { coercions++; throw new Error("untrusted option coercion"); },
    valueOf() { coercions++; throw new Error("untrusted option coercion"); },
  });
  for (const [type, shoeBreak] of [
    [hostile, "cropped_above_ankle"],
    ["cropped_ankle", hostile],
    [new String("cropped_ankle"), "cropped_above_ankle"],
    ["cropped_ankle", new String("cropped_above_ankle")],
  ] as const) {
    const pant = Object.freeze({ type, break: shoeBreak, hem: "plain_hem" });
    const before = Object.getOwnPropertyDescriptors(pant);
    const input = pant as unknown as Parameters<typeof styleDirectorProposedCroppedHem>[0];
    assert.equal(styleDirectorProposedCroppedHem(input), null);
    assert.equal(styleDirectorProposedCroppedHem(input), null, "deterministic replay");
    assert.deepEqual(Object.getOwnPropertyDescriptors(pant), before, "locked data unchanged");
  }
  assert.equal(coercions, 0, "untrusted option conversion must never execute");
  assert.equal(styleDirectorProposedCroppedHem(Object.freeze({
    type: "cropped_ankle", break: "cropped_above_ankle", hem: "plain_hem",
  })), "cropped_above_ankle_hem", "canonical options remain supported");
});
