import { MEASUREMENT_STORAGE_KEY, type MeasurementProfile as LegacyMeasurementProfile } from "./measurements.ts";
import { makeCustomerMeasurementProfileId, validStoredCustomerMeasurementProfiles } from "./customer-measurement-storage-integrity.ts";
import { ACTIVE_CUSTOMER_MEASUREMENT_LINK_KEY, matchesActiveCustomerMeasurementSnapshot, parseActiveCustomerMeasurementLink, serializeActiveCustomerMeasurementLink } from "./customer-measurement-active-link.ts";

import { emptyTailorObservationProfile, TAILOR_OBSERVATION_STORAGE_KEY } from "./designer/tailor-observations.ts";
import { writeBrowserRecords, type BrowserWriteResult } from "./browser-storage-write.ts";

function requireSaved(result: BrowserWriteResult) {
  if (!result.saved) throw new Error(result.rollbackComplete
    ? "Profile was not changed. The previous browser records were restored."
    : "Profile was not confirmed. Browser storage may be inconsistent; recheck measurements before using Designer.");
}

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

export const CUSTOMER_MEASUREMENTS_KEY = "linen-earth-customer-measurements-v1";

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

function readCustomerMeasurementProfiles(): CustomerMeasurementProfile[] {
  const raw = localStorage.getItem(CUSTOMER_MEASUREMENTS_KEY);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Customer history is unreadable.");
  return validStoredCustomerMeasurementProfiles<CustomerMeasurementProfile>(parsed);
}

export function listCustomerMeasurementProfiles(): CustomerMeasurementProfile[] {
  if (typeof window === "undefined") return [];
  try {
    return readCustomerMeasurementProfiles();
  } catch {
    return [];
  }
}

export function saveCustomerMeasurementProfile(input: Omit<CustomerMeasurementProfile, "id" | "updatedAt"> & { id?: string }) {
  if (typeof window === "undefined") throw new Error("Measurements are available in the browser.");
  const existing = readCustomerMeasurementProfiles();
  const saved: CustomerMeasurementProfile = {
    id: input.id || makeCustomerMeasurementProfileId(window.crypto.getRandomValues(new Uint8Array(16)),Date.now()),
    name: input.name.trim(),
    unit: input.unit,
    measurements: input.measurements,
    updatedAt: new Date().toISOString(),
  };
  if (validStoredCustomerMeasurementProfiles([saved]).length !== 1) {
    throw new Error("Invalid customer measurement profile.");
  }
  const next = [saved, ...existing.filter((profile) => profile.id !== saved.id)].slice(0, 20);
  requireSaved(writeBrowserRecords(localStorage, [
    [CUSTOMER_MEASUREMENTS_KEY, JSON.stringify(next)],
    ...customerActivationRecords(saved),
  ]));
  return saved;
}

export function removeCustomerMeasurementProfile(id: string) {
  if (typeof window === "undefined") return;
  const next = readCustomerMeasurementProfiles().filter((profile) => profile.id !== id);
  const link=parseActiveCustomerMeasurementLink(localStorage.getItem(ACTIVE_CUSTOMER_MEASUREMENT_LINK_KEY));
  const active=link?.profileId===id?localStorage.getItem(MEASUREMENT_STORAGE_KEY):null;
  const records: Array<readonly [string,string|null]> = [[CUSTOMER_MEASUREMENTS_KEY,JSON.stringify(next)]];
  if(link?.profileId===id){
    // Never erase manual Designer measurements or another customer's active fit.
    if(matchesActiveCustomerMeasurementSnapshot(link,id,active)){
      records.push([MEASUREMENT_STORAGE_KEY,null]);
    }
    records.push([ACTIVE_CUSTOMER_MEASUREMENT_LINK_KEY,null]);
  }
  requireSaved(writeBrowserRecords(localStorage,records));
}

export function activateCustomerMeasurementProfile(profile: CustomerMeasurementProfile) {
  if (typeof window === "undefined") return;
  requireSaved(writeBrowserRecords(localStorage,customerActivationRecords(profile)));
}

function customerActivationRecords(profile: CustomerMeasurementProfile): Array<readonly [string,string]> {
  if (validStoredCustomerMeasurementProfiles([profile]).length !== 1) {
    throw new Error("Invalid customer measurement profile.");
  }
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
  const snapshot=JSON.stringify(legacy);
  // Named profiles do not capture posture evidence: never inherit another customer's observations.
  const observations=JSON.stringify({...emptyTailorObservationProfile(),updatedAt:legacy.updatedAt});
  return [
    [ACTIVE_CUSTOMER_MEASUREMENT_LINK_KEY,serializeActiveCustomerMeasurementLink(profile.id,snapshot)],
    [MEASUREMENT_STORAGE_KEY,snapshot],
    [TAILOR_OBSERVATION_STORAGE_KEY,observations],
  ];
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
