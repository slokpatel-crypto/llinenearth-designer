export type ShoulderBalance = "unknown" | "level" | "square" | "sloping";
export type PostureBalance = "unknown" | "balanced" | "erect" | "forward";
export type SeatBalance = "unknown" | "balanced" | "flat" | "full";
export type MobilityPriority = "standard" | "high";

export type TailorObservationProfile = {
  version: 1;
  shoulderBalance: ShoulderBalance;
  posture: PostureBalance;
  seatBalance: SeatBalance;
  mobilityPriority: MobilityPriority;
  updatedAt: string;
};

export const TAILOR_OBSERVATION_STORAGE_KEY = "linen-earth-tailor-observations-v1";

/** Validate persisted manual observations without manufacturing a timestamp or category. */
export function validStoredTailorObservationProfile(value:unknown):TailorObservationProfile|null {
  if(!value||typeof value!=="object"||Array.isArray(value)) return null;
  const profile=value as Partial<TailorObservationProfile>;
  if(profile.version!==1) return null;
  if(!(["unknown","level","square","sloping"] as unknown[]).includes(profile.shoulderBalance)) return null;
  if(!(["unknown","balanced","erect","forward"] as unknown[]).includes(profile.posture)) return null;
  if(!(["unknown","balanced","flat","full"] as unknown[]).includes(profile.seatBalance)) return null;
  if(!(["standard","high"] as unknown[]).includes(profile.mobilityPriority)) return null;
  if(typeof profile.updatedAt!=="string"||!Number.isFinite(Date.parse(profile.updatedAt))) return null;
  return {
    version:1,
    shoulderBalance:profile.shoulderBalance,
    posture:profile.posture,
    seatBalance:profile.seatBalance,
    mobilityPriority:profile.mobilityPriority,
    updatedAt:profile.updatedAt,
  } as TailorObservationProfile;
}

export function emptyTailorObservationProfile():TailorObservationProfile {
  return {
    version:1,
    shoulderBalance:"unknown",
    posture:"unknown",
    seatBalance:"unknown",
    mobilityPriority:"standard",
    updatedAt:new Date().toISOString(),
  };
}

export function tailorObservationCoverage(profile?:TailorObservationProfile|null) {
  if(!profile) return 0;
  return [
    profile.shoulderBalance!=="unknown",
    profile.posture!=="unknown",
    profile.seatBalance!=="unknown",
    profile.mobilityPriority==="high",
  ].filter(Boolean).length;
}

export function tailorObservationSummary(profile?:TailorObservationProfile|null) {
  if(!profile) return [];
  const notes:string[]=[];
  if(profile.shoulderBalance!=="unknown") notes.push(`Shoulder balance: ${profile.shoulderBalance}.`);
  if(profile.posture!=="unknown") notes.push(`Posture balance: ${profile.posture}.`);
  if(profile.seatBalance!=="unknown") notes.push(`Seat balance: ${profile.seatBalance}.`);
  if(profile.mobilityPriority==="high") notes.push("Customer prioritizes additional mobility.");
  return notes;
}
