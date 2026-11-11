import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";
import type { FabricColorway } from "../src/lib/fabric-stock.ts";
import { styleDirectorStockSnapshot } from "../src/lib/designer/style-director-stock-snapshot.ts";

register(new URL("./helpers/style-director-alias-loader.mjs", import.meta.url), import.meta.url);

const stockFixture = (): FabricColorway => ({
  id: "snapshot-shirt-blue", family: "Linen", line: "Linen Plain 60 Lea",
  colorName: "Sky Blue", hex: "#839197", swatchImageUrl: "/fabrics/plain-60-01.webp",
  suitableFor: ["shirt"], pattern: "Plain",
  sourceDocument: "Linen plain colors 60lea.pdf", sourcePage: 1, inStock: true,
  yarnCountLea: [60], compositionNote: "Supplier catalogue example",
});

test("a valid swatch becomes a stable catalogue copy, not fabricated physical approval", () => {
  const original = stockFixture();
  const saved = JSON.stringify(original);
  const selected = styleDirectorStockSnapshot([original]);
  assert.equal(selected.length, 1);
  assert.notEqual(selected[0], original);
  assert.deepEqual(selected[0], original);
  assert.notEqual(selected[0].suitableFor, original.suitableFor);
  assert.notEqual(selected[0].yarnCountLea, original.yarnCountLea);
  original.suitableFor[0] = "trouser";
  original.yarnCountLea![0] = 70;
  assert.deepEqual(selected[0].suitableFor, ["shirt"]);
  assert.deepEqual(selected[0].yarnCountLea, [60]);
  assert.equal(selected[0].availabilityVerified, undefined,
    "inStock is a catalogue flag, not operator-confirmed available metres");
  assert.notEqual(JSON.stringify(original), saved);
  assert.deepEqual(styleDirectorStockSnapshot([Object.freeze(stockFixture())]), [stockFixture()]);
});

test("corrupt, absent, inaccessible and accessor-backed catalogue rows fail closed independently", () => {
  const clean = stockFixture();
  let getterCalls = 0;
  const accessor = Object.defineProperty({ ...clean }, "suitableFor", {
    enumerable: true,
    configurable: true,
    get() {
      getterCalls++;
      throw new Error("stored garment getter must never be evaluated");
    },
  });
  const maliciousOptional = Object.defineProperty({ ...clean }, "yarnCountLea", {
    enumerable: true,
    get() {
      getterCalls++;
      throw new Error("catalogue yarn getter must never be evaluated");
    },
  });
  const badRoleArray = [...clean.suitableFor];
  Object.defineProperty(badRoleArray, "0", {
    enumerable: true,
    get() { getterCalls++; return "shirt"; },
  });
  const revoked = Proxy.revocable(clean, {});
  revoked.revoke();
  const hostile = new Proxy(clean, {
    ownKeys() { throw new Error("hostile persisted stock row"); },
  });
  const rows: unknown[] = [
    null, undefined, {}, { ...clean, inStock: false },
    { ...clean, suitableFor: null }, { ...clean, suitableFor: badRoleArray },
    { ...clean, hex: "invalid" }, { ...clean, pattern: null },
    { ...clean, sourcePage: -1 }, { ...clean, yarnCountLea: [Number.NaN] },
    { ...clean, weightGsm: -99 }, { ...clean, availabilityVerified: "yes" },
    { ...clean, suitableFor: ["made_up_role"] },
    accessor, maliciousOptional, revoked.proxy, hostile,
    clean,
  ];
  const snapshot = styleDirectorStockSnapshot(rows);
  assert.deepEqual(snapshot.map(f => f.id), [clean.id]);
  assert.equal(getterCalls, 0);
});

test("an accessor-backed array slot and inherited stock fields cannot shadow valid later swatches", () => {
  const valid = stockFixture();
  const inherited = Object.create(valid) as FabricColorway;
  const inaccessibleRows: unknown[] = [null, valid];
  let arrayGetterCalls = 0;
  Object.defineProperty(inaccessibleRows, "0", {
    get() { arrayGetterCalls++; throw new Error("untrusted array index"); },
    configurable: true,
  });
  assert.throws(() => [...inaccessibleRows], /untrusted array index/,
    "ordinary spreading invokes the malicious accessor");
  assert.equal(arrayGetterCalls, 1);
  const direct = styleDirectorStockSnapshot(inaccessibleRows);
  assert.deepEqual(direct.map(s => s.id), [valid.id]);
  assert.equal(arrayGetterCalls, 1, "snapshot must read index descriptors without invoking getters");
  assert.deepEqual(styleDirectorStockSnapshot([inherited, valid]).map(s => s.id), [valid.id],
    "inherited catalogue availability and IDs are not trusted");
});

test("Style Director preserves valid hero and pairing despite malformed duplicate-ID stock", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"), import("@/lib/style-director-agent"),
  ]);
  const shirt = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("shirt"));
  const trouser = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("trouser"));
  assert.ok(shirt && trouser);
  const corruptedSameId = { ...shirt, suitableFor: "shirt" };
  const noHex = { ...shirt, hex: "" };
  const malformedPant = { ...trouser, suitableFor: null };
  const catalogue = [corruptedSameId, noHex, malformedPant, shirt, trouser] as FabricColorway[];
  const before = JSON.stringify(catalogue);
  const looks = createStyleDirectorLooks({
    occasion: "Travel", mood: "Relaxed", time: "Day", climate: "Hot",
    garment: "shirt", colorDirection: "Surprise me",
  }, catalogue);
  assert.equal(looks.length, 1);
  assert.equal(looks[0].fabric.id, shirt.id);
  assert.equal(looks[0].realModel?.pantId, trouser.id,
    "a malformed earlier pairing row must not hide a valid trouser");
  assert.equal(JSON.stringify(catalogue), before,
    "never mutate a user-supplied catalogue during safety normalization");
  assert.equal(looks[0].fabric.availabilityVerified, shirt.availabilityVerified,
    "a snapshot cannot invent physical stock verification");
});

test("only malformed stock produces no looks; valid nearby rows still get real options", async () => {
  const { createStyleDirectorLooks } = await import("@/lib/style-director-agent");
  const result = createStyleDirectorLooks({
    occasion: "Work", mood: "Quiet", time: "Day", climate: "Indoor",
    garment: "shirt", colorDirection: "Blue",
  }, [{ ...stockFixture(), hex: "not-a-hex" }] as FabricColorway[]);
  assert.deepEqual(result, [], "never fabricate a normal stock fallback for bad supplied rows");
  const unavailable = styleDirectorStockSnapshot([{
    ...stockFixture(), inStock: false, availabilityVerified: true,
  }]);
  assert.deepEqual(unavailable, [],
    "a supplier's availability claim cannot override an unavailable stock marker");
});


test("operator metadata numeric bounds apply to later catalogue snapshots, including both edges", () => {
  // Align with parseMetadata() in designer-fabric-metadata: GSM 40..1000,
  // formality score 1..5. Boundary values must remain usable; invalid
  // values must not masquerade as verified physical material evidence.
  const allowed = [
    { weightGsm: 40, formalityScore: 1 },
    { weightGsm: 1000, formalityScore: 5 },
    { weightGsm: 180, formalityScore: 3.5 },
  ];
  for (const sample of allowed) {
    const row = { ...stockFixture(), ...sample };
    const copy = styleDirectorStockSnapshot([row]);
    assert.equal(copy.length, 1, "valid metadata at an inclusive boundary must be retained");
    assert.equal(copy[0].weightGsm, sample.weightGsm);
    assert.equal(copy[0].formalityScore, sample.formalityScore);
    assert.equal(copy[0].availabilityVerified, undefined,
      "numeric stock fields do not imply verified metreage");
  }
  for (const gsm of [0, -1, 39.99, 1000.01, 1200, Number.NaN,
    Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const invalid = { ...stockFixture(), weightGsm: gsm };
    assert.deepEqual(styleDirectorStockSnapshot([invalid]), [],
      "reject impossible/out-of-policy GSM: " + String(gsm));
  }
  for (const score of [-100, 0, 0.99, 5.01, 6, 100, Number.NaN,
    Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const invalid = { ...stockFixture(), formalityScore: score };
    assert.deepEqual(styleDirectorStockSnapshot([invalid]), [],
      "reject out-of-range styling score: " + String(score));
  }
});

test("bad numeric metadata on a duplicate does not shadow an eligible physically catalogued row", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"), import("@/lib/style-director-agent"),
  ]);
  const shirt = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("shirt"));
  const pant = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("trouser"));
  assert.ok(shirt && pant);
  const supplied = [
    { ...shirt, weightGsm: 1 },
    { ...pant, formalityScore: -100 },
    shirt, pant,
  ] as FabricColorway[];
  const saved = JSON.stringify(supplied);
  const result = createStyleDirectorLooks({
    occasion: "Travel", mood: "Relaxed", time: "Day", climate: "Hot",
    garment: "shirt", colorDirection: "Surprise me",
  }, supplied);
  assert.equal(result.length, 1);
  assert.equal(result[0].fabric.id, shirt.id,
    "malformed first duplicate must not hide a later valid hero fabric");
  assert.equal(result[0].realModel?.pantId, pant.id,
    "malformed trouser score must not shadow a valid supporting trouser");
  assert.equal(JSON.stringify(supplied), saved, "source catalogue remains immutable");
  assert.equal(result[0].fabric.weightGsm, shirt.weightGsm,
    "invalid GSM cannot be copied into generated look");
});
