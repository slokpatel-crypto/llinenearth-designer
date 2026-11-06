import type { FinishedTarget } from "./fit-construction.ts";
import { HOUSE_EASE_TABLE_VERSION } from "./house-ease.ts";

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

/** Labels from fit-construction.ts. Keep the known physical landmark and
 * calculation semantics intact; unknown legacy labels remain reviewable.
 * This is a contract check, not an inferred body measurement or tolerance.
 */
const LANDMARK_BASIS = {
  shirt: {
    "finished collar circumference": "body_plus_ease",
    "finished shirt chest": "body_plus_ease",
    "finished shirt waist": "body_plus_ease",
    "finished upper-arm circumference": "body_plus_ease",
    "finished cuff circumference": "body_plus_ease",
    "shoulder-width anchor": "recorded_anchor",
    "sleeve-length anchor": "recorded_anchor",
    "shirt-length anchor": "customer_desired",
  },
  trouser: {
    "finished trouser waist": "body_plus_ease",
    "finished trouser seat": "body_plus_ease",
    "finished upper-thigh circumference": "body_plus_ease",
    "finished knee circumference": "body_plus_ease",
    "front-rise anchor": "recorded_anchor",
    "inseam anchor": "customer_desired",
    "outseam anchor": "customer_desired",
    "hem circumference target": "customer_desired",
  },
} as const satisfies Record<"shirt" | "trouser", Record<string, FinishedTarget["basis"]>>;

/**
 * Validate locked construction findings before they influence a production
 * review status. Invalid severity values must not be interpreted as "info"
 * or silently omitted from a printable review packet.
 */
export function auditHandoffConstructionChecks(input:unknown): HandoffMeasurementAudit {
  const errors:string[]=[];
  const missing:string[]=[];
  if (!Array.isArray(input)) {
    return { errors:["Construction checks must be an array."], missing };
  }
  for (const [index, item] of input.entries()) {
    const at=`Construction check #${index+1}`;
    if (!item || typeof item!=="object" || Array.isArray(item)) {
      errors.push(`${at} must be a record.`);
      continue;
    }
    const check=item as Record<string,unknown>;
    if (typeof check.id!=="string" || !check.id.trim() || check.id.length>120)
      errors.push(`${at} must have a nonempty bounded ID.`);
    if (typeof check.message!=="string" || !check.message.trim() || check.message.length>2000)
      errors.push(`${at} must have a nonempty bounded message.`);
    if (check.severity!=="info" && check.severity!=="review" && check.severity!=="warning")
      errors.push(`${at} has an unrecognized severity.`);
    // Even when status is review_required, the handoff's explicit
    // "Unresolved before production" must not say "None recorded" while
    // an open fit/construction check exists. Preserve its stable ID and
    // original instruction, without treating that instruction as approval.
    if ((check.severity==="review" || check.severity==="warning")
        && typeof check.id==="string" && check.id.trim()
        && typeof check.message==="string" && check.message.trim()) {
      missing.push(`Construction check ${check.id}: ${check.message.trim()} — tailor must review before production.`);
    }
  }
  return { errors, missing };
}

/**
 * Pattern-block guidance may contain outstanding shape, armhole, seat or
 * balance decisions even when an upstream construction-check list is empty.
 * Keep the exact recorded adjustment in the review packet, never reinterpret
 * a "review"/"warning" adjustment as a signed cutting instruction.
 */
export function auditHandoffBlockAdjustments(input:unknown):HandoffMeasurementAudit {
  const errors:string[]=[];
  const missing:string[]=[];
  if(input==null) return {errors,missing};
  if(typeof input!=="object" || Array.isArray(input)
      || !Array.isArray((input as {adjustments?:unknown}).adjustments)) {
    return {errors:["Block strategy must contain an adjustments array."],missing};
  }
  const block=input as Record<string,unknown>;
  // These are the exact closed identifiers in block-strategy.ts, not freeform
  // display names. Even a correctly hashed recipe must not present an
  // unrecognized cut block as a reconstructable pattern selection.
  const validBlocks:Record<string,readonly string[]>={
    shirtBlock:["unknown","balanced-shirt","shaped-shirt","straight-shirt","mobility-shirt"],
    trouserBlock:["unknown","clean-upper-block","roomy-seat-block","pleated-upper-block","relaxed-drape-block","flat-seat-cleanup"],
    torsoShape:["unknown","tapered","balanced","straight"],
    seatShape:["unknown","pronounced","balanced","flat"],
  };
  for(const [field,ids] of Object.entries(validBlocks)){
    const id=block[field];
    if(typeof id!=="string" || !ids.includes(id))
      errors.push(`Block strategy has unrecognized ${field} identifier.`);
    else if(id==="unknown")
      missing.push(`Block strategy ${field} is unknown; tailor must confirm the physical block and shape before production.`);
  }
  const adjustments=block.adjustments as unknown[];
  for(const [index,item] of adjustments.entries()){
    const at=`Block adjustment #${index+1}`;
    if(!item || typeof item!=="object" || Array.isArray(item)){
      errors.push(`${at} must be a record.`);
      continue;
    }
    const adjustment=item as Record<string,unknown>;
    if(typeof adjustment.id!=="string" || !adjustment.id.trim() || adjustment.id.length>120)
      errors.push(`${at} must have a nonempty bounded ID.`);
    if(adjustment.garment!=="shirt" && adjustment.garment!=="trouser")
      errors.push(`${at} must identify shirt or trouser.`);
    if(typeof adjustment.area!=="string" || !adjustment.area.trim() || adjustment.area.length>160)
      errors.push(`${at} must have a nonempty bounded pattern area.`);
    if(typeof adjustment.message!=="string" || !adjustment.message.trim() || adjustment.message.length>2000)
      errors.push(`${at} must have a nonempty bounded message.`);
    if(adjustment.severity!=="info" && adjustment.severity!=="review" && adjustment.severity!=="warning")
      errors.push(`${at} has an unrecognized severity.`);
    if((adjustment.severity==="review" || adjustment.severity==="warning")
       && typeof adjustment.message==="string" && adjustment.message.trim()) {
      missing.push(`Block adjustment ${String(adjustment.id)} (${String(adjustment.garment)} / ${String(adjustment.area)}): ${adjustment.message.trim()} — tailor must review before production.`);
    }
  }
  return {errors,missing};
}

export type HandoffFitProvenance = {
  fitConstructionVersion: unknown;
  easeSource: unknown;
  easeTableVersion: unknown;
};

/** Checks internal version/source coherence, not authenticity of an external
 * calibration approval. Physical evidence is still required before cutting. */
export function auditHandoffFitProvenance(source: HandoffFitProvenance): HandoffMeasurementAudit {
  const errors: string[] = [];
  const missing: string[] = [];
  if (!source || typeof source !== "object") {
    return { errors: ["Fit/ease provenance must be a record."], missing };
  }
  const fields = [source.fitConstructionVersion, source.easeSource, source.easeTableVersion];
  if (fields.every((value) => value == null)) {
    missing.push("Fit/ease source and calibration version are not recorded; tailor must confirm before production.");
    return { errors, missing };
  }
  if (fields.some((value) => value == null)) {
    errors.push("Fit/ease provenance is incomplete; version, source and table version must be recorded together.");
    return { errors, missing };
  }
  const expectedSource = source.fitConstructionVersion === "fit-construction-provisional-1"
    ? "provisional_house_defaults"
    : source.fitConstructionVersion === "fit-construction-calibrated-2"
      ? "approved_house_calibration"
      : null;
  if (!expectedSource || source.easeSource !== expectedSource) {
    errors.push("Fit construction version conflicts with its declared ease source.");
  }
  if (typeof source.easeTableVersion !== "string"
      || source.easeTableVersion.trim().length === 0
      || source.easeTableVersion.length > 120) {
    errors.push("Fit/ease table version must be a nonempty bounded identifier.");
  }
  // Provisional ranges always originate from one pinned house ease table.
  // Keep older locked versions reconstructable, but treat a different or
  // unrecognized version as an unresolved provenance discrepancy rather
  // than silently claiming that the current default ranges were used.
  if (source.fitConstructionVersion === "fit-construction-provisional-1"
      && source.easeSource === "provisional_house_defaults"
      && typeof source.easeTableVersion === "string"
      && source.easeTableVersion !== HOUSE_EASE_TABLE_VERSION) {
    missing.push(`Provisional house ease table version ${JSON.stringify(source.easeTableVersion)} does not match ${HOUSE_EASE_TABLE_VERSION}; tailor must verify the original range contract before production.`);
  }
  // A lock proves that a customer selected this calibration identifier. It
  // does not carry the owner/tailor approval record or measured garment cases.
  // Even a self-consistent "approved" claim remains human-review-only until
  // its referenced approval is checked independently against real evidence.
  if (source.fitConstructionVersion === "fit-construction-calibrated-2"
      && source.easeSource === "approved_house_calibration") {
    missing.push("Claimed approved house ease calibration is not authenticated by the locked recipe; confirm its approval record and measured-garment evidence with the tailor before production.");
  }
  return { errors, missing };
}

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function auditHandoffMeasurements(
  groups: TargetGroup,
  options: { shirtWear?: string | null; trouserRise?: string | null; shirtCuff?: string | null } = {},
): HandoffMeasurementAudit {
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
      const expectedBasis = (LANDMARK_BASIS[garment] as Readonly<Record<string, FinishedTarget["basis"]>>)[key];
      const otherGarment = garment === "shirt" ? "trouser" : "shirt";
      const otherBasis = (LANDMARK_BASIS[otherGarment] as Readonly<Record<string, FinishedTarget["basis"]>>)[key];
      if (otherBasis) {
        errors.push(`${name}: "${label}" is a ${otherGarment} landmark, not a ${garment} measurement.`);
      } else if (key && !expectedBasis) {
        // Custom/legacy labels may be retained for reconstruction, but their
        // units and measurement method are not defined by this versioned
        // physical contract. Never silently mark such a packet review-ready.
        missing.push(`${garment}: "${label}" has no recognised landmark definition; tailor must confirm its centimetre units, measuring method and construction basis before production.`);
      }
      if (expectedBasis && value.basis !== expectedBasis) {
        errors.push(`${name}: "${label}" must retain ${expectedBasis} basis; received ${String(value.basis)}.`);
      }
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
        // The house/calibration contract requires non-negative ranges and
        // the calibration normalizer caps the upper bound at 80 cm. Enforce
        // that same recorded software range at the final export boundary;
        // this is not a claim that 80 cm is an approved physical fit.
        if (!finite(ease?.min) || !finite(ease?.max)
            || ease.min < 0 || ease.max > 80 || ease.min > ease.max) {
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

    // Recheck conservative cross-body contradictions at the export boundary.
    // The upstream measurement-consistency review may be absent from a
    // hand-built or stale locked recipe. These are review flags, not claims
    // about medical normality or a physical pattern's approved fit.
    if (garment === "shirt") {
      const neck = byLabel.get("finished collar circumference")?.bodyCm;
      const chest = byLabel.get("finished shirt chest")?.bodyCm;
      if (finite(neck) && finite(chest) && neck >= chest) {
        missing.push("shirt: recorded neck circumference is not smaller than chest; tailor must recheck both body landmarks before fit review.");
      }
    }

    // Compare only like-for-like, recorded centimetre length landmarks.
    // These are logical ordering constraints, not fabricated body proportions.
    if (garment === "trouser") {
      const waist = byLabel.get("finished trouser waist")?.bodyCm;
      const seat = byLabel.get("finished trouser seat")?.bodyCm;
      if (finite(waist) && finite(seat) && Math.abs(seat - waist) > 75) {
        // Use the same conservative review threshold as the existing
        // measurement-consistency module; do not call it an impossible body.
        missing.push("trouser: recorded waist and seat differ by over 75 cm; tailor must reconfirm both body landmarks before fit review.");
      }
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
    // A tucked shirt needs a length landmark for pattern review. Do not infer
    // it from the pictured model, nominal cut length, or fit defaults.
    // This is a context-dependent presence gate, not a physical fit approval.
    if (garment === "shirt"
        && (options.shirtWear === "tucked" || options.shirtWear === "Tucked")
        && !seen.has("shirt-length anchor")) {
      missing.push("shirt: Shirt-length anchor is not recorded for the selected tucked construction; tailor must confirm the length before production.");
    }
    // A French / double cuff requires a separately recorded wrist anchor
    // to determine the cuff circumference. The locked construction ID takes
    // precedence over preview shorthand, and no wrist value is inferred.
    if (garment === "shirt"
        && (options.shirtCuff === "french_double_cuff"
          || options.shirtCuff === "French / Double Cuff")
        && !seen.has("finished cuff circumference")) {
      missing.push("shirt: Finished cuff circumference is not recorded for the selected French/double cuff; tailor must measure and confirm the wrist before production.");
    }
    // High and extra-high rises cannot be reconstructed from waist/seat,
    // inseam and outseam alone. Require a separately recorded front-rise
    // landmark for tailor review; never synthesize a physical rise value.
    if (garment === "trouser"
        && (options.trouserRise === "high_rise" || options.trouserRise === "extra_high_rise"
          || options.trouserRise === "High Rise")
        && !seen.has("front-rise anchor")) {
      missing.push("trouser: Front-rise anchor is not recorded for the selected high-rise construction; tailor must measure and confirm the rise before production.");
    }
  }
  return { errors, missing };
}
