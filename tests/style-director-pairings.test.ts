import test from "node:test";
import assert from "node:assert/strict";
import { FABRIC_STOCK } from "../src/lib/fabric-stock.ts";
import { createStyleDirectorPairingAlternatives } from "../src/lib/designer/style-director-pairings.ts";
import { designerFabricFromStock, designerStyleForOccasion } from "../src/lib/designer/engine.ts";
import { fromLegacyStyle } from "../src/lib/designer/style-spec-v2.ts";
import type { StyleDirectorLook } from "../src/lib/style-director-agent.ts";

const shirt = FABRIC_STOCK.find((value)=>value.id === "linen-plain-60-sky-blue")!;
const pant = FABRIC_STOCK.find((value)=>value.id === "linen-suiting-beige")!;
assert.ok(shirt && pant);

function look(hero: "shirt" | "trouser" = "shirt"): StyleDirectorLook {
  const style = designerStyleForOccasion("Semi-Formal");
  return {
    id: "synthetic-look", fabric: hero === "shirt" ? shirt : pant,
    realModel: {
      shirtId: shirt.id, shirtName: shirt.colorName, shirtFabric: designerFabricFromStock(shirt),
      pantId: pant.id, pantName: pant.colorName, pantFabric: designerFabricFromStock(pant),
      occasion: "Semi-Formal", climate: "Air-conditioned", intention: "Understated",
      style, styleSpec: fromLegacyStyle(style), reason: "Synthetic baseline",
      status: "preliminary", confidenceScore: 0, designFitScore: 0,
    },
  } as unknown as StyleDirectorLook;
}

test("shirt-led alternatives preserve hero, canonical v2 spec and source", () => {
  const source = look();
  const copy = structuredClone(source);
  const result = createStyleDirectorPairingAlternatives(source, FABRIC_STOCK);
  assert.ok(result.length > 0 && result.length <= 3);
  assert.equal(new Set(result.map((row)=>row.pantId)).size, result.length);
  for (const item of result) {
    assert.equal(item.shirtId, shirt.id);
    assert.notEqual(item.pantId, pant.id);
    assert.equal(item.supportingRole, "pant");
    assert.deepEqual(item.realModel.styleSpec, source.realModel!.styleSpec);
    assert.deepEqual(item.realModel.style, source.realModel!.style);
    assert.equal(item.id, `synthetic-look:trouser:${item.pantId}`);
    assert.match(item.reviewNote, /physical fabric|actual stock/i);
  }
  assert.deepEqual(createStyleDirectorPairingAlternatives(source,FABRIC_STOCK),result);
  assert.deepEqual(source, copy);
});

test("trouser-led alternatives preserve trouser hero, using only shirting fabrics", () => {
  const source = look("trouser");
  const result = createStyleDirectorPairingAlternatives(source,FABRIC_STOCK);
  assert.ok(result.length > 0 && result.length <= 3);
  for (const item of result) {
    assert.equal(item.pantId, pant.id);
    assert.notEqual(item.shirtId, shirt.id);
    assert.equal(item.supportingRole, "shirt");
    assert.equal(item.id, `synthetic-look:shirt:${item.shirtId}`);
    assert.ok(FABRIC_STOCK.some((fabric)=>fabric.id === item.shirtId && fabric.suitableFor.includes("shirt")));
  }
});

test("ineligible, duplicate, missing and sold-out heroes are never replaced implicitly", () => {
  const source = look();
  assert.deepEqual(createStyleDirectorPairingAlternatives(source, []),[]);
  assert.deepEqual(createStyleDirectorPairingAlternatives(source, [shirt,shirt,pant]),[]);
  assert.deepEqual(createStyleDirectorPairingAlternatives(source, [{...shirt,inStock:false},pant]),[]);
  assert.deepEqual(createStyleDirectorPairingAlternatives(source, [{...shirt,suitableFor:["trouser"]},pant]),[]);
  const hostile = {...source, fabric: {...shirt, id:"fabric-from-an-unverified-upload"}};
  assert.deepEqual(createStyleDirectorPairingAlternatives(hostile, FABRIC_STOCK),[]);
  assert.deepEqual(createStyleDirectorPairingAlternatives({...source,realModel:undefined}, FABRIC_STOCK),[]);
});

test("duplicate and unsupported supporting fabrics never become recommendations", () => {
  const source = look();
  const alt = FABRIC_STOCK.find((fabric)=>fabric.id!==(pant.id) && fabric.suitableFor.includes("trouser"))!;
  const stock = [shirt,pant,alt,{...alt}, {...alt,id:"wrong-role",suitableFor:["shirt"]}];
  assert.deepEqual(createStyleDirectorPairingAlternatives(source,stock),[]);
});

test("a single eligible supporting garment is offered without false availability evidence", () => {
  const source = look();
  const alternate = FABRIC_STOCK.find((f)=>f.id!==pant.id && f.suitableFor.includes("trouser"))!;
  const actual = createStyleDirectorPairingAlternatives(source,[shirt,pant,alternate]);
  assert.ok(actual.length <= 1);
  for(const candidate of actual){
    assert.equal(candidate.supportingFabricName, alternate.colorName);
    assert.match(candidate.reviewNote, /preliminary|review/i);
    assert.equal(candidate.realModel.pantFabric.confirmedAvailableMetres, null);
  }
});
