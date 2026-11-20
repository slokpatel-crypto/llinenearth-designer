import { evaluateDesignerCombo, type OccasionTier } from "./engine.ts";
import type { StyleDirectorRealModelSpec } from "../style-director-agent.ts";
import { validateStyleSpecV2 } from "./style-spec-v2.ts";

export const STYLE_DIRECTOR_VERSATILITY_OCCASIONS = [
  { occasion: "Casual", label: "Relaxed days", description: "Low-key, informal styling" },
  { occasion: "Smart-Casual", label: "Smart casual", description: "Social plans and elevated everyday looks" },
  { occasion: "Semi-Formal", label: "Semi-formal", description: "Polished gatherings and dressier events" },
  { occasion: "Formal", label: "Formal", description: "Strictly tailored dress-code direction" },
] as const satisfies readonly { occasion: OccasionTier; label: string; description: string }[];

export type StyleDirectorVersatilityRow = {
  occasion: OccasionTier;
  label: string;
  description: string;
  /** Style-engine score only; not a physical garment or dress-code certification. */
  stylingSignal: number | null;
  confidenceSignal: number | null;
  occasionBandMatch: boolean | null;
  state: "preliminary" | "review_required";
  reason: string;
  reviewItems: string[];
  evidenceNote: string;
};

/**
 * Re-check exactly the same canonical recipe, both fabrics and climate
 * against four existing occasion bands. No outfit modifications, inventory
 * assumptions, physical-fit or comfort claims.
 */
export function evaluateStyleDirectorVersatility(
  source: StyleDirectorRealModelSpec,
): StyleDirectorVersatilityRow[] {
  if (!validateStyleSpecV2(source.styleSpec)
    || source.shirtId !== source.shirtFabric.id
    || source.pantId !== source.pantFabric.id) return [];

  return STYLE_DIRECTOR_VERSATILITY_OCCASIONS.map((item) => {
    const decision = evaluateDesignerCombo(
      source.shirtFabric, source.pantFabric, item.occasion, source.style,
      undefined, { climate: source.climate, intention: source.intention }, source.styleSpec,
    );
    const flags = decision.rules
      .filter(rule => rule.status === "flag" && ["High", "Medium"].includes(rule.severity))
      .map(rule => rule.explanation);
    const hasHardConflict = decision.rules.some(rule=>rule.status==="flag" && rule.severity==="High");
    const uncertain = decision.status==="needs_review" || hasHardConflict || decision.formality.match!==true;
    const stylingSignal = Number.isFinite(decision.designFitScore)
      && decision.designFitScore>=0 && decision.designFitScore<=100 ? decision.designFitScore : null;
    const confidenceSignal = Number.isFinite(decision.confidenceScore)
      && decision.confidenceScore>=0 && decision.confidenceScore<=100 ? decision.confidenceScore : null;
    return {
      occasion: item.occasion,
      label: item.label,
      description: item.description,
      stylingSignal,
      confidenceSignal,
      occasionBandMatch: decision.formality.match,
      state: uncertain ? "review_required" : "preliminary",
      reason: decision.shortReason,
      reviewItems: flags.slice(0, 3),
      evidenceNote: "Provisional style-engine direction only. Physical fabric, stock, measured comfort, fit and tailor acceptance are not established.",
    };
  });
}
