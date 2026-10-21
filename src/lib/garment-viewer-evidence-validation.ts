import type { GarmentViewerPatternScaleSample } from "./garment-viewer-readiness.ts";
import type { RealismAssessment } from "./designer/proof-scale.ts";

// Never coerce JSON evidence: Number(null), Number(false), and Number("")
// all equal zero and would fabricate perfect measurements or timing samples.
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
    return [{ fabricId, pattern, errorPct, verified: row.verified === true }];
  });
}

export function parseGarmentLatencySamples(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  // A measured interaction must take positive finite time. Strings, blanks,
  // nulls, booleans and zero-duration placeholders are not real observations.
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

export function parseMeasuredScaleInput(
  fabricId: string,
  error: string,
  pattern: "stripe" | "check",
  verified: boolean,
): GarmentViewerPatternScaleSample | null {
  const id = fabricId.trim().slice(0, 160);
  const text = error.trim();
  // Number("") is 0; a blank measurement must never become perfect scale.
  if (!id || !text || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null;
  const errorPct = Number(text);
  if (!Number.isFinite(errorPct) || errorPct < 0 || errorPct > 100) return null;
  return { fabricId: id, pattern, errorPct: Math.round(errorPct * 100) / 100, verified };
}
