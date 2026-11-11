import assert from "node:assert/strict";
import test from "node:test";
import {
  styleDirectorPresentationIssues,
} from "../src/lib/designer/style-director-compatibility.ts";
import type { DesignerStyle } from "../src/lib/designer/engine.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

const photo = () => ({
  collar: "Mandarin / Band Collar",
  shirtWear: "Tucked",
});
const saved = () => ({
  shirt: {
    collar: "mandarin_band_collar",
    wear: "tucked",
    cuff: "barrel_cuff_1_button",
    placket: "standard_visible_placket",
    fit: "regular_classic_fit",
    button: "plastic_resin",
    collarFinish: "Self-fabric",
    pocket: "no_pocket",
    sleeve: "full_sleeve",
  },
});
const review = (style: unknown, spec: unknown) =>
  styleDirectorPresentationIssues(
    style as Pick<DesignerStyle, "collar" | "shirtWear">,
    spec as Pick<StyleSpecV2, "shirt">,
  ).map(issue => issue.code);

test("ordinary and frozen photo/versioned construction remain consistent", () => {
  const style = Object.freeze(photo());
  const spec = Object.freeze({ shirt: Object.freeze(saved().shirt) });
  const before = JSON.stringify({ style, spec });
  assert.deepEqual(review(style, spec), []);
  assert.deepEqual(review(style, spec), [], "snapshot check is deterministic");
  assert.equal(JSON.stringify({ style, spec }), before, "locked IDs are never rewritten");
  assert.deepEqual(review({ ...style, shirtWear: "Untucked" }, spec), ["legacy_wear_mismatch"]);
  assert.deepEqual(review({ ...style, collar: "Point (Standard) Collar" }, spec),
    ["legacy_collar_mismatch"]);
});

test("legacy photo getters cannot fabricate photographic parity", () => {
  for (const key of ["collar", "shirtWear", "cuff", "button", "trouser"] as const) {
    const style = { ...photo() };
    let calls = 0;
    Object.defineProperty(style, key, {
      enumerable: true,
      get() {
        calls++;
        return key === "collar" ? "Mandarin / Band Collar" : "Tucked";
      },
    });
    assert.deepEqual(review(style, saved()), ["legacy_collar_mismatch"], key);
    assert.deepEqual(review(style, saved()), ["legacy_collar_mismatch"], key);
    assert.equal(calls, 0, "photo validation must not evaluate a getter");
  }
  const inherited = Object.create({ ...photo() });
  assert.deepEqual(review(inherited, saved()), ["legacy_collar_mismatch"],
    "inherited photographic labels are not approved photo choices");
  const optionalInherited = Object.assign(Object.create({ cuff: "Fake photo cuff" }), photo());
  assert.deepEqual(review(optionalInherited, saved()), [],
    "optional inherited photo fields are not trusted as affirmative choices");
});

test("locked shirt accessors and top-level getters fail closed before any preview approval", () => {
  for (const key of ["collar", "wear", "cuff", "placket", "pocket", "sleeve"] as const) {
    let calls = 0;
    const shirt = Object.defineProperty({ ...saved().shirt }, key, {
      enumerable: true,
      configurable: true,
      get() {
        calls++;
        throw new Error("untrusted saved selector getter");
      },
    });
    assert.deepEqual(review(photo(), { shirt }), ["legacy_collar_mismatch"], key);
    assert.deepEqual(review(photo(), { shirt }), ["legacy_collar_mismatch"], key);
    assert.equal(calls, 0);
  }
  for (const key of ["shirt", "pant"] as const) {
    let calls = 0;
    const root = Object.defineProperty({ ...saved() }, key, {
      enumerable: true,
      configurable: true,
      get() {
        calls++;
        return saved().shirt;
      },
    });
    assert.deepEqual(review(photo(), root), ["legacy_collar_mismatch"], key);
    assert.equal(calls, 0);
  }
  const inheritedRoot = Object.create(saved());
  assert.deepEqual(review(photo(), inheritedRoot), ["legacy_collar_mismatch"]);
});

test("unreadable pant selectors reject visual parity even if shirt labels match", () => {
  for (const key of ["type", "rise", "waistband", "break"] as const) {
    let calls = 0;
    const pant = Object.defineProperty({
      type: "formal_flat_front",
      rise: "mid_rise",
      waistband: "belt_loops",
      break: "no_break",
    }, key, {
      enumerable: true,
      configurable: true,
      get() {
        calls++;
        throw new Error("untrusted pant getter");
      },
    });
    assert.deepEqual(review(photo(), { ...saved(), pant }), ["legacy_collar_mismatch"], key);
    assert.equal(calls, 0);
  }
  assert.deepEqual(review(photo(), saved()), [],
    "older independent callers without a pant object retain compatibility");
});

test("revoked and hostile root/leaf proxies never throw or approve a photograph", () => {
  const spec = saved();
  const style = photo();
  const hostile = <T extends object>(data: T) => new Proxy(data, {
    getOwnPropertyDescriptor() { throw new Error("unreadable snapshot"); },
  });
  assert.deepEqual(review(hostile(style), spec), ["legacy_collar_mismatch"]);
  assert.deepEqual(review(style, hostile(spec)), ["legacy_collar_mismatch"]);
  assert.deepEqual(review(style, { shirt: hostile(spec.shirt) }), ["legacy_collar_mismatch"]);
  const revokedPhoto = Proxy.revocable(style, {});
  revokedPhoto.revoke();
  assert.deepEqual(review(revokedPhoto.proxy, spec), ["legacy_collar_mismatch"]);
  const revokedShirt = Proxy.revocable(spec.shirt, {});
  revokedShirt.revoke();
  assert.deepEqual(review(style, { shirt: revokedShirt.proxy }), ["legacy_collar_mismatch"]);
  const revokedRoot = Proxy.revocable(spec, {});
  revokedRoot.revoke();
  assert.deepEqual(review(style, revokedRoot.proxy), ["legacy_collar_mismatch"]);
});
