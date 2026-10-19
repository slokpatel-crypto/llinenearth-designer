import assert from "node:assert/strict";
import test from "node:test";
import { FABRIC_STOCK } from "../src/lib/fabric-stock.ts";
import {
  TITAN_FABRIC_CATALOG, findTitanFabrics, readTitanFabricHandoff,
  titanFabricCollections, titanFabricHref,
} from "../src/lib/titan/fabric-handoff.ts";

test("TITAN displays real catalogue IDs and source-backed swatch paths only", () => {
  assert.ok(TITAN_FABRIC_CATALOG.length >= 60);
  assert.equal(new Set(TITAN_FABRIC_CATALOG.map(fabric => fabric.id)).size, TITAN_FABRIC_CATALOG.length);
  for (const fabric of TITAN_FABRIC_CATALOG) {
    const source = FABRIC_STOCK.find(entry => entry.id === fabric.id);
    assert.ok(source);
    assert.equal(source.swatchImageUrl, fabric.image);
    assert.equal(source.suitableFor.includes(fabric.kind === "shirt" ? "shirt" : "trouser"), true);
    assert.ok(fabric.image.startsWith("/fabrics/"));
    assert.equal(fabric.availabilityVerified, source.availabilityVerified === true);
  }
});

test("Every TITAN cloth transfers to exactly its permitted Designer garment", () => {
  for (const fabric of TITAN_FABRIC_CATALOG) {
    const href = titanFabricHref(fabric.kind, fabric.id);
    const parsed = new URL(href, "https://example.test");
    assert.equal(parsed.pathname, "/designer-studio");
    assert.deepEqual(readTitanFabricHandoff(parsed.search), { kind: fabric.kind, fabricId: fabric.id });
  }
  assert.throws(() => titanFabricHref("shirt", "linen-suiting-beige"));
  assert.throws(() => titanFabricHref("trouser", "linen-plain-60-sky-blue"));
  assert.throws(() => titanFabricHref("shirt", "unknown"));
});

test("Spoofed, cross-garment, ambiguous or injected TITAN links cannot change an outfit", () => {
  for (const query of [
    "",
    "?source=titan&kind=shirt",
    "?kind=shirt&fabric=linen-plain-60-sky-blue",
    "?source=other&kind=shirt&fabric=linen-plain-60-sky-blue",
    "?source=titan&kind=pant&fabric=linen-suiting-beige",
    "?source=titan&kind=trouser&fabric=linen-plain-60-sky-blue",
    "?source=titan&kind=shirt&fabric=linen-suiting-beige",
    "?source=titan&kind=shirt&fabric=unknown",
    "?source=titan&kind=shirt&fabric=linen-plain-60-sky-blue&fabric=linen-plain-60-peach",
    "?source=titan&source=titan&kind=shirt&fabric=linen-plain-60-sky-blue",
    "?source=titan&kind=shirt&kind=shirt&fabric=linen-plain-60-sky-blue",
    "?source=titan&kind=shirt&fabric=linen-plain-60-sky-blue&from=style-director",
    "?source=titan&kind=shirt&fabric=%3Cscript%3E",
  ]) assert.equal(readTitanFabricHandoff(query), null, query);
});

test("Catalogue discovery filters the real stock without introducing false availability", () => {
  const shirts = findTitanFabrics("shirt", "All", "");
  const trousers = findTitanFabrics("trouser", "All", "");
  assert.equal(shirts.length + trousers.length, TITAN_FABRIC_CATALOG.length);
  assert.ok(shirts.every(fabric => fabric.kind === "shirt"));
  assert.ok(trousers.every(fabric => fabric.kind === "trouser"));
  assert.ok(titanFabricCollections("shirt").includes("Linen Plain 60 Lea"));
  assert.deepEqual(titanFabricCollections("trouser"), ["Linen Suiting"]);
  assert.equal(findTitanFabrics("shirt", "Linen Print 60 Lea", "").every(fabric => fabric.line === "Linen Print 60 Lea"), true);
  assert.ok(findTitanFabrics("shirt", "All", "SKY blue").some(fabric => fabric.id === "linen-plain-60-sky-blue"));
  assert.deepEqual(findTitanFabrics("trouser", "All", "sky blue"), []);
});
