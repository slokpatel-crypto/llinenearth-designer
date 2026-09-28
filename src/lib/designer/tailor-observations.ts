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
