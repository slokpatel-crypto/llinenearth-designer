import assert from "node:assert/strict";
import test from "node:test";
import { TITAN_FABRIC_CATALOG } from "../src/lib/titan/fabric-handoff.ts";
import { readTitanSharedOutfit, titanOutfitShareHref } from "../src/lib/titan/outfit-share.ts";

test("TITAN can share every genuine shirt with a genuine trouser without a saved design", () => {
  const shirts = TITAN_FABRIC_CATALOG.filter(fabric => fabric.kind === "shirt");
  const trousers = TITAN_FABRIC_CATALOG.filter(fabric => fabric.kind === "trouser");
  assert.ok(shirts.length > 0 && trousers.length > 0);
  for (const shirt of shirts) {
    for (const trouser of trousers) {
      const href = titanOutfitShareHref(shirt.id, trouser.id);
      const url = new URL(href, "https://example.test");
      assert.equal(url.pathname, "/titan");
      assert.equal(url.hash, "#titan-outfit-builder");
      assert.deepEqual(readTitanSharedOutfit(url.search), { shirtId: shirt.id, trouserId: trouser.id });
      assert.equal(url.searchParams.getAll("shirt").length, 1);
      assert.equal(url.searchParams.getAll("trouser").length, 1);
    }
  }
});

test("TITAN shared pairs cannot import unknown, ambiguous, malicious or switched fabric references", () => {
  for (const query of [
    "", "?shirt=linen-plain-60-sky-blue&trouser=linen-suiting-beige",
    "?source=outfit&shirt=linen-plain-60-sky-blue",
    "?source=outfit&trouser=linen-suiting-beige",
    "?source=titan&shirt=linen-plain-60-sky-blue&trouser=linen-suiting-beige",
    "?source=outfit&shirt=linen-suiting-beige&trouser=linen-plain-60-sky-blue",
    "?source=outfit&shirt=linen-plain-60-sky-blue&trouser=unknown",
    "?source=outfit&shirt=unknown&trouser=linen-suiting-beige",
    "?source=outfit&shirt=linen-plain-60-sky-blue&shirt=linen-plain-60-peach&trouser=linen-suiting-beige",
    "?source=outfit&shirt=linen-plain-60-sky-blue&trouser=linen-suiting-beige&trouser=linen-suiting-orchid",
    "?source=outfit&source=outfit&shirt=linen-plain-60-sky-blue&trouser=linen-suiting-beige",
    "?source=outfit&shirt=linen-plain-60-sky-blue&trouser=linen-suiting-beige&occasion=Wedding",
    "?source=outfit&shirt=%3Cscript%3E&trouser=linen-suiting-beige",
  ]) assert.equal(readTitanSharedOutfit(query), null, query);
  assert.throws(() => titanOutfitShareHref("linen-suiting-beige", "linen-plain-60-sky-blue"));
  assert.throws(() => titanOutfitShareHref("linen-plain-60-sky-blue", "unknown"));
  assert.throws(() => titanOutfitShareHref("unknown", "linen-suiting-beige"));
});
