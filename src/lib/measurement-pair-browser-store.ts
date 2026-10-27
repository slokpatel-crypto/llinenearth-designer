import {MEASUREMENT_STORAGE_KEY} from "./measurements.ts";
import {TAILOR_OBSERVATION_STORAGE_KEY} from "./designer/tailor-observations.ts";

import {writeBrowserRecords, type BrowserRecordStore, type BrowserWriteResult} from "./browser-storage-write.ts";

export type MeasurementPairStore=BrowserRecordStore;
export type MeasurementPairWriteResult=BrowserWriteResult;

/**
 * localStorage has no multi-key transaction. Never mark a profile as activated
 * after only one of measurements/observations was written.
 * On failed writes restore prior values if unchanged by another tab. This is
 * best-effort recovery, not cross-tab transaction isolation.
 */
export function persistMeasurementPair(
  storage:MeasurementPairStore|(()=>MeasurementPairStore),
  serializedProfile:string,
  serializedObservations:string,
):MeasurementPairWriteResult{
  let resolved:MeasurementPairStore;
  try{resolved=typeof storage==="function"?storage():storage;}
  catch{return {saved:false,rollbackComplete:true};}
  return writeBrowserRecords(resolved,[
    [MEASUREMENT_STORAGE_KEY,serializedProfile],
    [TAILOR_OBSERVATION_STORAGE_KEY,serializedObservations],
  ]);
}
