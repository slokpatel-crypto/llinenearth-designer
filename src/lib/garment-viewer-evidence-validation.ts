import type { GarmentViewerPatternScaleSample } from "./garment-viewer-readiness.ts";
import type { RealismAssessment } from "./designer/proof-scale.ts";

// Numeric user input and stored JSON are different trust boundaries. Neither
// should convert null, blank strings, booleans or malformed values into a pass.
const DECIMAL = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const round2 = (value: number) => Math.round(value * 100) / 100;
const validPositive = (value: unknown, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 && value <= max;

type ScaleMeasurement = Pick<GarmentViewerPatternScaleSample,
  "repeatMm" | "observedRepeatPx" | "referenceMm" | "referencePx" | "physicalEvidenceNote">;

function calibratedMeasurement(value: Record<string, unknown>): ScaleMeasurement | null {
  const { repeatMm, observedRepeatPx, referenceMm, referencePx } = value;
  const physicalEvidenceNote = typeof value.physicalEvidenceNote === "string"
    ? value.physicalEvidenceNote.replace(/\s+/g, " ").trim().slice(0, 700)
    : "";
  if (!validPositive(repeatMm, 5000) || !validPositive(observedRepeatPx, 20000)
    || !validPositive(referenceMm, 5000) || !validPositive(referencePx, 20000)
    || physicalEvidenceNote.length < 12) return null;
  return { repeatMm, observedRepeatPx, referenceMm, referencePx, physicalEvidenceNote };
}

function calculatedErrorPct(measurement: ScaleMeasurement): number {
  const expectedPx = measurement.repeatMm! * (measurement.referencePx! / measurement.referenceMm!);
  return Math.abs(measurement.observedRepeatPx! - expectedPx) / expectedPx * 100;
}

// Gate comparisons use the unrounded physical result, not its two-decimal
// display/storage form: an actual 8.004% error must not round into 8.00% pass.
export function preciseGarmentScaleErrorPct(sample: GarmentViewerPatternScaleSample): number | null {
  const measurement = calibratedMeasurement(sample as unknown as Record<string, unknown>);
  if (!measurement) return null;
  const error = calculatedErrorPct(measurement);
  return Number.isFinite(error) ? error : null;
}

export function parseGarmentPatternSamples(value: unknown): GarmentViewerPatternScaleSample[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-20).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const fabricId = typeof row.fabricId === "string" ? row.fabricId.trim().slice(0, 160) : "";
    const pattern = row.pattern;
    const errorPct = row.errorPct;
    if (!fabricId || (pattern !== "stripe" && pattern !== "check" && pattern !== "other")
      || typeof errorPct !== "number" || !Number.isFinite(errorPct)
      || errorPct < 0 || errorPct > 100) return [];
    const verified = row.verified === true;
    const measurement = calibratedMeasurement(row);
    // Old manually entered percentages remain historical *unverified* records.
    // In particular, a legacy checked 'verified' flag can no longer pass QA.
    if (verified && !measurement) return [];
    if (!measurement) return [{ fabricId, pattern, errorPct, verified: false }];
    const calculated = calculatedErrorPct(measurement);
    if (!Number.isFinite(calculated) || calculated > 100) return [];
    return [{ fabricId, pattern, errorPct: round2(calculated), verified, ...measurement }];
  });
}

export function parseGarmentLatencySamples(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === "number"
    && Number.isFinite(item) && item > 0 && item <= 10000).slice(-120);
}

export function parseGarmentRealismAssessments(value: unknown): RealismAssessment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-50).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const viewerId = typeof row.viewerId === "string" ? row.viewerId.trim().toLowerCase().slice(0, 80) : "";
    const rating = row.rating;
    if (viewerId.length < 2 || typeof rating !== "number" || !Number.isInteger(rating)
      || rating < 1 || rating > 5) return [];
    return [{ viewerId, rating, recordedAt: typeof row.recordedAt === "string"
      ? row.recordedAt.slice(0, 80) : "" }];
  });
}

function parsePositiveText(value: string): number | null {
  const text = value.trim();
  if (!DECIMAL.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : null;
}

// Operator records the measured cloth repeat and a same-plane pixel/mm ruler
// calibration. The claimed error is DERIVED, never accepted from a text box.
export function parseCalibratedScaleInput(
  fabricId: string,
  pattern: "stripe" | "check",
  repeatText: string,
  observedText: string,
  referenceMmText: string,
  referencePxText: string,
  physicalEvidenceNote: string,
  verified: boolean,
): GarmentViewerPatternScaleSample | null {
  const repeatMm = parsePositiveText(repeatText);
  const observedRepeatPx = parsePositiveText(observedText);
  const referenceMm = parsePositiveText(referenceMmText);
  const referencePx = parsePositiveText(referencePxText);
  if (repeatMm === null || observedRepeatPx === null || referenceMm === null || referencePx === null) return null;
  const [sample] = parseGarmentPatternSamples([{
    fabricId, pattern, verified, errorPct: 0,
    repeatMm, observedRepeatPx, referenceMm, referencePx, physicalEvidenceNote,
  }]);
  return sample ?? null;
}

// Keep this legacy parser available for older operator clients, but its result
// is *never* calibrated or verified. It cannot satisfy the new promotion gate.
export function parseMeasuredScaleInput(
  fabricId: string,
  error: string,
  pattern: "stripe" | "check",
  _verified: boolean,
): GarmentViewerPatternScaleSample | null {
  const id = fabricId.trim().slice(0, 160);
  const text = error.trim();
  if (!id || !DECIMAL.test(text)) return null;
  const errorPct = Number(text);
  if (!Number.isFinite(errorPct) || errorPct < 0 || errorPct > 100) return null;
  return { fabricId: id, pattern, errorPct: round2(errorPct), verified: false };
}

export function normalizeGarmentViewerEvidenceForStorage(payload: Record<string, unknown>) {
  return {
    patternScaleSamples: parseGarmentPatternSamples(payload.patternScaleSamples),
    interactionLatencyMs: parseGarmentLatencySamples(payload.interactionLatencyMs)
      .map((sample) => Math.round(sample * 10) / 10).filter((sample) => sample > 0),
    realismAssessments: parseGarmentRealismAssessments(payload.realismAssessments),
  };
}
