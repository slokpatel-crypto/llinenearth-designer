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

// A complete review packet needs garment-length landmarks as well as girths.
// Their presence does NOT prove the readings or authorise cutting.
const ESSENTIAL_TARGETS = {
  shirt: ["Finished shirt chest", "Shoulder-width anchor", "Sleeve-length anchor"],
  trouser: ["Finished trouser waist", "Finished trouser seat", "Inseam anchor", "Outseam anchor"],
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
    const byLabel = new Map<string, FinishedTarget>();
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
      if (key && !byLabel.has(key)) byLabel.set(key, value);

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
      if ((value.basis === "recorded_anchor" || value.basis === "customer_desired")) {
        if (ease !== undefined) {
          errors.push(`${name}: a directly recorded or customer-desired anchor cannot claim a calculated ease range.`);
        }
        if (finite(value.bodyCm) && finished && finite(finished.min) && finite(finished.max)
          && (Math.abs(value.bodyCm - finished.min) > 0.11
            || Math.abs(value.bodyCm - finished.max) > 0.11)) {
          errors.push(`${name}: direct anchor differs from its recorded centimetre value.`);
        }
      }
    }

    // Compare only like-for-like, recorded centimetre length landmarks.
    // These are logical ordering constraints, not fabricated body proportions.
    if (garment === "trouser") {
      const inseam = byLabel.get("inseam anchor")?.bodyCm;
      const outseam = byLabel.get("outseam anchor")?.bodyCm;
      const frontRise = byLabel.get("front-rise anchor")?.bodyCm;
      if (finite(inseam) && finite(outseam) && outseam <= inseam) {
        errors.push("trouser: outseam must be longer than inseam; verify landmarks and centimetre units.");
      }
      if (finite(frontRise) && finite(outseam) && frontRise >= outseam) {
        errors.push("trouser: front rise must be shorter than outseam; verify landmarks and centimetre units.");
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
