import type { MeasurementProfile } from "../measurements.ts";

const SHIRT_KEYS=new Set(["neck","chest","waist","shoulder","sleeve","shirtLength","bicep","wrist"]);
const PANT_KEYS=new Set(["waist","seat","thigh","frontRise","inseam","outseam","knee","hem"]);

/**
 * The legacy API discarded impossible explicit measurements, treating
 * -5cm or "NaN" as a missing measurement and returning an assessment. For
 * production handoff, an explicitly supplied invalid tape reading must
 * be corrected, never silently laundered into an apparently valid recipe.
 *
 * All stored quantities remain cm; unit controls presentation only.
 */
export function normalizeMeasuredBodyInput(value:unknown):MeasurementProfile|null {
  if(value===undefined||value===null) return null;
  if(!value||typeof value!=="object"||Array.isArray(value))
    throw new Error("Invalid body measurement profile.");
  const input=value as Record<string,unknown>;
  if(input.version!==1||!["cm","in"].includes(String(input.unit)))
    throw new Error("Unsupported body measurement version or display unit.");
  const clean=(part:unknown,keys:Set<string>,name:string)=>{
    if(!part||typeof part!=="object"||Array.isArray(part))
      throw new Error(`Invalid ${name} measurements.`);
    const measurements:Record<string,number>={};
    for(const [key,raw] of Object.entries(part)){
      if(!keys.has(key))
        throw new Error(`Unsupported ${name} measurement ${key.slice(0,50)}.`);
      if(raw===undefined||raw===null||raw==="") continue;
      const n=typeof raw==="number"?raw:typeof raw==="string"&&raw.trim()!==""?Number(raw):NaN;
      if(!Number.isFinite(n)||n<=0||n>350)
        throw new Error(`Invalid ${name} ${key} measurement in centimetres.`);
      measurements[key]=n;
    }
    return measurements;
  };
  const shirt=clean(input.shirt,SHIRT_KEYS,"shirt");
  const pants=clean(input.pants,PANT_KEYS,"trouser");
  return {
    version:1,
    unit:input.unit as "cm"|"in",
    shirt,
    pants,
    updatedAt:typeof input.updatedAt==="string"?input.updatedAt.slice(0,80):new Date().toISOString(),
  };
}
