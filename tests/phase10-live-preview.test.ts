import test from "node:test";
import assert from "node:assert/strict";
import manifest from "../public/fabric-tiles/manifest.json" with { type:"json" };
import { FABRIC_STOCK } from "../src/lib/fabric-stock.ts";
import { fromLegacyStyle } from "../src/lib/designer/style-spec-v2.ts";
import { fabricTileSizePx, LIVE_APPROXIMATE_TILE_PX, LIVE_MODEL_PX_PER_MM, liveCapabilities, modelGeometry } from "../src/lib/designer/live-preview.ts";
import { GARMENT_OPTION_LIBRARY } from "../src/lib/designer/options/library.ts";

const legacy={
  collar:"Point (Standard) Collar",collarFinish:"Self-fabric",cuff:"Barrel Cuff (1-button)",
  placket:"Standard (visible stitch)",shirtFit:"Regular / Classic Fit",shirtWear:"Tucked",
  trouser:"Pleated Trouser",rise:"Mid Rise",waistband:"Belt Loops",break:"Slight Break",button:"Plastic / Resin",
};

test("all stock fabrics have a lightweight tile and scale is explicitly unverified",()=>{
  for(const fabric of FABRIC_STOCK) {
    const stem=fabric.swatchImageUrl.split("/").pop()?.replace(".webp","");
    assert(stem && Object.hasOwn(manifest.assets,stem),`missing tile for ${fabric.id}`);
    const asset=manifest.assets[stem as keyof typeof manifest.assets];
    assert.equal(asset.tileWidthPx,256);
    assert.equal(asset.scaleApproximate,true);
    assert.equal(asset.tileRealWidthMm,null);
    const patterned=/stripe|check|print|floral|botanical|leaf|geometric|chevron|mosaic|abstract/i.test(fabric.pattern);
    assert.equal(asset.tileStrategy,patterned?"direction_preserving_repeat":"mirrored_plain");
  }
});

test("tucked front has separate legs, sleeves, a shirt and a visible waistband",()=>{
  const geometry=modelGeometry(fromLegacyStyle(legacy));
  assert.deepEqual(geometry.parts.map((part)=>part.id),[
    "seat-and-fly","left-leg","right-leg","left-sleeve","right-sleeve","body","waistband",
  ]);
  assert(geometry.waistY<geometry.shirtHemY);
  assert.equal(geometry.collarPaths.length,2);
  assert.equal(geometry.cuffPaths.length,2);
});

test("a short-sleeve, Korean-wide, high-rise study changes geometry and back view",()=>{
  const base=fromLegacyStyle(legacy);
  const normal=modelGeometry(base);
  const expanded={
    ...base,
    shirt:{...base.shirt,sleeve:"half_sleeve",fit:"boxy_oversized",back:"box_pleat_back",wear:"untucked"},
    pant:{...base.pant,fit:"korean_straight_wide",rise:"extra_high_rise"},
  };
  const front=modelGeometry(expanded);
  const back=modelGeometry(expanded,"back","broad");
  assert(front.waistY<normal.waistY);
  assert.notEqual(front.parts.find((part)=>part.id==="left-leg")?.path,normal.parts.find((part)=>part.id==="left-leg")?.path);
  assert.notEqual(front.parts.find((part)=>part.id==="body")?.path,normal.parts.find((part)=>part.id==="body")?.path);
  assert.equal(front.cuffPaths.length,0);
  assert(back.seams.some((path)=>path.includes("312 257")));
  assert.deepEqual(modelGeometry(expanded,"back","broad"),back);
});

test("front, three-quarter, side and back views use deterministic projection profiles",()=>{
  const spec=fromLegacyStyle(legacy);
  const front=modelGeometry(spec,"front");
  const threeQuarter=modelGeometry(spec,"three-quarter");
  const side=modelGeometry(spec,"side");
  const back=modelGeometry(spec,"back");
  assert.equal(front.viewScaleX,1);
  assert.equal(back.viewScaleX,1);
  assert(threeQuarter.viewScaleX<front.viewScaleX);
  assert(side.viewScaleX<threeQuarter.viewScaleX);
  assert(threeQuarter.viewShiftX>0);
  assert(side.viewShiftX>threeQuarter.viewShiftX);
  assert.notDeepEqual(side.seams,front.seams);
  assert.deepEqual(modelGeometry(spec,"three-quarter"),threeQuarter);
  assert.deepEqual(modelGeometry(spec,"side"),side);
});

test("option accuracy never claims physical exactness; button material is not shown",()=>{
  const capabilities=liveCapabilities(fromLegacyStyle(legacy));
  assert.equal(capabilities.point_standard_collar,"approximate");
  assert.equal(capabilities.mid_rise,"approximate");
  assert.equal(capabilities.plastic_resin,"none");
  assert.equal(Object.keys(capabilities).length,GARMENT_OPTION_LIBRARY.length);
  assert(!Object.values(capabilities).includes("exact"));
});


test("owner-declared millimetres map to a calibrated model-space tile size",()=>{
  const declared={
    tileUrl:"/fabric-tiles/test.webp",
    placeholderUrl:"/fabric-tiles/test-placeholder.webp",
    tileWidthPx:256,
    tileHeightPx:256,
    repeatDetected:true,
    repeatPeriodPx:32,
    orientation:"vertical" as const,
    dominantHex:"#112233",
    scaleApproximate:false,
    tileRealWidthMm:120,
    renderAssetVersion:"fabric-tile-v2",
  };
  assert.equal(fabricTileSizePx(null),LIVE_APPROXIMATE_TILE_PX);
  assert.equal(fabricTileSizePx(declared),120*LIVE_MODEL_PX_PER_MM);
  assert(fabricTileSizePx(declared)<LIVE_APPROXIMATE_TILE_PX);
});
