import {MEASUREMENT_STORAGE_KEY} from "./measurements.ts";
import {TAILOR_OBSERVATION_STORAGE_KEY} from "./designer/tailor-observations.ts";

export type MeasurementPairStore={
  getItem(key:string):string|null;
  setItem(key:string,value:string):void;
  removeItem(key:string):void;
};
export type MeasurementPairWriteResult={saved:boolean;rollbackComplete:boolean};

/**
 * localStorage has no multi-key transaction. Never mark a profile as activated
 * after only one of measurements/observations was written.
 * On failed writes restore prior values if unchanged by another tab. This is
 * best-effort recovery, not cross-tab transaction isolation.
 */
export function persistMeasurementPair(
  storage:MeasurementPairStore,
  serializedProfile:string,
  serializedObservations:string,
):MeasurementPairWriteResult{
  const keys=[MEASUREMENT_STORAGE_KEY,TAILOR_OBSERVATION_STORAGE_KEY] as const;
  const next=[serializedProfile,serializedObservations] as const;
  let previous:[string|null,string|null];
  try{
    previous=[storage.getItem(keys[0]),storage.getItem(keys[1])];
  }catch{
    // No writes occurred; avoid touching unknown prior browser state.
    return {saved:false,rollbackComplete:true};
  }
  try{
    storage.setItem(keys[0],next[0]);
    storage.setItem(keys[1],next[1]);
    return {saved:true,rollbackComplete:true};
  }catch{
    // Only restore our own changes. Concurrent edits must never be overwritten.
    let rollbackComplete=true;
    for(let i=0;i<keys.length;i++){
      try{
        const current=storage.getItem(keys[i]);
        if(current===previous[i]) continue;
        if(current!==next[i]) {rollbackComplete=false;continue;}
        if(previous[i]===null) storage.removeItem(keys[i]);
        else storage.setItem(keys[i],previous[i]!);
        if(storage.getItem(keys[i])!==previous[i]) rollbackComplete=false;
      }catch{
        rollbackComplete=false;
      }
    }
    return {saved:false,rollbackComplete};
  }
}
