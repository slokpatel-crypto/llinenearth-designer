import type {MeasurementProfile} from "../measurements.ts";

// Shared contradiction threshold: this is a request for human review, not
// a universal anthropometric or supplier-certified fit tolerance.
export const SEAT_WAIST_REVIEW_DELTA_CM=75;

/** Conservative geometric contradictions only; these are not body-shape
 * judgements or claimed tailoring tolerances. All stored measurements are cm
 * irrespective of the UI's cm/in presentation preference.
 */
export type MeasurementConsistencyIssue={
  id:string;
  severity:"warning"|"review";
  explanation:string;
};
export function reviewMeasurementConsistency(profile:MeasurementProfile|null|undefined):MeasurementConsistencyIssue[]{
  if(profile==null) return [];
  // Drafts and operator imports are persisted JSON, not guaranteed to match
  // their compile-time type. A missing nested section must yield a remeasure
  // warning instead of crashing the tailoring handoff or implying no issues.
  if(typeof profile!=="object"||Array.isArray(profile)
    ||!profile.shirt||typeof profile.shirt!=="object"||Array.isArray(profile.shirt)
    ||!profile.pants||typeof profile.pants!=="object"||Array.isArray(profile.pants)){
    return [{id:"MEASURE-INVALID",severity:"warning",
      explanation:"Measurement sections are missing or malformed; review the original profile before cutting."}];
  }
  const issues:MeasurementConsistencyIssue[]=[];
  const validCm=(value:unknown):value is number=>
    typeof value==="number"&&Number.isFinite(value)&&value>0&&value<=350;
  const values=[...Object.entries(profile.shirt),...Object.entries(profile.pants)];
  for(const [name,value] of values){
    if(value!==undefined&&!validCm(value)){
      issues.push({id:"MEASURE-INVALID",severity:"warning",
        explanation:`The recorded ${name} is outside supported centimetre limits; remeasure it before cutting.`});
    }
  }
  const p=profile.pants;
  if(validCm(p.inseam)&&validCm(p.outseam)&&p.outseam<=p.inseam){
    issues.push({id:"MEASURE-SEAM-ORDER",severity:"warning",
      explanation:"Trouser outseam must extend farther than inseam on the same garment; check that both measurements were recorded in centimetres and with the correct landmarks."});
  }
  if(validCm(p.frontRise)&&validCm(p.outseam)&&p.frontRise>=p.outseam){
    issues.push({id:"MEASURE-RISE-ORDER",severity:"warning",
      explanation:"Recorded trouser front rise is as long as or longer than the entire outseam; confirm the measuring landmarks and units."});
  }
  // Disagreements between shapes are *review* notes, not assertions that any
  // specific body shape is invalid.
  if(validCm(profile.shirt.neck)&&validCm(profile.shirt.chest)&&profile.shirt.neck>=profile.shirt.chest){
    issues.push({id:"MEASURE-NECK-CHEST",severity:"review",
      explanation:"The recorded neck circumference is not smaller than the chest; verify the body landmarks rather than calculating a finished collar automatically."});
  }
  if(validCm(p.waist)&&validCm(p.seat)&&Math.abs(p.seat-p.waist)>SEAT_WAIST_REVIEW_DELTA_CM){
    issues.push({id:"MEASURE-SEAT-WAIST",severity:"review",
      explanation:"The recorded seat and waist circumference differ unusually widely; the tailor should confirm both measurements before choosing a trouser block."});
  }
  return issues;
}
