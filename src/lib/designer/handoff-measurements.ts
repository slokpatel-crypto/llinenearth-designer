import type { FinishedTarget } from "./fit-construction.ts";

/**
 * Fail closed on corrupt or self-contradictory garment targets at the final
 * production-export boundary. This is a data-integrity check, not a tailor
 * approval or a new physical fit tolerance.
 */
export type HandoffMeasurementAudit = {
  errors: string[];
  missing: string[];
};

type TargetGroup = { shirt: readonly FinishedTarget[]; trouser: readonly FinishedTarget[] };

const ESSENTIAL_TARGETS = {
  shirt: ["Finished shirt chest"],
  trouser: ["Finished trouser waist", "Finished trouser seat"],
} as const;

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function auditHandoffMeasurements(groups: TargetGroup): HandoffMeasurementAudit {
  const errors: string[] = [];
  const missing: string[] = [];

  for (const garment of ["shirt", "trouser"] as const) {
    const targets = groups[garment];
    if (!Array.isArray(targets)) {
      errors.push(`${garment}: finished targets must be an array.`);
      continue;
    }
    const seen = new Set<string>();
    for (const [index, value] of targets.entries()) {
      const name = `${garment} target #${index + 1}`;
      if (!value || typeof value !== "object") {
        errors.push(`${name}: malformed measurement target.`);
        continue;
      }
      const label = typeof value.label === "string" ? value.label.trim() : "";
      if (!label || label.length > 120) errors.push(`${name}: missing or excessive measurement label.`);
      const key = label.toLowerCase();
      if (key && seen.has(key)) errors.push(`${garment}: duplicate measurement label "${label}".`);
      seen.add(key);

      if (!finite(value.bodyCm) || value.bodyCm <= 0 || value.bodyCm > 350) {
        errors.push(`${name}: body reading must be a finite, positive centimetre value within the supported input range.`);
      }
      const finished = value.finishedCm;
      if (!finished || !finite(finished.min) || !finite(finished.max)
          || finished.min <= 0 || finished.max > 500 || finished.min > finished.max) {
        errors.push(`${name}: finished range is invalid or reversed.`);
      }
      if (!["body_plus_ease", "recorded_anchor", "customer_desired"].includes(value.basis)) {
        errors.push(`${name}: unrecognised measurement basis.`);
      }
      const ease = value.easeCm;
      if (ease !== undefined) {
        if (!finite(ease?.min) || !finite(ease?.max) || ease.min > ease.max) {
          errors.push(`${name}: ease range is invalid or reversed.`);
        } else if (finite(value.bodyCm) && finished && finite(finished.min) && finite(finished.max)
          && (Math.abs((value.bodyCm + ease.min) - finished.min) > 0.21
            || Math.abs((value.bodyCm + ease.max) - finished.max) > 0.21)) {
          // Calculated targets are rounded to 0.1cm, so allow 0.2cm for
          // legacy double-rounding; do not accept a materially changed range.
          errors.push(`${name}: finished range conflicts with the recorded body-plus-ease values.`);
        }
      } else if (value.basis === "body_plus_ease") {
        errors.push(`${name}: body-plus-ease target lacks its ease range.`);
      }
    }

    for (const label of ESSENTIAL_TARGETS[garment]) {
      if (!seen.has(label.toLowerCase())) {
        missing.push(`${garment}: ${label} is not recorded; tailor must measure and confirm it before production.`);
      }
    }
  }
  return { errors, missing };
}
