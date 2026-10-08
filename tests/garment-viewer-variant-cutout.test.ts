import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const builder=readFileSync(new URL("../scripts/build-garment-viewer-model.mjs",import.meta.url),"utf8");

test("production 3D garment, skin-arm and button variants use cutout rather than blended invisible surfaces",()=>{
  const masked=[...builder.matchAll(/alphaMode:"MASK",alphaCutoff:0\.5/g)];
  assert.equal(masked.length,4,"all four dynamic material families must share identical binary visibility");
  assert.equal([...builder.matchAll(/alphaMode:"BLEND"/g)].length,0,
    "fully invisible variants must not incur translucent GPU overdraw");
  assert.ok(builder.includes("baseColorFactor:[1,1,1,0]"),
    "unselected tailoring variants still start invisible");
  assert.ok(builder.includes("baseColorFactor:[1,1,1,1]"),
    "selected garments remain fully opaque");
});

test("binary alpha cutout never changes verified model identity, six panels or style material names",()=>{
  for(const token of [
    "ShirtTorsoFabric","ShirtSleeveLFabric","ShirtSleeveRFabric",
    "TrouserWaistFabric","TrouserLegLFabric","TrouserLegRFabric",
    "addVariantMaterial(", "addButtonVariantMaterial(",
    "MannequinSkinArmVariant__", "ButtonAccentVariant__",
  ]) assert.ok(builder.includes(token),token);
});
