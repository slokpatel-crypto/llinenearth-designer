import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validStoredMeasurementProfile} from "../src/lib/measurements.ts";
import {validStoredTailorObservationProfile} from "../src/lib/designer/tailor-observations.ts";

const updatedAt="2026-10-25T09:00:00.000Z";
const measurements={
  version:1,
  unit:"in",
  shirt:{chest:101.6,shoulder:45.7},
  pants:{waist:83.8,inseam:78.7},
  updatedAt,
};
const observations={
  version:1,
  shoulderBalance:"sloping",
  posture:"forward",
  seatBalance:"full",
  mobilityPriority:"high",
  updatedAt,
};

test("valid stored measurement and manual observation profiles remain unchanged",()=>{
  assert.deepEqual(validStoredMeasurementProfile(measurements),measurements);
  assert.deepEqual(validStoredTailorObservationProfile(observations),observations);
});

test("stored measurements reject coercion, unknown keys and corrupt numeric evidence",()=>{
  const invalid=[
    {...measurements,version:2},
    {...measurements,unit:"yards"},
    {...measurements,updatedAt:"not-a-date"},
    {...measurements,shirt:{chest:"101.6"}},
    {...measurements,shirt:{chest:0}},
    {...measurements,shirt:{chest:351}},
    {...measurements,shirt:{chest:Number.POSITIVE_INFINITY}},
    {...measurements,shirt:{chest:101.6,secretEase:4}},
    {...measurements,pants:null},
  ];
  for(const profile of invalid) assert.equal(validStoredMeasurementProfile(profile),null);
});

test("stored tailor observations reject unknown categories and invented timestamps",()=>{
  for(const profile of [
    {...observations,version:2},
    {...observations,shoulderBalance:"dramatic"},
    {...observations,posture:"guessed"},
    {...observations,seatBalance:"round"},
    {...observations,mobilityPriority:"maximum"},
    {...observations,updatedAt:""},
    {...observations,updatedAt:undefined},
  ]) assert.equal(validStoredTailorObservationProfile(profile),null);
});

test("all browser and vault restore boundaries use the shared validators",()=>{
  const vault=readFileSync("src/app/api/measurements/vault/route.ts","utf8");
  const studio=readFileSync("src/components/MeasurementStudio.tsx","utf8");
  const designer=readFileSync("src/components/DesignerModule.tsx","utf8");
  for(const source of [vault,studio,designer]) {
    assert.match(source,/validStoredMeasurementProfile/);
    assert.match(source,/validStoredTailorObservationProfile/);
  }
  for(const route of ["assess","brief","search"]) {
    const source=readFileSync(`src/app/api/designer/${route}/route.ts`,"utf8");
    assert.match(source,/return validStoredTailorObservationProfile\(value\)/);
  }
});
