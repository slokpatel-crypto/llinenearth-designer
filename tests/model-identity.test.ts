import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LINEN_EARTH_FRONT_SILHOUETTE_ANCHORS,
  LINEN_EARTH_MODEL_IDENTITY_ID,
  LINEN_EARTH_MODEL_PHYSICAL_TARGETS_MM,
  LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM,
  LINEN_EARTH_MODEL_REFERENCE_IMAGE,
  LINEN_EARTH_MODEL_VIEWS,
  linenEarthModelIdentityPrompt,
  linenEarthViewPrompt,
} from "../src/lib/designer/model-identity.ts";

test("Real Model Designer identity is one locked four-view model",()=>{
  assert.equal(LINEN_EARTH_MODEL_IDENTITY_ID,"linen-earth-studio-model-v1");
  assert.equal(LINEN_EARTH_MODEL_REFERENCE_IMAGE,"/designer/studio-tucked.webp");
  assert.equal(LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM,1727);
  assert.deepEqual(LINEN_EARTH_MODEL_VIEWS.map((view)=>view.id),["front","three-quarter","side","back"]);
  assert.deepEqual(LINEN_EARTH_MODEL_VIEWS.map((view)=>view.yawDeg),[0,35,90,180]);
  assert.match(linenEarthModelIdentityPrompt(),/one fixed faceless mannequin/);
  assert.match(linenEarthViewPrompt("side"),/yaw 90 degrees/);
  assert.match(linenEarthViewPrompt("back"),/do not morph the body between views/);
});



test("public identity spec and runtime physical targets cannot drift",()=>{
  const identity=JSON.parse(readFileSync("public/model-identity/linen-earth-studio-model-v1.json","utf8"));
  assert.deepEqual(identity.physicalTargetsMm,LINEN_EARTH_MODEL_PHYSICAL_TARGETS_MM);
  assert.equal(identity.referenceHeightMm,LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM);
  assert.equal(identity.referenceImage,LINEN_EARTH_MODEL_REFERENCE_IMAGE);
});

test("front silhouette anchors remain tied to the existing studio-tucked trace",()=>{
  assert.deepEqual(LINEN_EARTH_FRONT_SILHOUETTE_ANCHORS.shirtShoulder,{yPx:244,leftPx:351,rightPx:669});
  assert.deepEqual(LINEN_EARTH_FRONT_SILHOUETTE_ANCHORS.shirtWaist,{yPx:545,leftPx:387,rightPx:628});
  assert.deepEqual(LINEN_EARTH_FRONT_SILHOUETTE_ANCHORS.trouserWaist,{yPx:542,leftPx:368,rightPx:650});
});
