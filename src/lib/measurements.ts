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

export const MEASUREMENT_STORAGE_KEY = "llinen-earth-measurements-v1";
export const emptyMeasurementProfile = (): MeasurementProfile => ({ version: 1, unit: "cm", shirt: {}, pants: {}, updatedAt: new Date().toISOString() });

export function toCm(value: number, unit: MeasurementUnit) { return unit === "cm" ? value : value * 2.54; }
export function fromCm(value: number, unit: MeasurementUnit) { return unit === "cm" ? value : value / 2.54; }
export function formatMeasure(value: number | undefined, unit: MeasurementUnit) { return value == null ? "—" : `${fromCm(value,unit).toFixed(unit === "cm" ? 1 : 2)} ${unit}`; }

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
