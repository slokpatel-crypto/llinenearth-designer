import test from "node:test";
import assert from "node:assert/strict";
import {
  HOUSE_EASE_TABLE_VERSION,
  HOUSE_SHIRT_EASE,
  HOUSE_TROUSER_EASE,
  validateHouseEaseTables,
} from "../src/lib/designer/house-ease.ts";

test("provisional house ease table is internally valid",()=>{
  assert.equal(HOUSE_EASE_TABLE_VERSION,"linen-earth-house-ease-provisional-v1");
  assert.equal(validateHouseEaseTables(),true);
});

test("shirt ease expands progressively from slim to relaxed",()=>{
  assert.ok(HOUSE_SHIRT_EASE.slim.chest.max < HOUSE_SHIRT_EASE.regular.chest.max);
  assert.ok(HOUSE_SHIRT_EASE.regular.chest.max < HOUSE_SHIRT_EASE.relaxed.chest.max);
  assert.ok(HOUSE_SHIRT_EASE.slim.waist.max < HOUSE_SHIRT_EASE.relaxed.waist.max);
});

test("wide trouser retains at least as much seat and knee ease as flat front",()=>{
  assert.ok(HOUSE_TROUSER_EASE.wide.seat.min >= HOUSE_TROUSER_EASE.flat.seat.min);
  assert.ok(HOUSE_TROUSER_EASE.wide.knee.min >= HOUSE_TROUSER_EASE.flat.knee.min);
});
