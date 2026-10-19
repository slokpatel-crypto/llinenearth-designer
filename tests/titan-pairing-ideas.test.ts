import assert from "node:assert/strict";
import test from "node:test";
import { TITAN_FABRIC_CATALOG } from "../src/lib/titan/fabric-handoff.ts";
import { suggestTitanPairings } from "../src/lib/titan/pairing-ideas.ts";

test("TITAN pairing ideas cover every real garment reference without invented IDs or paid AI", () => {
  const snapshot = JSON.stringify(TITAN_FABRIC_CATALOG);
  const allIds = new Set(TITAN_FABRIC_CATALOG.map(item => item.id));
  const shirts = TITAN_FABRIC_CATALOG.filter(item => item.kind === "shirt");
  const trousers = TITAN_FABRIC_CATALOG.filter(item => item.kind === "trouser");
  assert.ok(shirts.length >= 20 && trousers.length >= 10, "Real catalogue must not silently shrink");
  for (const anchor of TITAN_FABRIC_CATALOG) {
    const suggestions = suggestTitanPairings(anchor.kind, anchor.id);
    assert.equal(suggestions.length, 3, `Expected three existing references for ${anchor.id}`);
    assert.deepEqual(suggestions, suggestTitanPairings(anchor.kind, anchor.id), "Pure rules must be reproducible");
    assert.equal(new Set(suggestions.map(item => item.counterpart.id)).size, 3, "No duplicate suggestions");
    for (const suggestion of suggestions) {
      assert.ok(allIds.has(suggestion.shirtId));
      assert.ok(allIds.has(suggestion.trouserId));
      assert.equal(TITAN_FABRIC_CATALOG.find(item => item.id === suggestion.shirtId)?.kind, "shirt");
      assert.equal(TITAN_FABRIC_CATALOG.find(item => item.id === suggestion.trouserId)?.kind, "trouser");
      assert.equal(anchor.kind === "shirt" ? suggestion.shirtId : suggestion.trouserId, anchor.id,
        "A suggestion must never silently replace the customer's chosen garment");
      assert.equal(suggestion.counterpart.kind, anchor.kind === "shirt" ? "trouser" : "shirt");
      assert.ok(suggestion.title.length && suggestion.reason.length);
      assert.doesNotMatch(suggestion.reason, /verified stock|exact color|exact colour|physical fit|measured drape/i);
    }
  }
  assert.equal(JSON.stringify(TITAN_FABRIC_CATALOG), snapshot, "Suggestions must not mutate catalogue entries");
});

test("TITAN pairing suggestions fail closed on unknown, swapped and spoofed IDs", () => {
  assert.deepEqual(suggestTitanPairings("shirt", "does-not-exist"), []);
  assert.deepEqual(suggestTitanPairings("trouser", "linen-plain-60-sky-blue"), []);
  assert.deepEqual(suggestTitanPairings("shirt", "linen-suiting-beige"), []);
  assert.deepEqual(suggestTitanPairings("shirt", "<script>alert(1)</script>"), []);
  assert.deepEqual(suggestTitanPairings("shirt", ""), []);
});

test("TITAN editorial rules keep print with plain trouser alternatives", () => {
  const ideas = suggestTitanPairings("shirt", "linen-print-60-01");
  assert.deepEqual(ideas.map(idea => idea.trouserId), [
    "linen-suiting-dark-grey", "linen-suiting-beige", "linen-suiting-slate-gray",
  ]);
  assert.ok(ideas.every(idea => idea.reason.includes("plain")));
});

test("TITAN trouser alternatives use genuine plain/printed shirt options where intended", () => {
  const ideas = suggestTitanPairings("trouser", "linen-suiting-dark-grey");
  assert.deepEqual(ideas.map(idea => idea.shirtId), [
    "linen-plain-60-jute-offwhite", "linen-plain-60-sky-blue", "linen-print-60-01",
  ]);
  assert.equal(suggestTitanPairings("trouser", "linen-suiting-beige")[0].shirtId, "linen-plain-60-sky-blue");
});
