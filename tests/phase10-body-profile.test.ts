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

test("body profile validation keeps only supported non-biometric display controls",()=>{
  assert.equal(validBodyPreviewProfile(DEFAULT_BODY_PREVIEW_PROFILE),true);
  assert.equal(validBodyPreviewProfile({...DEFAULT_BODY_PREVIEW_PROFILE,heightCm:240}),false);
  assert.equal(validBodyPreviewProfile({...DEFAULT_BODY_PREVIEW_PROFILE,skinTone:"unknown"}),false);
});

test("saved garment measurements can suggest a preview build without changing height or skin tone",()=>{
  const athletic=bodyProfileFromMeasurements({
    version:1,unit:"cm",
    shirt:{chest:108,waist:84},pants:{seat:102},updatedAt:new Date(0).toISOString(),
  });
  assert.equal(athletic.build,"athletic");
  assert.equal(athletic.heightCm,178);
  assert.equal(athletic.skinTone,"medium");
  assert.equal(athletic.source,"measurements");

  const broad=bodyProfileFromMeasurements({
    version:1,unit:"cm",
    shirt:{chest:116,waist:108},pants:{seat:116},updatedAt:new Date(0).toISOString(),
  });
  assert.equal(broad.build,"broad");
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
