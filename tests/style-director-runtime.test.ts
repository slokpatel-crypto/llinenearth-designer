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
  assert.deepEqual(looks, createStyleDirectorLooks(answers, stock),
    "recommendations must be deterministic for identical catalogue inputs");
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
