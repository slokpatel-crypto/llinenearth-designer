/**
 * Finished garment quality-control draft (Roadmap production bridge, milestone M1).
 * This module records an operator's declared observations. It neither validates a
 * customer's measurements nor authorises cutting, dispatch, or order completion.
 */
export const FINISHED_GARMENT_QC_CHECKS = [
  { id: "fabric_identity", label: "Fabric identity matches the approved job" },
  { id: "fabric_surface", label: "Fabric surface and visible defects inspected" },
  { id: "seams_stitches", label: "Seams, stitches and seam strength inspected" },
  { id: "construction", label: "Collar, cuffs, pockets or waist construction inspected" },
  { id: "fastenings", label: "Buttons, zippers and other fastenings inspected" },
  { id: "finishing", label: "Hems, loose threads and pressing inspected" },
  { id: "fit_review", label: "Fit and movement checked against the approved job" },
] as const;

export type FinishedGarmentQcCheckId = (typeof FINISHED_GARMENT_QC_CHECKS)[number]["id"];
export type FinishedGarmentQcAnswer = "pass" | "fail" | "not_checked";
export type FinishedGarmentQcMeasurement = {
  label: string;
  expectedMm: number | null;
  actualMm: number | null;
  toleranceMm: number | null;
};
export type FinishedGarmentQcDraft = {
  jobReference: string;
  garment: string;
  answers: Partial<Record<FinishedGarmentQcCheckId, FinishedGarmentQcAnswer>>;
  measurements: readonly FinishedGarmentQcMeasurement[];
};
export type FinishedGarmentQcAssessment = {
  status: "incomplete" | "hold" | "ready_for_review";
  completedChecks: number;
  totalChecks: number;
  issues: string[];
  measurementResults: Array<{
    label: string;
    differenceMm: number | null;
    withinTolerance: boolean | null;
  }>;
};

const VALID_ANSWERS = new Set<FinishedGarmentQcAnswer>(["pass", "fail", "not_checked"]);
const CHECK_IDS = new Set<string>(FINISHED_GARMENT_QC_CHECKS.map((check) => check.id));

function validDimension(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validTolerance(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Fail closed on incomplete or invalid input; a passing checklist is NOT approval. */
export function assessFinishedGarmentQc(input: FinishedGarmentQcDraft): FinishedGarmentQcAssessment {
  const issues: string[] = [];
  let hasDefect = false;
  let completedChecks = 0;

  if (!input.jobReference.trim() || input.jobReference.length > 80) {
    issues.push("Enter a valid job reference (maximum 80 characters).");
  }
  if (!input.garment.trim() || input.garment.length > 60) {
    issues.push("Select a garment type.");
  }

  for (const id of Object.keys(input.answers)) {
    if (!CHECK_IDS.has(id)) issues.push("Unknown QC check: " + id.slice(0, 60));
  }
  for (const check of FINISHED_GARMENT_QC_CHECKS) {
    const answer = input.answers[check.id] ?? "not_checked";
    if (!VALID_ANSWERS.has(answer)) {
      issues.push(check.label + ": invalid inspection response.");
    } else if (answer === "fail") {
      completedChecks += 1;
      hasDefect = true;
      issues.push(check.label + ": inspection failed.");
    } else if (answer === "pass") {
      completedChecks += 1;
    } else {
      issues.push(check.label + ": not inspected.");
    }
  }

  const measurementResults: FinishedGarmentQcAssessment["measurementResults"] = [];
  const usedLabels = new Set<string>();
  if (!Array.isArray(input.measurements) || input.measurements.length === 0) {
    issues.push("Record at least one dimension against its approved job specification.");
  } else {
    for (const row of input.measurements) {
      const label = typeof row?.label === "string" ? row.label.trim() : "";
      const normalized = label.toLowerCase();
      if (!label || label.length > 60 || usedLabels.has(normalized)) {
        issues.push("Every measurement must have a unique label (maximum 60 characters).");
      } else {
        usedLabels.add(normalized);
      }
      const complete = validDimension(row?.expectedMm) &&
        validDimension(row?.actualMm) &&
        validTolerance(row?.toleranceMm);
      if (!complete) {
        issues.push((label || "Unnamed measurement") + ": supply approved, actual and allowed deviation in mm.");
        measurementResults.push({ label, differenceMm: null, withinTolerance: null });
        continue;
      }
      const differenceMm = Math.round(Math.abs(row.actualMm! - row.expectedMm!) * 1000) / 1000;
      const withinTolerance = differenceMm <= row.toleranceMm! + 1e-9;
      measurementResults.push({ label, differenceMm, withinTolerance });
      if (!withinTolerance) {
        hasDefect = true;
        issues.push(label + ": measured deviation exceeds the supplied tolerance.");
      }
    }
  }

  return {
    status: hasDefect ? "hold" : issues.length > 0 ? "incomplete" : "ready_for_review",
    completedChecks,
    totalChecks: FINISHED_GARMENT_QC_CHECKS.length,
    issues,
    measurementResults,
  };
}

/** Printable, unsaved operator draft: excludes claims of dispatch or final approval. */
export function buildFinishedGarmentQcReport(input: FinishedGarmentQcDraft): string {
  const assessment = assessFinishedGarmentQc(input);
  const safe = (value: string) => value.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").trim().slice(0, 80);
  const lines = [
    "LINEN EARTH - FINISHED GARMENT QC - UNSAVED DRAFT",
    "Job reference: " + safe(input.jobReference),
    "Garment: " + safe(input.garment),
    "Review state: " + assessment.status.toUpperCase().replace(/_/g, " "),
    "",
    "INSPECTION CHECKS",
  ];
  for (const check of FINISHED_GARMENT_QC_CHECKS) {
    lines.push(check.label + ": " + (input.answers[check.id] ?? "not_checked"));
  }
  lines.push("", "DIMENSION CHECKS (mm)");
  for (const row of input.measurements) {
    const result = assessment.measurementResults.find((entry) => entry.label === row.label.trim());
    lines.push(safe(row.label) + ": approved " + String(row.expectedMm ?? "-") +
      ", measured " + String(row.actualMm ?? "-") +
      ", allowed +/- " + String(row.toleranceMm ?? "-") +
      ", deviation " + String(result?.differenceMm ?? "-") +
      ", result " + (result?.withinTolerance === true ? "within tolerance" :
        result?.withinTolerance === false ? "outside tolerance" : "not verified"));
  }
  lines.push("", "OUTSTANDING ISSUES");
  lines.push(...(assessment.issues.length ? assessment.issues : ["None in this draft; requires independent human approval."]));
  lines.push("", "NOT A DISPATCH RELEASE. NO SERVER RECORD OR TAILOR SIGN-OFF HAS BEEN CREATED.");
  return lines.join("\n");
}
