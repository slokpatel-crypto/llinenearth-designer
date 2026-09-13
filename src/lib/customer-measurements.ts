import { MEASUREMENT_STORAGE_KEY, type MeasurementProfile as LegacyMeasurementProfile } from "@/lib/measurements";

export type CustomerMeasurementUnit = "cm" | "in";
export type CustomerMeasurementKey = "chest" | "waist" | "shoulder" | "sleeveLength" | "neck" | "hip" | "shirtLength" | "trouserWaist" | "trouserLength" | "inseam";

export type CustomerMeasurementProfile = {
  id: string;
  name: string;
  unit: CustomerMeasurementUnit;
  measurements: Partial<Record<CustomerMeasurementKey, number>>;
  updatedAt: string;
};

export type CustomerMeasurementField = {
  key: CustomerMeasurementKey;
  label: string;
  required: boolean;
  guideMinCm: number;
  guideMaxCm: number;
};

export const CUSTOMER_MEASUREMENTS_KEY = "llinen-earth-customer-measurements-v1";

export const customerMeasurementFields: CustomerMeasurementField[] = [
  { key: "chest", label: "Chest", required: true, guideMinCm: 75, guideMaxCm: 150 },
  { key: "waist", label: "Waist", required: true, guideMinCm: 65, guideMaxCm: 150 },
  { key: "shoulder", label: "Shoulder", required: true, guideMinCm: 35, guideMaxCm: 65 },
  { key: "sleeveLength", label: "Sleeve length", required: true, guideMinCm: 50, guideMaxCm: 80 },
  { key: "neck", label: "Neck", required: false, guideMinCm: 30, guideMaxCm: 55 },
  { key: "hip", label: "Hip / seat", required: false, guideMinCm: 75, guideMaxCm: 160 },
  { key: "shirtLength", label: "Shirt length", required: false, guideMinCm: 60, guideMaxCm: 95 },
  { key: "trouserWaist", label: "Trouser waist", required: false, guideMinCm: 60, guideMaxCm: 150 },
  { key: "trouserLength", label: "Trouser length", required: false, guideMinCm: 80, guideMaxCm: 125 },
  { key: "inseam", label: "Inseam", required: false, guideMinCm: 55, guideMaxCm: 100 },
];

export function measurementToCm(value: number, unit: CustomerMeasurementUnit) {
  return unit === "cm" ? value : value * 2.54;
}

export function measurementFromCm(value: number, unit: CustomerMeasurementUnit) {
  return unit === "cm" ? value : value / 2.54;
}

export function listCustomerMeasurementProfiles(): CustomerMeasurementProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOMER_MEASUREMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomerMeasurementProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomerMeasurementProfile(input: Omit<CustomerMeasurementProfile, "id" | "updatedAt"> & { id?: string }) {
  if (typeof window === "undefined") throw new Error("Measurements are available in the browser.");
  const existing = listCustomerMeasurementProfiles();
  const saved: CustomerMeasurementProfile = {
    id: input.id || `CMP-${Date.now()}`,
    name: input.name.trim(),
    unit: input.unit,
    measurements: input.measurements,
    updatedAt: new Date().toISOString(),
  };
  const next = [saved, ...existing.filter((profile) => profile.id !== saved.id)].slice(0, 20);
  localStorage.setItem(CUSTOMER_MEASUREMENTS_KEY, JSON.stringify(next));
  activateCustomerMeasurementProfile(saved);
  return saved;
}

export function removeCustomerMeasurementProfile(id: string) {
  if (typeof window === "undefined") return;
  const next = listCustomerMeasurementProfiles().filter((profile) => profile.id !== id);
  localStorage.setItem(CUSTOMER_MEASUREMENTS_KEY, JSON.stringify(next));
}

export function activateCustomerMeasurementProfile(profile: CustomerMeasurementProfile) {
  if (typeof window === "undefined") return;
  const m = profile.measurements;
  const legacy: LegacyMeasurementProfile = {
    version: 1,
    unit: profile.unit,
    shirt: {
      chest: m.chest,
      waist: m.waist,
      shoulder: m.shoulder,
      sleeve: m.sleeveLength,
      neck: m.neck,
      shirtLength: m.shirtLength,
    },
    pants: {
      waist: m.trouserWaist,
      seat: m.hip,
      outseam: m.trouserLength,
      inseam: m.inseam,
    },
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(MEASUREMENT_STORAGE_KEY, JSON.stringify(legacy));
}

export function profileMeasurementSummary(profile: CustomerMeasurementProfile) {
  return customerMeasurementFields
    .filter((field) => profile.measurements[field.key] != null)
    .map((field) => {
      const cm = profile.measurements[field.key] as number;
      const value = measurementFromCm(cm, profile.unit);
      return `${field.label}: ${value.toFixed(profile.unit === "in" ? 2 : 1)} ${profile.unit}`;
    })
    .join(" · ");
}
