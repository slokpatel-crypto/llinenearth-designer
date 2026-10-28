import type { MeasurementProfile } from "./measurements.ts";
import type { TailorObservationProfile } from "./designer/tailor-observations.ts";

const SHIRT_FIELDS=new Set(["neck","chest","waist","shoulder","sleeve","shirtLength","bicep","wrist"]);
const PANTS_FIELDS=new Set(["waist","seat","thigh","frontRise","inseam","outseam","knee","hem"]);
const VAULT_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function object(value:unknown):value is Record<string,unknown>{
  return value!==null&&typeof value==="object"&&!Array.isArray(value);
}
function validTimestamp(value:unknown){
  if(typeof value!=="string"||value.length!==24||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) return false;
  const parsed=Date.parse(value);
  return Number.isFinite(parsed)&&new Date(parsed).toISOString()===value;
}
function numericFields(value:unknown,allowed:Set<string>){
  if(!object(value)) return false;
  return Object.entries(value).every(([key,n])=>allowed.has(key)&&typeof n==="number"&&Number.isFinite(n)&&n>0&&n<500);
}
export function validMeasurementVaultProfile(value:unknown):value is MeasurementProfile{
  if(!object(value)||value.version!==1||(value.unit!=="cm"&&value.unit!=="in")||!validTimestamp(value.updatedAt)) return false;
  if(Object.keys(value).some(key=>!["version","unit","shirt","pants","updatedAt"].includes(key))) return false;
  return numericFields(value.shirt,SHIRT_FIELDS)&&numericFields(value.pants,PANTS_FIELDS);
}
export function validMeasurementVaultObservations(value:unknown):value is TailorObservationProfile{
  if(!object(value)||value.version!==1||!validTimestamp(value.updatedAt)) return false;
  if(Object.keys(value).some(key=>!["version","shoulderBalance","posture","seatBalance","mobilityPriority","updatedAt"].includes(key))) return false;
  return ["unknown","level","square","sloping"].includes(value.shoulderBalance as string)
    &&["unknown","balanced","erect","forward"].includes(value.posture as string)
    &&["unknown","balanced","flat","full"].includes(value.seatBalance as string)
    &&["standard","high"].includes(value.mobilityPriority as string);
}
export function validMeasurementVaultId(value:unknown):value is string{
  return typeof value==="string"&&VAULT_ID.test(value);
}
