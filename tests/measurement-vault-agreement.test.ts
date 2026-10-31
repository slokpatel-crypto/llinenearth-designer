import test from "node:test";
import assert from "node:assert/strict";
import { sameMeasurementVaultPayload } from "../src/lib/measurement-vault-agreement.ts";
import type { MeasurementProfile } from "../src/lib/measurements.ts";
import type { TailorObservationProfile } from "../src/lib/designer/tailor-observations.ts";

const profile:MeasurementProfile={
  version:1,unit:"cm",
  shirt:{neck:39,chest:101,waist:91,sleeve:64},
  pants:{waist:86,seat:102,inseam:79},
  updatedAt:"2026-10-31T12:00:00.000Z",
};
const observations:TailorObservationProfile={
  version:1,shoulderBalance:"sloping",posture:"balanced",
  seatBalance:"full",mobilityPriority:"high",
  updatedAt:"2026-10-31T12:00:01.000Z",
};

test("measurement vault agreement ignores harmless jsonb key order",()=>{
  const recoveredProfile:MeasurementProfile={
    updatedAt:profile.updatedAt,
    pants:{inseam:79,seat:102,waist:86},
    shirt:{sleeve:64,waist:91,chest:101,neck:39},
    unit:"cm",version:1,
  };
  const recoveredObservations:TailorObservationProfile={
    updatedAt:observations.updatedAt,mobilityPriority:"high",
    seatBalance:"full",posture:"balanced",shoulderBalance:"sloping",version:1,
  };
  assert.notEqual(JSON.stringify(profile),JSON.stringify(recoveredProfile));
  assert.notEqual(JSON.stringify(observations),JSON.stringify(recoveredObservations));
  assert.equal(sameMeasurementVaultPayload(
    profile,observations,recoveredProfile,recoveredObservations,
  ),true);
});

test("measurement vault agreement rejects changed or additional evidence",()=>{
  assert.equal(sameMeasurementVaultPayload(
    profile,observations,{...profile,shirt:{...profile.shirt,chest:102}},observations,
  ),false);
  assert.equal(sameMeasurementVaultPayload(
    profile,observations,profile,{...observations,posture:"forward"},
  ),false);
  assert.equal(sameMeasurementVaultPayload(
    profile,observations,{...profile,pants:{...profile.pants,knee:42}},observations,
  ),false);
  assert.equal(sameMeasurementVaultPayload(
    profile,observations,{...profile,updatedAt:"2026-10-31T12:00:02.000Z"},observations,
  ),false);
});
