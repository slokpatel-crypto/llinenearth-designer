import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BODY_PREVIEW_PROFILE,
  bodyProfileFromMeasurements,
  validBodyPreviewProfile,
} from "../src/lib/designer/body-profile.ts";
import { fromLegacyStyle } from "../src/lib/designer/style-spec-v2.ts";
import { modelGeometry } from "../src/lib/designer/live-preview.ts";

const legacy={
  collar:"Point (Standard) Collar",collarFinish:"Self-fabric",cuff:"Barrel Cuff (1-button)",
  placket:"Standard (visible stitch)",shirtFit:"Regular / Classic Fit",shirtWear:"Tucked",
  trouser:"Pleated Trouser",rise:"Mid Rise",waistband:"Belt Loops",break:"Slight Break",button:"Plastic / Resin",
};

test("body profile validation keeps supported preview controls and bounded derived proportions",()=>{
  assert.equal(validBodyPreviewProfile(DEFAULT_BODY_PREVIEW_PROFILE),true);
  assert.equal(validBodyPreviewProfile({...DEFAULT_BODY_PREVIEW_PROFILE,heightCm:240}),false);
  assert.equal(validBodyPreviewProfile({...DEFAULT_BODY_PREVIEW_PROFILE,skinTone:"unknown"}),false);
  assert.equal(validBodyPreviewProfile({
    ...DEFAULT_BODY_PREVIEW_PROFILE,
    source:"measurements",
    silhouette:{shoulderScale:1,chestScale:1,waistScale:1,seatScale:1,thighScale:1,legLengthScale:1,evidenceCount:6},
  }),true);
  assert.equal(validBodyPreviewProfile({
    ...DEFAULT_BODY_PREVIEW_PROFILE,
    silhouette:{shoulderScale:2,chestScale:1,waistScale:1,seatScale:1,thighScale:1,legLengthScale:1,evidenceCount:6},
  }),false);
});

test("saved measurements create privacy-safe preview proportions without raw tape values",()=>{
  const athletic=bodyProfileFromMeasurements({
    version:1,unit:"cm",
    shirt:{chest:108,waist:84,shoulder:49},
    pants:{seat:102,thigh:62,inseam:84},
    updatedAt:new Date(0).toISOString(),
  });
  assert.equal(athletic.build,"athletic");
  assert.equal(athletic.heightCm,178);
  assert.equal(athletic.skinTone,"medium");
  assert.equal(athletic.source,"measurements");
  assert.equal(athletic.silhouette?.evidenceCount,6);
  assert((athletic.silhouette?.shoulderScale||0)>1);
  assert((athletic.silhouette?.legLengthScale||0)>1);
  assert.equal("chest" in athletic,false);
  assert.equal(JSON.stringify(athletic).includes("108"),false);

  const broad=bodyProfileFromMeasurements({
    version:1,unit:"cm",
    shirt:{chest:116,waist:108},pants:{seat:116},updatedAt:new Date(0).toISOString(),
  });
  assert.equal(broad.build,"broad");
  assert((broad.silhouette?.seatScale||0)>1);
});

test("measurement-derived silhouette changes preview geometry deterministically",()=>{
  const spec=fromLegacyStyle(legacy);
  const regular=modelGeometry(spec,"front",DEFAULT_BODY_PREVIEW_PROFILE);
  const measured=bodyProfileFromMeasurements({
    version:1,unit:"cm",
    shirt:{chest:112,waist:92,shoulder:51},
    pants:{seat:108,thigh:66,inseam:86},
    updatedAt:new Date(0).toISOString(),
  });
  const shaped=modelGeometry(spec,"front",measured);
  assert.notDeepEqual(shaped.parts,regular.parts);
  assert.deepEqual(modelGeometry(spec,"front",measured),shaped);
});

test("body height changes preview scale while garment geometry remains deterministic",()=>{
  const spec=fromLegacyStyle(legacy);
  const short=modelGeometry(spec,"front",{...DEFAULT_BODY_PREVIEW_PROFILE,heightCm:165});
  const tall=modelGeometry(spec,"front",{...DEFAULT_BODY_PREVIEW_PROFILE,heightCm:190});
  assert(short.heightScale<tall.heightScale);
  assert.deepEqual(
    modelGeometry(spec,"front",{...DEFAULT_BODY_PREVIEW_PROFILE,heightCm:190}),
    tall,
  );
});
