import { evaluateDesignerCombo, type DesignerStyle } from "./engine.ts";
import { optionById } from "./options/library.ts";
import { mergeLegacyIntoStyleSpec, validateStyleSpecV2 } from "./style-spec-v2.ts";
import type { StyleDirectorRealModelSpec } from "../style-director-agent.ts";

/**
 * These are existing canonical construction options, not proposed new cuts.
 * Keep unsupported advanced options in the full Designer Studio rather than
 * suggesting an unrenderable finish from the quick Style Director journey.
 */
export const STYLE_DIRECTOR_FINISH_GROUPS = [
  { key: "collar", label: "Collar", group: "shirt.collar" },
  { key: "cuff", label: "Cuff", group: "shirt.cuff" },
  { key: "placket", label: "Shirt front", group: "shirt.placket" },
  { key: "waistband", label: "Trouser waist", group: "pant.waistband" },
  { key: "break", label: "Trouser length", group: "pant.break" },
] as const;

export type StyleDirectorFinishKey = (typeof STYLE_DIRECTOR_FINISH_GROUPS)[number]["key"];

const CURATED_IDS: Record<StyleDirectorFinishKey, readonly string[]> = {
  collar: ["point_standard_collar", "spread_collar", "cutaway_collar", "button_down_collar", "mandarin_band_collar"],
  cuff: ["barrel_cuff_1_button", "barrel_cuff_2_button", "french_double_cuff", "rounded_soft_cuff"],
  placket: ["standard_visible_placket", "hidden_fly_front"],
  waistband: ["plain_clean_front", "belt_loops", "side_adjuster_tabs", "drawstring_elastic"],
  break: ["no_break", "slight_break", "full_break", "cropped_above_ankle"],
};

export type StyleDirectorFinishAlternative = {
  id: string;
  finishKey: StyleDirectorFinishKey;
  optionId: string;
  label: string;
  description: string;
  baseShirtId: string;
  basePantId: string;
  status: "preliminary" | "needs_review";
  designFitScore: number;
  confidenceScore: number;
  reviewNote: string;
  realModel: StyleDirectorRealModelSpec;
};

/**
 * Deterministic, one-detail-at-a-time tailoring adjustments. The existing
 * style option library and shared compatibility engine remain authoritative.
 *
 * Never change either fabric, never upgrade unverified stock/drape/fit evidence,
 * and never silently change a second construction field. Each suggested cut
 * must be reissued as a signed handoff on the server before Designer Studio.
 */
export function createStyleDirectorFinishAlternatives(
  base: StyleDirectorRealModelSpec,
  finishKey: StyleDirectorFinishKey,
): StyleDirectorFinishAlternative[] {
  const group = STYLE_DIRECTOR_FINISH_GROUPS.find((item) => item.key === finishKey);
  if (!group || !validateStyleSpecV2(base.styleSpec)) return [];

  const alternatives = CURATED_IDS[finishKey].flatMap((optionId) => {
    const option = optionById(optionId);
    if (!option || option.group !== group.group || !option.legacyLabel || option.legacySelectable === false
      || option.legacyLabel === base.style[finishKey]) return [];

    const style: DesignerStyle = { ...base.style, [finishKey]: option.legacyLabel };
    const spec = mergeLegacyIntoStyleSpec(base.styleSpec, style);
    if (!validateStyleSpecV2(spec)) return [];
    const expected = finishKey === "collar" ? spec.shirt.collar
      : finishKey === "cuff" ? spec.shirt.cuff
        : finishKey === "placket" ? spec.shirt.placket
          : finishKey === "waistband" ? spec.pant.waistband : spec.pant.break;
    if (expected !== optionId) return [];

    const assessment = evaluateDesignerCombo(
      base.shirtFabric, base.pantFabric, base.occasion, style,
      undefined, { climate: base.climate, intention: base.intention }, spec,
    );
    // These are customer suggestions, not a sandbox for knowingly conflicting
    // French cuffs, cropped hems, formal drawstrings or other High flags.
    if (assessment.rules.some((rule) => rule.status === "flag" && rule.severity === "High")) return [];
    if (!Number.isFinite(assessment.designFitScore) || !Number.isFinite(assessment.confidenceScore)) return [];
    const penalty = assessment.rules.filter((rule) => rule.status === "flag" && rule.severity === "Medium").length * 12;
    const score = assessment.designFitScore + assessment.confidenceScore * .35 - penalty;
    const realModel: StyleDirectorRealModelSpec = {
      ...base,
      style,
      styleSpec: spec,
      reason: assessment.shortReason,
      status: assessment.status,
      designFitScore: assessment.designFitScore,
      confidenceScore: assessment.confidenceScore,
    };
    const entry: StyleDirectorFinishAlternative & { score: number } = {
      id: `${finishKey}:${optionId}`,
      finishKey,
      optionId,
      label: option.label,
      description: option.description,
      baseShirtId: base.shirtId,
      basePantId: base.pantId,
      status: assessment.status,
      designFitScore: assessment.designFitScore,
      confidenceScore: assessment.confidenceScore,
      reviewNote: assessment.status === "needs_review"
        ? "Construction needs a human review; this is not a verified fit, comfort or tailoring approval."
        : "Preliminary construction suggestion. Confirm the fabric, fit and finish with the tailor before ordering.",
      realModel,
      score,
    };
    return [entry];
  });

  return alternatives.sort((a, b) => b.score - a.score || a.optionId.localeCompare(b.optionId))
    .slice(0, 3).map(({ score: _score, ...alternative }) => alternative);
}
