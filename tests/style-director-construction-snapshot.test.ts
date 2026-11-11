import assert from "node:assert/strict";
import test from "node:test";
import {
  styleDirectorConstructionIssues,
} from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

const validPartial = () => ({
  shirt: {
    type: "dress_shirt",
    collar: "point_standard_collar",
    cuff: "barrel_cuff_1_button",
    sleeve: "full_sleeve",
    wear: "tucked",
  },
  pant: {
    type: "formal_flat_front",
    pleat: "flat_front",
    fit: "straight_classic",
    waistband: "belt_loops",
    hem: "plain_hem",
    break: "no_break",
  },
});
type Locked = Pick<StyleSpecV2, "shirt" | "pant">;
const review = (value: unknown) =>
  styleDirectorConstructionIssues(value as Locked).map(issue => issue.code);

test("construction checks preserve ordinary and frozen persisted option snapshots", () => {
  const original = validPartial();
  assert.deepEqual(review(original), []);
  assert.deepEqual(review(original), [], "repeated checks are deterministic");
  const frozen = Object.freeze({
    shirt: Object.freeze({ ...original.shirt }),
    pant: Object.freeze({ ...original.pant }),
  });
  const before = JSON.stringify(frozen);
  assert.deepEqual(review(frozen), []);
  assert.equal(JSON.stringify(frozen), before, "locked option IDs never mutate");
  assert.deepEqual(review({ ...original, shirt: { ...original.shirt, type: "bad_type" } }),
    ["unknown_versioned_option"], "unknown own data IDs still require review");
});

test("getter-backed shirt and pant data cannot fabricate construction approval", () => {
  for (const garment of ["shirt", "pant"] as const) {
    const original = validPartial();
    let calls = 0;
    const locked = { ...original };
    const field = garment === "shirt" ? "type" : "pleat";
    const unsafe = Object.defineProperty({ ...original[garment] }, field, {
      enumerable: true,
      configurable: true,
      get() {
        calls++;
        throw new Error("untrusted saved accessor must never be evaluated");
      },
    });
    locked[garment] = unsafe as never;
    assert.deepEqual(review(locked), ["unknown_versioned_option"], garment);
    assert.deepEqual(review(locked), ["unknown_versioned_option"], garment);
    assert.equal(calls, 0, "construction review cannot evaluate a saved getter");
  }
});

test("accessors on root garment fields cannot certify an approved locked design", () => {
  for (const garment of ["shirt", "pant"] as const) {
    const original = validPartial();
    let calls = 0;
    const forged = Object.defineProperty({ ...original }, garment, {
      enumerable: true,
      configurable: true,
      get() {
        calls++;
        return original[garment];
      },
    });
    assert.deepEqual(review(forged), ["unknown_versioned_option"], garment);
    assert.equal(calls, 0);
  }
  const inherited = Object.create(validPartial()) as Locked;
  assert.deepEqual(review(inherited), ["unknown_versioned_option"],
    "inherited garment records are not own persisted data");
});

test("revoked and hostile descriptor proxies fail closed without throwing", () => {
  const original = validPartial();
  for (const garment of ["shirt", "pant"] as const) {
    const trap = new Proxy(original[garment], {
      getOwnPropertyDescriptor() {
        throw new Error("hostile saved proxy");
      },
    });
    assert.deepEqual(review({ ...original, [garment]: trap }), ["unknown_versioned_option"]);
    const revoked = Proxy.revocable(original[garment], {});
    revoked.revoke();
    assert.deepEqual(review({ ...original, [garment]: revoked.proxy }),
      ["unknown_versioned_option"]);
  }
  const rootTrap = new Proxy(original, {
    getOwnPropertyDescriptor() {
      throw new Error("hostile root");
    },
  });
  assert.deepEqual(review(rootTrap), ["unknown_versioned_option"]);
  const revokedRoot = Proxy.revocable(original, {});
  revokedRoot.revoke();
  assert.deepEqual(review(revokedRoot.proxy), ["unknown_versioned_option"]);
});

test("inherited selector values cannot force a construction or replace own canonical data", () => {
  const original = validPartial();
  const fakeShirt = Object.create({ type: "camp_collar_resort", collar: "cuban_camp_collar" });
  Object.assign(fakeShirt, { cuff: "barrel_cuff_1_button", sleeve: "full_sleeve", wear: "tucked" });
  const fakePant = Object.create({ type: "double_pleat_high_rise" });
  Object.assign(fakePant, { pleat: "flat_front", fit: "straight_classic" });
  assert.deepEqual(review({ shirt: fakeShirt, pant: fakePant }), [],
    "inherited labels are not a positive reason to claim camp or high-rise construction");
  // A real own-data constraint must still be reviewed against the same snapshot.
  const contradiction = {
    ...original,
    shirt: { ...original.shirt, type: "camp_collar_resort", collar: "point_standard_collar" },
  };
  assert.deepEqual(review(contradiction), ["camp_collar_construction"]);
});
