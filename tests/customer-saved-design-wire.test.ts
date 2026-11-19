import test from "node:test";
import assert from "node:assert/strict";
import {
  CUSTOMER_SAVED_DESIGN_MAX_BYTES,
  parseCustomerSavedDesignWrite,
} from "../src/lib/customer-saved-design-wire.ts";

const valid = () => ({
  schemaVersion: 1,
  designId: "SD-recipe_1",
  title: "Blue shirt",
  recipe: {
    brief: {occasion: "office"},
    version: {id: "v_1", specHash: "abc"},
    renderSet: {views: []},
  },
});

test("versioned ordinary recipe is accepted without changing the locked vault contract", () => {
  assert.deepEqual(parseCustomerSavedDesignWrite(valid(), 400), valid());
});

test("client ownership, authorization and unknown fields fail closed", () => {
  for (const extra of [
    {ownerId: "alice"}, {customerId: "alice"}, {user_id: "alice"},
    {isLocked: true}, {authorization: "token"},
  ]) assert.equal(parseCustomerSavedDesignWrite({...valid(), ...extra}, 400), null);
  assert.equal(parseCustomerSavedDesignWrite({...valid(), recipe: {...valid().recipe, ownerId: "alice"}}, 400), null);
});

test("reject malformed and oversized recipes before persistence", () => {
  for (const value of [null, [], "string", {...valid(), schemaVersion: 2},
    {...valid(), designId: "../alice"}, {...valid(), title: "x".repeat(201)},
    {...valid(), recipe: {...valid().recipe, version: {id: ""}}},
    {...valid(), recipe: {...valid().recipe, brief: []}},
  ]) assert.equal(parseCustomerSavedDesignWrite(value, 400), null);
  for (const size of [0, -1, NaN, 1.5, CUSTOMER_SAVED_DESIGN_MAX_BYTES + 1])
    assert.equal(parseCustomerSavedDesignWrite(valid(), size), null);
});
