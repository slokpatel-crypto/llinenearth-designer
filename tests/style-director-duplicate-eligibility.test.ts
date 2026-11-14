import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register(new URL("./helpers/style-director-alias-loader.mjs", import.meta.url), import.meta.url);

test("supporting fabric selection ignores a garment-ineligible duplicate before a valid record", async () => {
  const [{ FABRIC_STOCK }, { createStyleDirectorLooks }] = await Promise.all([
    import("@/lib/fabric-stock"),
    import("@/lib/style-director-agent"),
  ]);
  const shirt = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("shirt"));
  const trouser = FABRIC_STOCK.find(f => f.inStock && f.suitableFor.includes("trouser"));
  assert.ok(shirt && trouser);

  const shirtOnlyDuplicate = { ...trouser, suitableFor: ["shirt"] as typeof trouser.suitableFor };
  const trouserOnlyDuplicate = { ...shirt, suitableFor: ["trouser"] as typeof shirt.suitableFor };
  const catalogue = [shirtOnlyDuplicate, trouserOnlyDuplicate, shirt, trouser];
  const original = JSON.stringify(catalogue);

  const shirtLooks = createStyleDirectorLooks({
    occasion: "Travel", mood: "Relaxed", time: "Day", climate: "Hot",
    garment: "shirt", colorDirection: "Surprise me",
  }, catalogue);
  const trouserLooks = createStyleDirectorLooks({
    occasion: "Work", mood: "Sharp", time: "Day", climate: "Indoor",
    garment: "trouser", colorDirection: "Surprise me",
  }, catalogue);

  assert.ok(shirtLooks.some(look => look.realModel?.pantId === trouser.id),
    "a shirt-only duplicate must not hide the actual trouser-eligible row");
  assert.ok(trouserLooks.some(look => look.realModel?.shirtId === shirt.id),
    "a trouser-only duplicate must not hide the actual shirt-eligible row");
  assert.equal(JSON.stringify(catalogue), original, "recommendations must not mutate source data");
});
