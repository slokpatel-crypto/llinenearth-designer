import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

// The production agent uses Next.js "@/..." aliases, and the engine has
// some historical JSON imports without attributes. Load the unchanged real
// modules in Node through a test-only loader instead of testing source text.
register(new URL("./helpers/style-director-alias-loader.mjs", import.meta.url), import.meta.url);

test("createStyleDirectorLooks reconstructs an actual catalogued resort shirt look", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"),
    import("@/lib/style-director-agent"),
  ]);

  const shirt = FABRIC_STOCK.find((fabric) =>
    fabric.inStock && fabric.suitableFor.includes("shirt"));
  const pant = FABRIC_STOCK.find((fabric) =>
    fabric.inStock && fabric.suitableFor.includes("trouser"));
  assert.ok(shirt && pant, "the stock library needs a shirt and a trouser fixture");
  const stock = [shirt, pant];
  const before = JSON.stringify(stock);
  const answers = {
    occasion: "Travel" as const,
    mood: "Relaxed" as const,
    time: "Day" as const,
    climate: "Hot" as const,
    garment: "shirt" as const,
    colorDirection: "Surprise me" as const,
  };
  const looks = createStyleDirectorLooks(answers, stock);
  assert.equal(looks.length, 1, "one eligible shirt yields one catalogue recommendation");
  const repeated = createStyleDirectorLooks(answers, stock);
  // Version creation timestamps legitimately differ across two requests.
  // Assert their validity separately; compare every deterministic field.
  const withoutClock = (items: typeof looks) => items.map((look) => ({
    ...look,
    version: { ...look.version, createdAt: "<creation-time>" },
  }));
  for (const look of [...looks, ...repeated]) {
    assert.ok(Number.isFinite(Date.parse(look.version.createdAt)),
      "every newly created version must have a valid timestamp");
  }
  assert.deepEqual(withoutClock(looks), withoutClock(repeated),
    "recommendation content and versioned selections must be deterministic");
  assert.equal(JSON.stringify(stock), before, "recommendations must not mutate stock");

  const look = looks[0];
  assert.ok(look.candidate.garments.shirt.includes("Camp-Collar"));
  assert.ok(look.realModel, "a catalogue shirt plus trouser should produce a model handoff");
  assert.equal(look.realModel.shirtId, shirt.id);
  assert.equal(look.realModel.pantId, pant.id);
  assert.equal(look.realModel.styleSpec.styleSchemaVersion, 2);
  assert.equal(look.realModel.styleSpec.shirt.type, "camp_collar_resort");
  assert.equal(look.realModel.styleSpec.shirt.collar, "cuban_camp_collar");
  assert.equal(look.realModel.styleSpec.shirt.wear, "untucked");
  assert.equal(look.realModel.style.shirtWear, "Untucked");
  assert.equal(look.realModel.status, "needs_review",
    "the currently unverified camp-collar photograph cannot become an approved rendering");
  assert.match(look.realModel.reason, /Construction review:/);
});

test("createStyleDirectorLooks keeps selected trouser and versioned garment aligned", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"),
    import("@/lib/style-director-agent"),
  ]);
  const shirt = FABRIC_STOCK.find((fabric) =>
    fabric.inStock && fabric.suitableFor.includes("shirt"));
  const pant = FABRIC_STOCK.find((fabric) =>
    fabric.inStock && fabric.suitableFor.includes("trouser"));
  assert.ok(shirt && pant);

  const looks = createStyleDirectorLooks({
    occasion: "Work", mood: "Sharp", time: "Day",
    climate: "Indoor", garment: "trouser", colorDirection: "Dark",
  }, [shirt, pant]);
  assert.equal(looks.length, 1);
  assert.ok(looks[0].realModel);
  const model = looks[0].realModel;
  assert.equal(model.shirtId, shirt.id);
  assert.equal(model.pantId, pant.id);
  assert.equal(model.styleSpec.styleSchemaVersion, 2);
  assert.equal(model.styleSpec.pant.type, "pleated_trouser",
    "the elevated Single-Pleat Tailored Trouser must keep its canonical ID");
  assert.equal(model.styleSpec.pant.pleat, "single_pleat_forward");
  assert.equal(model.style.trouser, "Pleated Trouser");
  assert.ok(["preliminary", "needs_review"].includes(model.status));
});

test("actual Style Director avoids fabricating a paired model without both stock garments", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"),
    import("@/lib/style-director-agent"),
  ]);
  const shirt = FABRIC_STOCK.find((fabric) => fabric.inStock && fabric.suitableFor.includes("shirt"));
  const pant = FABRIC_STOCK.find((fabric) => fabric.inStock && fabric.suitableFor.includes("trouser"));
  assert.ok(shirt && pant);
  const shirtAnswers = {
    occasion: "Travel" as const, mood: "Relaxed" as const, time: "Day" as const,
    climate: "Hot" as const, garment: "shirt" as const,
    colorDirection: "Surprise me" as const,
  };
  const pantAnswers = {
    ...shirtAnswers, garment: "trouser" as const,
  };
  const missingPant = createStyleDirectorLooks(shirtAnswers, [shirt]);
  assert.equal(missingPant.length, 1);
  assert.equal(missingPant[0].realModel, undefined,
    "missing matching trousers must not manufacture a real-model handoff");
  assert.equal(missingPant[0].fabric.id, shirt.id);

  const missingShirt = createStyleDirectorLooks(pantAnswers, [pant]);
  assert.equal(missingShirt.length, 1);
  assert.equal(missingShirt[0].realModel, undefined,
    "missing matching shirts must not manufacture a real-model handoff");
  assert.equal(missingShirt[0].fabric.id, pant.id);

  const unavailablePant = { ...pant, inStock: false };
  const shirtOnly = createStyleDirectorLooks(shirtAnswers, [shirt, unavailablePant]);
  assert.equal(shirtOnly.length, 1);
  assert.equal(shirtOnly[0].realModel, undefined,
    "out-of-stock supporting fabric must not enter pair recommendations");

  assert.deepEqual(createStyleDirectorLooks(shirtAnswers, [
    { ...shirt, inStock: false }, pant,
  ]), [], "out-of-stock hero shirting must not be recommended");
  assert.deepEqual(createStyleDirectorLooks(pantAnswers, [
    shirt, { ...pant, inStock: false },
  ]), [], "out-of-stock hero suiting must not be recommended");
});


test("Style Director returns no fabricated recommendations for an empty or unavailable catalogue", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"),
    import("@/lib/style-director-agent"),
  ]);
  const answers = {
    occasion: "Travel" as const, mood: "Relaxed" as const,
    time: "Day" as const, climate: "Hot" as const,
    garment: "shirt" as const, colorDirection: "Surprise me" as const,
  };
  assert.deepEqual(createStyleDirectorLooks(answers, []), [],
    "an empty catalogue must not fall back to default production stock");
  const unavailable = FABRIC_STOCK.map(fabric => ({ ...fabric, inStock: false }));
  const before = JSON.stringify(unavailable);
  assert.deepEqual(createStyleDirectorLooks(answers, unavailable), [],
    "unavailable fabrics must never produce a recommended look");
  assert.equal(JSON.stringify(unavailable), before,
    "a rejected catalogue must remain unchanged");
});

test("unavailable hero fabric cannot enter a mixed catalogue recommendation", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"), import("@/lib/style-director-agent"),
  ]);
  const shirts = FABRIC_STOCK.filter(f => f.inStock && f.suitableFor.includes("shirt"));
  assert.ok(shirts.length >= 2, "requires distinct shirting fixtures");
  const catalogue = [{ ...shirts[0], inStock: false }, shirts[1]];
  const before = JSON.stringify(catalogue);
  const looks = createStyleDirectorLooks({
    occasion: "Travel", mood: "Relaxed", time: "Day",
    climate: "Hot", garment: "shirt", colorDirection: "Surprise me",
  }, catalogue);
  assert.equal(looks.length, 1);
  assert.equal(looks[0].fabric.id, shirts[1].id);
  assert.equal(JSON.stringify(catalogue), before);
});


test("unavailable trouser cannot enter a mixed trouser catalogue recommendation", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"), import("@/lib/style-director-agent"),
  ]);
  const trousers = FABRIC_STOCK.filter(f => f.inStock && f.suitableFor.includes("trouser"));
  assert.ok(trousers.length >= 2, "requires distinct trouser fixtures");
  const catalogue = [{ ...trousers[0], inStock: false }, trousers[1]];
  const before = JSON.stringify(catalogue);
  const looks = createStyleDirectorLooks({
    occasion: "Work", mood: "Sharp", time: "Day",
    climate: "Indoor", garment: "trouser", colorDirection: "Surprise me",
  }, catalogue);
  assert.equal(looks.length, 1);
  assert.equal(looks[0].fabric.id, trousers[1].id);
  assert.equal(JSON.stringify(catalogue), before);
});


test("unavailable supporting trouser is never selected when a stocked alternative exists", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"), import("@/lib/style-director-agent"),
  ]);
  const shirt = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("shirt"));
  const trousers = FABRIC_STOCK.filter(f => f.inStock && f.suitableFor.includes("trouser"));
  assert.ok(shirt && trousers.length >= 2);
  const catalogue = [shirt, { ...trousers[0], inStock: false }, trousers[1]];
  const before = JSON.stringify(catalogue);
  const looks = createStyleDirectorLooks({
    occasion: "Travel", mood: "Relaxed", time: "Day",
    climate: "Hot", garment: "shirt", colorDirection: "Surprise me",
  }, catalogue);
  assert.equal(looks.length, 1);
  assert.ok(looks[0].realModel, "an available supporting trouser should enable a model handoff");
  assert.equal(looks[0].realModel.pantId, trousers[1].id,
    "the unavailable supporting trouser must never be used in a real-model recommendation");
  assert.equal(looks[0].realModel.shirtId, shirt.id);
  assert.equal(JSON.stringify(catalogue), before, "ranking must not mutate the catalogue");
});


test("unavailable supporting shirt is never selected when a stocked alternative exists", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"), import("@/lib/style-director-agent"),
  ]);
  const pant = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("trouser"));
  const shirts = FABRIC_STOCK.filter(f => f.inStock && f.suitableFor.includes("shirt"));
  assert.ok(pant && shirts.length >= 2);
  const catalogue = [{ ...shirts[0], inStock: false }, shirts[1], pant];
  const before = JSON.stringify(catalogue);
  const looks = createStyleDirectorLooks({
    occasion: "Work", mood: "Sharp", time: "Day",
    climate: "Indoor", garment: "trouser", colorDirection: "Surprise me",
  }, catalogue);
  assert.equal(looks.length, 1);
  assert.ok(looks[0].realModel, "an available supporting shirt should enable a model handoff");
  assert.equal(looks[0].realModel.shirtId, shirts[1].id,
    "the unavailable supporting shirt must never be used in a real-model recommendation");
  assert.equal(looks[0].realModel.pantId, pant.id);
  assert.equal(JSON.stringify(catalogue), before, "ranking must not mutate the catalogue");
});

test("garment-ineligible supporting fabrics never become model pairings", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"), import("@/lib/style-director-agent"),
  ]);
  const shirt = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("shirt"));
  const pant = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("trouser"));
  assert.ok(shirt && pant);
  const shirtOnly = { ...shirt, suitableFor: ["shirt"] as typeof shirt.suitableFor };
  const pantOnly = { ...pant, suitableFor: ["trouser"] as typeof pant.suitableFor };
  const shirtAnswers = {
    occasion: "Travel" as const, mood: "Relaxed" as const, time: "Day" as const,
    climate: "Hot" as const, garment: "shirt" as const,
    colorDirection: "Surprise me" as const,
  };
  const trouserAnswers = {
    ...shirtAnswers, garment: "trouser" as const,
  };
  const unsuitablePant = { ...pantOnly, suitableFor: ["shirt"] as typeof pant.suitableFor };
  const unsuitableShirt = { ...shirtOnly, suitableFor: ["trouser"] as typeof shirt.suitableFor };
  const shirtCatalogue = [shirtOnly, unsuitablePant];
  const trouserCatalogue = [unsuitableShirt, pantOnly];
  const beforeShirt = JSON.stringify(shirtCatalogue);
  const beforeTrouser = JSON.stringify(trouserCatalogue);
  const shirtLooks = createStyleDirectorLooks(shirtAnswers, shirtCatalogue);
  const trouserLooks = createStyleDirectorLooks(trouserAnswers, trouserCatalogue);
  assert.equal(shirtLooks.length, 2, "both shirt-eligible entries remain candidate fabrics");
  for (const look of shirtLooks) {
    assert.equal(look.realModel, undefined,
      "a catalogue without trouser-eligible fabric cannot supply a trouser handoff");
  }
  assert.equal(trouserLooks.length, 2, "both trouser-eligible entries remain candidate fabrics");
  for (const look of trouserLooks) {
    assert.equal(look.realModel, undefined,
      "a catalogue without shirt-eligible fabric cannot supply a shirt handoff");
  }
  assert.equal(JSON.stringify(shirtCatalogue), beforeShirt);
  assert.equal(JSON.stringify(trouserCatalogue), beforeTrouser);
});

test("Style Director caps recommendations at three eligible fabrics without mutating ranking inputs", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"), import("@/lib/style-director-agent"),
  ]);
  const shirts = FABRIC_STOCK.filter(f => f.inStock && f.suitableFor.includes("shirt"));
  assert.ok(shirts.length >= 4, "requires four independently catalogued shirting fixtures");
  const catalogue = [shirts[0], shirts[1], shirts[2], shirts[3]];
  const before = JSON.stringify(catalogue);
  const looks = createStyleDirectorLooks({
    occasion: "Travel", mood: "Relaxed", time: "Day",
    climate: "Hot", garment: "shirt", colorDirection: "Surprise me",
  }, catalogue);
  assert.equal(looks.length, 3, "recommendation limit must not grow with catalogue size");
  assert.equal(new Set(looks.map(look => look.fabric.id)).size, 3,
    "each recommendation must reference a distinct real fabric");
  for (const look of looks) {
    assert.ok(catalogue.some(f => f.id === look.fabric.id),
      "all recommended fabrics must be sourced from the supplied catalogue");
  }
  assert.equal(JSON.stringify(catalogue), before, "ranking must not reorder or mutate input");
});


test("duplicate catalogue IDs cannot create duplicate Style Director looks", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"), import("@/lib/style-director-agent"),
  ]);
  const shirts = FABRIC_STOCK.filter(f => f.inStock && f.suitableFor.includes("shirt"));
  assert.ok(shirts.length >= 2);
  const catalogue = [shirts[0], { ...shirts[0] }, shirts[1]];
  const before = JSON.stringify(catalogue);
  const looks = createStyleDirectorLooks({
    occasion: "Travel", mood: "Relaxed", time: "Day",
    climate: "Hot", garment: "shirt", colorDirection: "Surprise me",
  }, catalogue);
  assert.equal(looks.length, 2, "one physical catalogue ID must yield at most one look");
  assert.equal(new Set(looks.map(look => look.fabric.id)).size, looks.length);
  assert.equal(new Set(looks.map(look => look.id)).size, looks.length);
  assert.equal(JSON.stringify(catalogue), before);
});

test("duplicate supporting catalogue IDs cannot change a selected physical fabric", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"), import("@/lib/style-director-agent"),
  ]);
  const shirt = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("shirt"));
  const pant = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("trouser"));
  assert.ok(shirt && pant);
  const answers = {
    occasion: "Travel" as const, mood: "Relaxed" as const, time: "Day" as const,
    climate: "Hot" as const, garment: "shirt" as const,
    colorDirection: "Surprise me" as const,
  };
  const baseline = createStyleDirectorLooks(answers, [shirt, pant]);
  const catalogue = [shirt, pant, { ...pant }, { ...shirt }];
  const before = JSON.stringify(catalogue);
  const repeated = createStyleDirectorLooks(answers, catalogue);
  assert.equal(repeated.length, 1);
  assert.equal(repeated[0].realModel?.shirtId, baseline[0].realModel?.shirtId);
  assert.equal(repeated[0].realModel?.pantId, baseline[0].realModel?.pantId);
  assert.equal(repeated[0].realModel?.styleSpec.styleSchemaVersion, 2);
  assert.equal(JSON.stringify(catalogue), before);
});

test("unavailable duplicate IDs do not shadow eligible physical stock", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"), import("@/lib/style-director-agent"),
  ]);
  const shirt = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("shirt"));
  const pant = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("trouser"));
  assert.ok(shirt && pant);
  const catalogue = [
    { ...shirt, inStock: false },
    { ...pant, inStock: false },
    shirt,
    pant,
  ];
  const before = JSON.stringify(catalogue);
  const looks = createStyleDirectorLooks({
    occasion: "Travel", mood: "Relaxed", time: "Day",
    climate: "Hot", garment: "shirt", colorDirection: "Surprise me",
  }, catalogue);
  assert.equal(looks.length, 1,
    "an unavailable duplicate must not suppress the stocked hero");
  assert.equal(looks[0].fabric.id, shirt.id);
  assert.equal(looks[0].realModel?.shirtId, shirt.id);
  assert.equal(looks[0].realModel?.pantId, pant.id,
    "an unavailable duplicate must not suppress the stocked pairing");
  assert.equal(JSON.stringify(catalogue), before,
    "duplicate availability filtering must not mutate input");
});

test("garment-ineligible duplicate rows cannot shadow eligible fabric IDs", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"), import("@/lib/style-director-agent"),
  ]);
  const shirt = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("shirt"));
  const pant = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("trouser"));
  assert.ok(shirt && pant);
  const catalogue = [
    { ...shirt, suitableFor: ["trouser"] as typeof shirt.suitableFor },
    { ...pant, suitableFor: ["shirt"] as typeof pant.suitableFor },
    shirt,
    pant,
  ];
  const before = JSON.stringify(catalogue);
  const common = {
    occasion: "Travel" as const, mood: "Relaxed" as const,
    time: "Day" as const, climate: "Hot" as const,
    colorDirection: "Surprise me" as const,
  };
  const shirtLooks = createStyleDirectorLooks({ ...common, garment: "shirt" }, catalogue);
  const pantLooks = createStyleDirectorLooks({ ...common, garment: "trouser" }, catalogue);
  assert.equal(shirtLooks.filter(look => look.fabric.id === shirt.id).length, 1,
    "an unsuitable earlier row must not suppress eligible shirting");
  assert.equal(pantLooks.filter(look => look.fabric.id === pant.id).length, 1,
    "an unsuitable earlier row must not suppress eligible trouser fabric");
  assert.equal(JSON.stringify(catalogue), before,
    "garment eligibility and duplicate handling must preserve caller-owned data");
});


test("a shirt-only duplicate cannot shadow a later trouser-eligible row in supporting pairings", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"), import("@/lib/style-director-agent"),
  ]);
  const shirt = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("shirt"));
  const pant = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("trouser") && f.id !== shirt?.id);
  assert.ok(shirt && pant);
  const catalogue = [
    shirt,
    { ...pant, suitableFor: ["shirt"] as typeof pant.suitableFor },
    pant,
  ];
  const before = JSON.stringify(catalogue);
  const looks = createStyleDirectorLooks({
    occasion: "Travel", mood: "Relaxed", time: "Day",
    climate: "Hot", garment: "shirt", colorDirection: "Surprise me",
  }, catalogue);
  const selected = looks.find(look => look.fabric.id === shirt.id);
  assert.ok(selected, "original eligible shirt remains recommendable");
  assert.equal(selected.realModel?.pantId, pant.id,
    "the earlier shirt-only duplicate must not hide the eligible supporting trouser");
  assert.equal(JSON.stringify(catalogue), before);
});


test("a trouser-only duplicate cannot shadow a later shirt-eligible row in supporting pairings", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"), import("@/lib/style-director-agent"),
  ]);
  const pant = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("trouser"));
  const shirt = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("shirt") && f.id !== pant?.id);
  assert.ok(shirt && pant);
  const catalogue = [
    pant,
    { ...shirt, suitableFor: ["trouser"] as typeof shirt.suitableFor },
    shirt,
  ];
  const before = JSON.stringify(catalogue);
  const looks = createStyleDirectorLooks({
    occasion: "Work", mood: "Sharp", time: "Day",
    climate: "Indoor", garment: "trouser", colorDirection: "Surprise me",
  }, catalogue);
  const selected = looks.find(look => look.fabric.id === pant.id);
  assert.ok(selected, "original eligible trouser remains recommendable");
  assert.equal(selected.realModel?.shirtId, shirt.id,
    "the earlier trouser-only duplicate must not hide the eligible supporting shirt");
  assert.equal(JSON.stringify(catalogue), before);
});

test("repeated Style Director decisions are deterministic across garment roles and preserve caller data", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"), import("@/lib/style-director-agent"),
  ]);
  const shirt = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("shirt"));
  const pant = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("trouser") && f.id !== shirt?.id);
  assert.ok(shirt && pant);
  const catalogue = [shirt, pant, { ...shirt }, { ...pant }];
  const before = JSON.stringify(catalogue);
  const shared = {
    occasion: "Work" as const, mood: "Sharp" as const, time: "Day" as const,
    climate: "Indoor" as const, colorDirection: "Surprise me" as const,
  };
  for (const garment of ["shirt", "trouser"] as const) {
    const answers = { ...shared, garment };
    const first = createStyleDirectorLooks(answers, catalogue);
    const second = createStyleDirectorLooks(answers, catalogue);
    assert.deepEqual(second, first, "identical catalogue and answers must yield identical recommendations");
    assert.equal(first.length, 1, "duplicate physical IDs must not multiply looks");
    assert.equal(first[0].realModel?.shirtId, shirt.id);
    assert.equal(first[0].realModel?.pantId, pant.id);
    assert.equal(first[0].realModel?.styleSpec.styleSchemaVersion, 2);
  }
  assert.equal(JSON.stringify(catalogue), before, "repeated decisions must never mutate catalogue inputs");
});


test("supporting garment selection remains stable when unavailable duplicates precede eligible rows in both roles", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"), import("@/lib/style-director-agent"),
  ]);
  const shirt = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("shirt"));
  const pant = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("trouser") && f.id !== shirt?.id);
  assert.ok(shirt && pant);
  const catalogue = [
    { ...shirt, inStock: false },
    { ...pant, inStock: false },
    shirt,
    pant,
    { ...shirt, inStock: false },
    { ...pant, inStock: false },
  ];
  const before = JSON.stringify(catalogue);
  const shared = {
    occasion: "Work" as const, mood: "Sharp" as const, time: "Day" as const,
    climate: "Indoor" as const, colorDirection: "Surprise me" as const,
  };
  for (const garment of ["shirt", "trouser"] as const) {
    const looks = createStyleDirectorLooks({ ...shared, garment }, catalogue);
    assert.equal(looks.length, 1, "only one eligible fabric ID per garment role");
    assert.equal(looks[0].realModel?.shirtId, shirt.id,
      "unavailable shirt duplicates must not shadow eligible shirt");
    assert.equal(looks[0].realModel?.pantId, pant.id,
      "unavailable trouser duplicates must not shadow eligible trouser");
    assert.equal(looks[0].realModel?.styleSpec.styleSchemaVersion, 2);
  }
  assert.equal(JSON.stringify(catalogue), before, "input stock must remain unchanged");
});
