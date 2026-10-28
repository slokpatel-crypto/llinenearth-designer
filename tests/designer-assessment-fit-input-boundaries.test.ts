import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_BODY_PREVIEW_PROFILE, validBodyPreviewProfile } from "../src/lib/designer/body-profile.ts";
import { emptyTailorObservationProfile, validStoredTailorObservationProfile } from "../src/lib/designer/tailor-observations.ts";

test("valid preview body and tailor observations remain accepted",()=>{
  assert.equal(validBodyPreviewProfile(DEFAULT_BODY_PREVIEW_PROFILE),true);
  assert.equal(validBodyPreviewProfile({...DEFAULT_BODY_PREVIEW_PROFILE,build:"athletic"}),true);
  assert.ok(validStoredTailorObservationProfile(emptyTailorObservationProfile()));
});

test("coercible body enums and malformed roots cannot alter model proportions",()=>{
  for(const value of [null,[],true,"regular",{
    ...DEFAULT_BODY_PREVIEW_PROFILE,build:["regular"],
  },{
    ...DEFAULT_BODY_PREVIEW_PROFILE,skinTone:["medium"],
  },{
    ...DEFAULT_BODY_PREVIEW_PROFILE,source:["default"],
  },{
    ...DEFAULT_BODY_PREVIEW_PROFILE,heightCm:"178",
  },{
    ...DEFAULT_BODY_PREVIEW_PROFILE,heightCm:Infinity,
  }])assert.equal(validBodyPreviewProfile(value),false);
});

test("invalid explicit tailor observations are never considered valid notes",()=>{
  const valid=emptyTailorObservationProfile();
  assert.equal(validStoredTailorObservationProfile({...valid,posture:["balanced"]}),null);
  assert.equal(validStoredTailorObservationProfile({...valid,updatedAt:"2027-02-29T12:00:00Z"}),null);
  assert.equal(validStoredTailorObservationProfile({...valid,seatBalance:"invented"}),null);
});

test("assessment route fails closed before fit and garment-spec assembly",()=>{
  const source=readFileSync("src/app/api/designer/assess/route.ts","utf8");
  const body=source.indexOf("Invalid body preview profile");
  const observations=source.indexOf("Invalid tailor observations");
  const build=source.indexOf("const garmentSpec=buildCanonicalGarmentSpec");
  assert.ok(body>0&&observations>body&&build>observations);
  assert.match(source,/body\.bodyProfile!==undefined && body\.bodyProfile!==null && !bodyProfile/);
  assert.match(source,/body\.observations!==undefined && body\.observations!==null && !observations/);
});
