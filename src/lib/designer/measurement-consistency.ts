import type {MeasurementProfile} from "../measurements.ts";

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
  if(!profile) return [];
  const issues:MeasurementConsistencyIssue[]=[];
  const values=[...Object.entries(profile.shirt),...Object.entries(profile.pants)];
  for(const [name,value] of values){
    if(value!==undefined&&(!Number.isFinite(value)||value<=0||value>350)){
      issues.push({id:"MEASURE-INVALID",severity:"warning",
        explanation:`The recorded ${name} is outside supported centimetre limits; remeasure it before cutting.`});
    }
  }
  const p=profile.pants;
  if(p.inseam&&p.outseam&&p.outseam<=p.inseam){
    issues.push({id:"MEASURE-SEAM-ORDER",severity:"warning",
      explanation:"Trouser outseam must extend farther than inseam on the same garment; check that both measurements were recorded in centimetres and with the correct landmarks."});
  }
  if(p.frontRise&&p.outseam&&p.frontRise>=p.outseam){
    issues.push({id:"MEASURE-RISE-ORDER",severity:"warning",
      explanation:"Recorded trouser front rise is as long as or longer than the entire outseam; confirm the measuring landmarks and units."});
  }
  // Disagreements between shapes are *review* notes, not assertions that any
  // specific body shape is invalid.
  if(profile.shirt.neck&&profile.shirt.chest&&profile.shirt.neck>=profile.shirt.chest){
    issues.push({id:"MEASURE-NECK-CHEST",severity:"review",
      explanation:"The recorded neck circumference is not smaller than the chest; verify the body landmarks rather than calculating a finished collar automatically."});
  }
  if(p.waist&&p.seat&&Math.abs(p.seat-p.waist)>75){
    issues.push({id:"MEASURE-SEAT-WAIST",severity:"review",
      explanation:"The recorded seat and waist circumference differ unusually widely; the tailor should confirm both measurements before choosing a trouser block."});
  }
  return issues;
}
