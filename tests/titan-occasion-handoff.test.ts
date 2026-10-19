import assert from "node:assert/strict";
import test from "node:test";
import { TITAN_OCCASIONS, isTitanOccasion, readTitanOccasion, titanOccasionHref } from "../src/lib/titan/occasion-handoff.ts";

test("Every real Style Director occasion round-trips through the TITAN handoff", () => {
  assert.equal(TITAN_OCCASIONS.length, 6);
  assert.equal(new Set(TITAN_OCCASIONS).size, TITAN_OCCASIONS.length);
  for (const occasion of TITAN_OCCASIONS) {
    assert.equal(isTitanOccasion(occasion), true);
    const href = titanOccasionHref(occasion);
    assert.equal(new URL(href, "https://example.test").pathname, "/style-director");
    assert.equal(readTitanOccasion(new URL(href, "https://example.test").search), occasion);
  }
});

test("Unknown, spoofed, and ambiguous occasion parameters cannot prefill customer choices", () => {
  for (const search of [
    "",
    "?occasion=Work",
    "?source=other&occasion=Work",
    "?source=titan",
    "?source=titan&occasion=work",
    "?source=titan&occasion=Work%20",
    "?source=titan&occasion=Unknown",
    "?source=titan&occasion=Work&occasion=Travel",
    "?source=titan&source=titan&occasion=Work",
    "?source=titan&occasion=%3Cscript%3E",
  ]) {
    assert.equal(readTitanOccasion(search), null, search);
  }
  assert.equal(isTitanOccasion("Work "), false);
  assert.equal(isTitanOccasion("work"), false);
});
