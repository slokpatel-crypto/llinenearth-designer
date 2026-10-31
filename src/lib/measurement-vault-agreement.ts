import type { MeasurementProfile } from "./measurements.ts";
import type { TailorObservationProfile } from "./designer/tailor-observations.ts";

function sameMeasurements(
  expected:Record<string,number>,
  recovered:Record<string,number>,
):boolean{
  const expectedKeys=Object.keys(expected).sort();
  const recoveredKeys=Object.keys(recovered).sort();
  return expectedKeys.length===recoveredKeys.length&&
    expectedKeys.every((key,index)=>
      key===recoveredKeys[index]&&expected[key]===recovered[key]);
}

/**
 * Compare validated measurement-vault payloads by typed values rather than
 * JSON insertion order. Postgres jsonb does not preserve browser key order,
 * but changed, missing or additional evidence must still fail closed.
 */
export function sameMeasurementVaultPayload(
  expectedProfile:MeasurementProfile,
  expectedObservations:TailorObservationProfile,
  recoveredProfile:MeasurementProfile,
  recoveredObservations:TailorObservationProfile,
):boolean{
  return expectedProfile.version===recoveredProfile.version&&
    expectedProfile.unit===recoveredProfile.unit&&
    expectedProfile.updatedAt===recoveredProfile.updatedAt&&
    sameMeasurements(expectedProfile.shirt,recoveredProfile.shirt)&&
    sameMeasurements(expectedProfile.pants,recoveredProfile.pants)&&
    expectedObservations.version===recoveredObservations.version&&
    expectedObservations.shoulderBalance===recoveredObservations.shoulderBalance&&
    expectedObservations.posture===recoveredObservations.posture&&
    expectedObservations.seatBalance===recoveredObservations.seatBalance&&
    expectedObservations.mobilityPriority===recoveredObservations.mobilityPriority&&
    expectedObservations.updatedAt===recoveredObservations.updatedAt;
}
