/**
 * Customer inspection crops for the existing fixed front photograph only.
 * Coordinates are relative to the 1024 x 1536 source frame and are not
 * garment geometry, cutting lines, drape, or real-person fit evidence.
 *
 * Fit retains the previous 1.42x zoom for backward-compatible screenshot QA.
 * Target zones magnify the photographed collar, sleeves, waistband and hem
 * without generating or pretending to reconstruct new garment views.
 */
export const PHOTO_INSPECTION_FOCUS = {
  full: { label: "Full view", scale: 1, originX: 50, originY: 35 },
  fit: { label: "Zoom fit", scale: 1.42, originX: 50, originY: 35 },
  collar: { label: "Collar", scale: 2.25, originX: 50, originY: 19 },
  sleeves: { label: "Sleeves", scale: 1.7, originX: 50, originY: 39 },
  waist: { label: "Waist", scale: 2.05, originX: 50, originY: 41 },
  hem: { label: "Trouser hem", scale: 1.9, originX: 50, originY: 80 },
} as const;

export type PhotoInspectionFocus = keyof typeof PHOTO_INSPECTION_FOCUS;
export const PHOTO_INSPECTION_TARGETS = ["collar", "sleeves", "waist", "hem"] as const;
