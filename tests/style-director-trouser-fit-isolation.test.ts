import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

// Pure locked-design regression: no physical measurements or inferred defaults.
test("missing and retired trouser fit IDs do not hide independent sleeve and cropped-break conflicts", () => {
  for (const [fit, invalid] of [
    [undefined, false], [null, true], ["retired_trouser_fit", true],
    ["barrel_cuff_1_button", true],
  ] as const) {
    const shirt = Object.freeze({
      type: "dress_shirt", collar: "spread_collar", wear: "tucked",
      sleeve: "half_sleeve", cuff: "french_double_cuff",
    });
    const pant: Record<string, unknown> = {
      type: "cropped_ankle", pleat: "flat_front",
      hem: "plain_hem", break: "stacked_break",
    };
    if (fit !== undefined) pant.fit = fit;
    Object.freeze(pant);
    const locked = Object.freeze({ shirt, pant }) as unknown as StyleSpecV2;
    const snapshot = JSON.stringify(locked);
    const review = () => styleDirectorConstructionIssues(locked).map(issue => issue.code);
    const first = review();
    assert.equal(first.includes("unknown_versioned_option"), invalid);
    for (const code of [
      "short_sleeve_double_cuff", "cropped_type_hem_mismatch", "cropped_stacked_break",
    ]) assert.ok(first.includes(code), "fit uncertainty concealed " + code);
    assert.deepEqual(review(), first);
    assert.equal(JSON.stringify(locked), snapshot);
  }
});

test("inherited and accessor-backed trouser fits cannot certify a locked design or hide separate construction faults", () => {
  const invalidFits: readonly Record<string, unknown>[] = [
    Object.create({ fit: "slim_tapered" }) as Record<string, unknown>,
    Object.defineProperty({}, "fit", {
      enumerable: true,
      get() { throw new Error("untrusted saved fit accessor must not execute"); },
    }),
    Object.defineProperty({}, "fit", {
      enumerable: true,
      get() { return "slim_tapered"; },
    }),
  ];
  for (const pant of invalidFits) {
    Object.assign(pant, {
      type: "cropped_ankle", pleat: "flat_front",
      hem: "plain_hem", break: "stacked_break",
    });
    Object.freeze(pant);
    const shirt = Object.freeze({
      type: "dress_shirt", collar: "spread_collar", wear: "tucked",
      sleeve: "half_sleeve", cuff: "french_double_cuff",
    });
    const locked = Object.freeze({ shirt, pant }) as unknown as StyleSpecV2;
    const review = () => styleDirectorConstructionIssues(locked).map(issue => issue.code);
    const first = review();
    assert.ok(first.includes("unknown_versioned_option"));
    for (const code of [
      "short_sleeve_double_cuff", "cropped_type_hem_mismatch", "cropped_stacked_break",
    ]) assert.ok(first.includes(code), "unsafe fit concealed " + code);
    assert.deepEqual(review(), first);
  }
});

test("non-enumerable inherited and setter-only fit cannot bypass independent construction review", () => {
  const inherited = Object.create(Object.defineProperty({}, "fit", {
    configurable: true, value: "slim_tapered", enumerable: false,
  })) as Record<string, unknown>;
  const setterOnly = Object.defineProperty({}, "fit", {
    enumerable: false, set(_value: unknown) { throw new Error("setter must not run"); },
  }) as Record<string, unknown>;
  for (const pant of [inherited, setterOnly]) {
    Object.assign(pant, {
      type: "cropped_ankle", pleat: "flat_front",
      hem: "plain_hem", break: "stacked_break",
    });
    Object.freeze(pant);
    const shirt = Object.freeze({
      type: "dress_shirt", collar: "spread_collar", wear: "tucked",
      sleeve: "half_sleeve", cuff: "french_double_cuff",
    });
    const locked = Object.freeze({ shirt, pant }) as unknown as StyleSpecV2;
    const read = () => styleDirectorConstructionIssues(locked).map(issue => issue.code);
    const first = read();
    assert.ok(first.includes("unknown_versioned_option"));
    for (const code of ["short_sleeve_double_cuff", "cropped_type_hem_mismatch", "cropped_stacked_break"]) {
      assert.ok(first.includes(code), "untrusted fit hid " + code);
    }
    assert.deepEqual(read(), first);
  }
});

test("own non-enumerable data fit is a valid locked ID, unlike inherited or computed fit", () => {
  const pant = Object.defineProperty({
    type: "cropped_ankle", pleat: "flat_front",
    hem: "plain_hem", break: "stacked_break",
  }, "fit", { value: "slim_tapered", enumerable: false });
  const shirt = Object.freeze({
    type: "dress_shirt", collar: "spread_collar", wear: "tucked",
    sleeve: "half_sleeve", cuff: "french_double_cuff",
  });
  Object.freeze(pant);
  const locked = Object.freeze({ shirt, pant }) as unknown as StyleSpecV2;
  const review = () => styleDirectorConstructionIssues(locked).map(issue => issue.code);
  const first = review();
  assert.ok(!first.includes("unknown_versioned_option"),
    "a canonical own data ID must not be rejected solely because it is non-enumerable");
  for (const code of ["short_sleeve_double_cuff", "cropped_type_hem_mismatch", "cropped_stacked_break"]) {
    assert.ok(first.includes(code), "valid fit concealed " + code);
  }
  assert.deepEqual(review(), first);
  assert.equal(Object.getOwnPropertyDescriptor(pant, "fit")?.value, "slim_tapered");
});

test("non-enumerable retired fit is rejected without suppressing independent tailoring faults", () => {
  const pant = Object.defineProperty({
    type: "cropped_ankle", pleat: "flat_front",
    hem: "plain_hem", break: "stacked_break",
  }, "fit", { value: "retired_trouser_fit", enumerable: false });
  const shirt = Object.freeze({
    type: "dress_shirt", collar: "spread_collar", wear: "tucked",
    sleeve: "half_sleeve", cuff: "french_double_cuff",
  });
  Object.freeze(pant);
  const locked = Object.freeze({ shirt, pant }) as unknown as StyleSpecV2;
  const review = () => styleDirectorConstructionIssues(locked).map(issue => issue.code);
  const first = review();
  for (const code of [
    "unknown_versioned_option", "short_sleeve_double_cuff",
    "cropped_type_hem_mismatch", "cropped_stacked_break",
  ]) assert.ok(first.includes(code), "retired hidden fit concealed " + code);
  assert.deepEqual(review(), first);
  assert.equal(Object.getOwnPropertyDescriptor(pant, "fit")?.value, "retired_trouser_fit");
});

test("hidden own fit values reject wrong-group and non-string IDs without losing separate tailoring conflicts", () => {
  for (const fit of ["spread_collar", null, 42, "", "retired_trouser_fit"] as const) {
    const pant = Object.defineProperty({
      type: "cropped_ankle", pleat: "flat_front",
      hem: "plain_hem", break: "stacked_break",
    }, "fit", { value: fit, enumerable: false });
    const shirt = Object.freeze({
      type: "dress_shirt", collar: "spread_collar", wear: "tucked",
      sleeve: "half_sleeve", cuff: "french_double_cuff",
    });
    Object.freeze(pant);
    const locked = Object.freeze({ shirt, pant }) as unknown as StyleSpecV2;
    const review = () => styleDirectorConstructionIssues(locked).map(issue => issue.code);
    const first = review();
    for (const code of [
      "unknown_versioned_option", "short_sleeve_double_cuff",
      "cropped_type_hem_mismatch", "cropped_stacked_break",
    ]) assert.ok(first.includes(code), "hidden invalid fit concealed " + code);
    assert.deepEqual(review(), first);
    assert.equal(Object.getOwnPropertyDescriptor(pant, "fit")?.value, fit);
  }
});

test("own canonical fit overrides a hostile inherited accessor without executing it", () => {
  const prototype = Object.defineProperty({}, "fit", {
    get() { throw new Error("prototype getter must not execute"); },
  });
  const pant = Object.assign(Object.create(prototype) as Record<string, unknown>, {
    type: "cropped_ankle", pleat: "flat_front",
    hem: "plain_hem", break: "stacked_break",
  });
  Object.defineProperty(pant, "fit", {
    value: "slim_tapered", enumerable: false, configurable: true,
  });
  Object.freeze(pant);
  const shirt = Object.freeze({
    type: "dress_shirt", collar: "spread_collar", wear: "tucked",
    sleeve: "half_sleeve", cuff: "french_double_cuff",
  });
  const locked = Object.freeze({ shirt, pant }) as unknown as StyleSpecV2;
  const review = () => styleDirectorConstructionIssues(locked).map(issue => issue.code);
  const first = review();
  assert.ok(!first.includes("unknown_versioned_option"));
  for (const code of ["short_sleeve_double_cuff", "cropped_type_hem_mismatch", "cropped_stacked_break"]) {
    assert.ok(first.includes(code), "valid own fit hid " + code);
  }
  assert.deepEqual(review(), first);
  assert.equal(Object.getOwnPropertyDescriptor(pant, "fit")?.value, "slim_tapered");
});

test("unreadable proxy fit descriptors fail closed without hiding independent construction issues", () => {
  for (const trap of ["descriptor", "has"] as const) {
    const target = Object.freeze({
      type: "cropped_ankle", pleat: "flat_front",
      hem: "plain_hem", break: "stacked_break",
    });
    const pant = new Proxy(target, {
      getOwnPropertyDescriptor(object, key) {
        if (key === "fit" && trap === "descriptor") throw new Error("unreadable fit descriptor");
        return Reflect.getOwnPropertyDescriptor(object, key);
      },
      has(object, key) {
        if (key === "fit" && trap === "has") throw new Error("unreadable fit membership");
        return Reflect.has(object, key);
      },
    });
    const shirt = Object.freeze({
      type: "dress_shirt", collar: "spread_collar", wear: "tucked",
      sleeve: "half_sleeve", cuff: "french_double_cuff",
    });
    const locked = Object.freeze({ shirt, pant }) as unknown as StyleSpecV2;
    const review = () => styleDirectorConstructionIssues(locked).map(issue => issue.code);
    const first = review();
    for (const code of [
      "unknown_versioned_option", "short_sleeve_double_cuff",
      "cropped_type_hem_mismatch", "cropped_stacked_break",
    ]) assert.ok(first.includes(code), trap + " suppressed " + code);
    assert.deepEqual(review(), first);
    assert.equal(target.type, "cropped_ankle");
  }
});

test("own canonical fit does not consult a hostile proxy membership trap", () => {
  const target = Object.freeze({
    type: "cropped_ankle", fit: "slim_tapered", pleat: "flat_front",
    hem: "plain_hem", break: "stacked_break",
  });
  const pant = new Proxy(target, {
    has(object, key) {
      if (key === "fit") throw new Error("own fit must not require membership lookup");
      return Reflect.has(object, key);
    },
  });
  const shirt = Object.freeze({
    type: "dress_shirt", collar: "spread_collar", wear: "tucked",
    sleeve: "half_sleeve", cuff: "french_double_cuff",
  });
  const locked = Object.freeze({ shirt, pant }) as unknown as StyleSpecV2;
  const review = () => styleDirectorConstructionIssues(locked).map(issue => issue.code);
  const first = review();
  assert.ok(!first.includes("unknown_versioned_option"));
  for (const code of ["short_sleeve_double_cuff", "cropped_type_hem_mismatch", "cropped_stacked_break"]) {
    assert.ok(first.includes(code), "valid proxy-backed fit concealed " + code);
  }
  assert.deepEqual(review(), first);
  assert.equal(target.fit, "slim_tapered");
});
