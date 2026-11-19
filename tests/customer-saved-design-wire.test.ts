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


test("nested recipe ownership claims and cyclic payloads fail closed", () => {
  for (const recipe of [
    {...valid().recipe, brief: {customerId: "bob"}},
    {...valid().recipe, version: {id: "v_1", metadata: {owner_id: "bob"}}},
    {...valid().recipe, renderSet: {views: [{authorization: "secret"}]}},
    {...valid().recipe, brief: JSON.parse('{"__proto__":{"isAdmin":true}}')},
  ]) assert.equal(parseCustomerSavedDesignWrite({...valid(), recipe}, 400), null);
  const cyclic: Record<string, unknown> = {occasion: "office"};
  cyclic.self = cyclic;
  assert.equal(parseCustomerSavedDesignWrite({...valid(), recipe: {...valid().recipe, brief: cyclic}}, 400), null);
});
