import assert from "node:assert/strict";
import test from "node:test";
import { TITAN_FABRIC_CATALOG } from "../src/lib/titan/fabric-handoff.ts";
import {
  TITAN_LOOKBOOK_LIMIT, TITAN_LOOKBOOK_KEY, addTitanLookbookPair,
  cleanTitanLookbook, readTitanLookbook, removeTitanLookbookPair, serializeTitanLookbook,
} from "../src/lib/titan/reference-lookbook.ts";

const shirts = TITAN_FABRIC_CATALOG.filter(item => item.kind === "shirt");
const trousers = TITAN_FABRIC_CATALOG.filter(item => item.kind === "trouser");
const first = { shirtId: shirts[0].id, trouserId: trousers[0].id };
const second = { shirtId: shirts[1].id, trouserId: trousers[1].id };

test("TITAN device lookbook saves public IDs only under its own namespaced key", () => {
  assert.equal(TITAN_LOOKBOOK_KEY, "linen-earth:titan-reference-lookbook:v1");
  assert.deepEqual(readTitanLookbook(null), []);
  const fresh = addTitanLookbookPair([], first);
  const payload = serializeTitanLookbook(fresh);
  assert.deepEqual(JSON.parse(payload), { version: 1, pairs: [first] });
  assert.deepEqual(readTitanLookbook(payload), [first]);
  assert.ok(!/customer|measurement|occasion|profile|design|stock/i.test(payload));
});

test("TITAN lookbook keeps insertion order and does not change original arrays", () => {
  const initial = [first];
  const snapshot = JSON.stringify(initial);
  const withSecond = addTitanLookbookPair(initial, second);
  assert.deepEqual(withSecond, [first, second]);
  assert.equal(JSON.stringify(initial), snapshot);
  assert.deepEqual(addTitanLookbookPair(withSecond, first), withSecond);
  assert.deepEqual(removeTitanLookbookPair(withSecond, first), [second]);
  assert.deepEqual(removeTitanLookbookPair(withSecond, first), [second]);
  assert.deepEqual(removeTitanLookbookPair(withSecond, { shirtId: "invalid", trouserId: first.trouserId }), withSecond);
});

test("TITAN lookbook rejects forged fields, bad versions and unsupported references", () => {
  const malformed = [
    "", "{", "[]", "null", "42",
    JSON.stringify({ version: 2, pairs: [first] }),
    JSON.stringify({ version: 1, pairs: [first], email: "fake@example.com" }),
    JSON.stringify({ version: 1, pairs: "wrong-shape" }),
    " ".repeat(4097),
  ];
  for (const raw of malformed) assert.deepEqual(readTitanLookbook(raw), [], raw.slice(0, 60));
  const suspicious = [
    null,
    { shirtId: "not-catalogued", trouserId: first.trouserId },
    { shirtId: first.trouserId, trouserId: first.shirtId },
    { ...first, measurement: 94 },
    { ...first, email: "owner@example.com" },
    { shirtId: "<script>", trouserId: first.trouserId },
    { shirtId: first.shirtId },
    [first.shirtId, first.trouserId],
  ];
  for (const item of suspicious) {
    assert.deepEqual(addTitanLookbookPair([first], item), [first]);
  }
  const raw = JSON.stringify({ version: 1, pairs: [null, { ...first, fake: true }, first, first, ...suspicious, second] });
  assert.deepEqual(readTitanLookbook(raw), [first, second],
    "Corrupt entries must not override valid public cloth references");
});

test("TITAN lookbook enforces a hard six-pair cap without silently dropping bookmarks", () => {
  assert.ok(shirts.length >= 6 && trousers.length >= 1);
  const six = shirts.slice(0, TITAN_LOOKBOOK_LIMIT).map(shirt => ({ shirtId: shirt.id, trouserId: trousers[0].id }));
  const seventh = { shirtId: shirts[6].id, trouserId: trousers[0].id };
  assert.deepEqual(cleanTitanLookbook([...six, seventh]), six);
  assert.deepEqual(addTitanLookbookPair(six, seventh), six);
  assert.deepEqual(addTitanLookbookPair(removeTitanLookbookPair(six, six[0]), seventh), [...six.slice(1), seventh]);
  assert.equal(readTitanLookbook(serializeTitanLookbook([...six, seventh])).length, 6);
});

test("Every existing catalogue shirt/trouser combination is either saved exactly or rejected by capacity", () => {
  for (const shirt of shirts) {
    for (const trouser of trousers) {
      const pair = { shirtId: shirt.id, trouserId: trouser.id };
      assert.deepEqual(addTitanLookbookPair([], pair), [pair]);
      assert.deepEqual(readTitanLookbook(serializeTitanLookbook([pair])), [pair]);
    }
  }
});
