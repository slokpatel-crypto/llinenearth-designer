import type { FabricColorway } from "../src/lib/fabric-stock.ts";

export const FABRIC_CALIBRATION_COLUMNS: readonly [
  "fabricId", "garmentRoles", "collection", "colour", "cataloguePattern",
  "swatchImage", "sourcePdf", "sourcePage", "nominalScreenHex",
  "declaredCompositionNote", "physicalStockChecked", "actualRollMetres",
  "measuredComposition", "measuredGsm", "measuredPatternRepeatMm",
  "measuredSwatchWidthMm", "rulerPhotoReference", "colourReferencePhoto",
  "measuredWarpBendingCm", "measuredWeftBendingCm", "tailorDrapeReview",
  "measuredBy", "independentlyApprovedBy", "approvalState",
];
export type FabricCalibrationRow = Record<typeof FABRIC_CALIBRATION_COLUMNS[number], string>;
export function makeFabricCalibrationRows(stock: readonly FabricColorway[]): FabricCalibrationRow[];
export function fabricCalibrationCsv(rows: readonly FabricCalibrationRow[]): string;
