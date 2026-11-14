import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorProposedCroppedHem } from "../src/lib/designer/style-director-compatibility.ts";

/**
 * Recommendations must be derived from explicit saved data, not inherited or
 * accessor-backed fields that can silently change a construction decision.
 */
test("cropped hem suggestion rejects inherited saved-option values", () => {
  const inherited = Object.create({ type: "cropped_ankle", break: "cropped_above_ankle" });
  assert.equal(styleDirectorProposedCroppedHem(inherited), null);
  const partlyInherited = Object.assign(Object.create({ break: "cropped_above_ankle" }), {
    type: "cropped_ankle",
  });
  assert.equal(styleDirectorProposedCroppedHem(partlyInherited), null);
});

test("cropped hem suggestion never evaluates accessor-backed selections", () => {
  let calls = 0;
  const locked = {};
  for (const key of ["type", "break"]) {
    Object.defineProperty(locked, key, {
      enumerable: true,
      get() {
        calls++;
        throw new Error("untrusted saved-design accessor evaluated");
      },
    });
  }
  assert.equal(styleDirectorProposedCroppedHem(locked as never), null);
  assert.equal(calls, 0);
});

test("cropped hem suggestion is deterministic and does not rewrite locked data", () => {
  const locked = Object.freeze({ type: "cropped_ankle", break: "cropped_above_ankle" });
  const before = JSON.stringify(locked);
  assert.equal(styleDirectorProposedCroppedHem(locked), "cropped_above_ankle_hem");
  assert.equal(styleDirectorProposedCroppedHem(locked), "cropped_above_ankle_hem");
  assert.equal(JSON.stringify(locked), before);
  assert.equal(styleDirectorProposedCroppedHem({
    type: "cropped_ankle", break: "stacked_break",
  }), null);
});


test("cropped hem recommendation fails closed on revoked or hostile saved selections", () => {
  const revoked = Proxy.revocable({ type: "cropped_ankle", break: "cropped_above_ankle" }, {});
  revoked.revoke();
  const hostile = new Proxy({}, {
    getOwnPropertyDescriptor() {
      throw new Error("untrusted descriptor lookup");
    },
    get() {
      throw new Error("untrusted property access");
    },
  });
  for (const candidate of [null, undefined, revoked.proxy, hostile]) {
    assert.equal(styleDirectorProposedCroppedHem(candidate as never), null);
    assert.equal(styleDirectorProposedCroppedHem(candidate as never), null);
  }
  const wrongType = Object.freeze({ type: "formal_flat_front", break: "cropped_above_ankle" });
  const wrongBreak = Object.freeze({ type: "cropped_ankle", break: "no_break" });
  assert.equal(styleDirectorProposedCroppedHem(wrongType as never), null);
  assert.equal(styleDirectorProposedCroppedHem(wrongBreak as never), null);
});
