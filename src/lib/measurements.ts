export type MeasurementUnit = "cm" | "in";
export type ShirtMeasurements = { neck?: number; chest?: number; waist?: number; shoulder?: number; sleeve?: number; shirtLength?: number; bicep?: number; wrist?: number };
export type PantMeasurements = { waist?: number; seat?: number; thigh?: number; frontRise?: number; inseam?: number; outseam?: number; knee?: number; hem?: number };
export type MeasurementProfile = {
  version: 1;
  unit: MeasurementUnit;
  shirt: ShirtMeasurements;
  pants: PantMeasurements;
  updatedAt: string;
};

export const MEASUREMENT_STORAGE_KEY = "linen-earth-measurements-v1";
export const emptyMeasurementProfile = (): MeasurementProfile => ({ version: 1, unit: "in", shirt: {}, pants: {}, updatedAt: new Date().toISOString() });

const SHIRT_MEASUREMENT_KEYS = new Set<keyof ShirtMeasurements>(["neck","chest","waist","shoulder","sleeve","shirtLength","bicep","wrist"]);
const PANT_MEASUREMENT_KEYS = new Set<keyof PantMeasurements>(["waist","seat","thigh","frontRise","inseam","outseam","knee","hem"]);

/** Calendar-valid, offset-aware timestamps for browser measurement/observation
 * records. Date.parse alone normalizes nonexistent dates and 24:00.
 */
export function validMeasurementTimestamp(value:unknown):value is string {
  if(typeof value!=="string") return false;
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if(!match) return false;
  const [,yy,mm,dd,hh,mi,ss,zone]=match;
  const year=Number(yy),month=Number(mm),day=Number(dd);
  const date=new Date(Date.UTC(year,month-1,day));
  if(year<2000||month<1||month>12||day<1||day>31||
    date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day||
    Number(hh)>23||Number(mi)>59||Number(ss)>59) return false;
  if(zone!=="Z"){
    const hour=Number(zone.slice(1,3)),minute=Number(zone.slice(4,6));
    if(hour>14||minute>59||(hour===14&&minute!==0)) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function validStoredMeasurements(value:unknown,keys:Set<string>):Record<string,number>|null {
  if(!value||typeof value!=="object"||Array.isArray(value)) return null;
  const entries=Object.entries(value);
  if(entries.some(([key,measurement])=>!keys.has(key)||typeof measurement!=="number"||!Number.isFinite(measurement)||measurement<=0||measurement>350)) return null;
  return Object.fromEntries(entries) as Record<string,number>;
}

/** Validate persisted measurements without coercing or inventing missing evidence. */
export function validStoredMeasurementProfile(value:unknown):MeasurementProfile|null {
  if(!value||typeof value!=="object"||Array.isArray(value)) return null;
  const profile=value as Partial<MeasurementProfile>;
  const shirt=validStoredMeasurements(profile.shirt,SHIRT_MEASUREMENT_KEYS);
  const pants=validStoredMeasurements(profile.pants,PANT_MEASUREMENT_KEYS);
  if(profile.version!==1||(profile.unit!=="cm"&&profile.unit!=="in")||!shirt||!pants) return null;
  if(!validMeasurementTimestamp(profile.updatedAt)) return null;
  return {version:1,unit:profile.unit,shirt,pants,updatedAt:profile.updatedAt};
}

export function toCm(value: number, unit: MeasurementUnit) { return unit === "cm" ? value : value * 2.54; }
export function fromCm(value: number, unit: MeasurementUnit) { return unit === "cm" ? value : value / 2.54; }
export function formatMeasure(value: number | undefined, unit: MeasurementUnit) { return value == null ? "—" : `${fromCm(value,unit).toFixed(1)} ${unit === "in" ? "in" : "cm"}`; }

export function measurementCoverage(profile?: MeasurementProfile | null) {
  if (!profile) return { shirt: 0, pants: 0, total: 0 };
  const shirt = Object.values(profile.shirt).filter((v) => typeof v === "number" && v > 0).length;
  const pants = Object.values(profile.pants).filter((v) => typeof v === "number" && v > 0).length;
  return { shirt, pants, total: shirt + pants };
}

export function measurementFitGuidance(profile?: MeasurementProfile | null) {
  if (!profile) return [];
  const notes: string[] = [];
  if (profile.shirt.chest && profile.shirt.waist) {
    const delta = profile.shirt.chest - profile.shirt.waist;
    if (delta >= 18) notes.push("Shape the shirt through the waist while preserving chest ease; avoid over-slimming the lower torso.");
    else if (delta <= 6) notes.push("Use a straighter shirt body with controlled side-seam suppression rather than an aggressive taper.");
    else notes.push("Use a balanced tailored shirt taper with moderate chest and waist ease.");
  }
  if (profile.shirt.shoulder) notes.push("Use the recorded shoulder width as the anchor measurement before adjusting sleeve length and armhole balance.");
  if (profile.pants.waist && profile.pants.seat) {
    const delta = profile.pants.seat - profile.pants.waist;
    if (delta >= 24) notes.push("Build trouser room through seat and upper thigh, then taper below the knee rather than reducing the hip block.");
    else notes.push("Keep the trouser block clean through waist and seat with proportionate thigh ease.");
  }
  if (profile.pants.inseam && profile.pants.outseam) notes.push("Use recorded inseam/outseam together to check rise balance before final hem placement.");
  return notes.slice(0,4);
}
