import {
  evaluateDesignerCombo, type DesignerContext, type DesignerFabric, type DesignerRecommendation,
  type DesignerStyle, type DesignerStyleOverrides, type OccasionTier,
} from "@/lib/designer/engine";
import type { MeasurementProfile } from "@/lib/measurements";
import type { TailorObservationProfile } from "@/lib/designer/tailor-observations";
import { assessFitConstruction, type FitConstructionAssessment } from "@/lib/designer/fit-construction";
import { assessBlockStrategy, type DesignerBlockStrategy } from "@/lib/designer/block-strategy";
import { evaluateLinenEarthBrandLanguage, type BrandLanguageEvaluation } from "@/lib/designer/brand-language";

export type DesignerDirection = {
  id: "selected" | "clean" | "heritage" | "movement";
  name: string;
  proposition: string;
  changes: string[];
  recommendation: DesignerRecommendation;
  fitConstruction?: FitConstructionAssessment;
  brandLanguage?: BrandLanguageEvaluation;
  blockStrategy?: DesignerBlockStrategy;
};

type Candidate = Omit<DesignerDirection, "changes" | "recommendation"> & { patch: DesignerStyleOverrides };

function alternatives(occasion: OccasionTier): Candidate[] {
  const formal = occasion === "Formal";
  const relaxed = occasion === "Casual" || occasion === "Smart-Casual";
  return [
    {
      id: "clean", name: "Clean line", proposition: "A quieter outline with a flat front and restrained shirt details.",
      patch: {
        collar: formal ? "Spread Collar" : "Point (Standard) Collar", collarFinish: "Self-fabric", cuff: formal ? "French / Double Cuff" : "Barrel Cuff (2-button)",
        shirtWear: "Tucked",
        shirtFit: "Regular / Classic Fit", trouser: "Formal Trouser (Flat-front)",
        rise: formal ? "High Rise" : "Mid Rise", waistband: "Side-Adjuster Tabs", break: "Slight Break",
      },
    },
    {
      id: "heritage", name: "Tailored ease", proposition: "A pleat adds room through the upper leg while keeping a tailored finish.",
      patch: {
        collar: formal ? "Spread Collar" : "Point (Standard) Collar", collarFinish: "Self-fabric", cuff: formal ? "French / Double Cuff" : "Barrel Cuff (2-button)",
        shirtWear: "Tucked",
        shirtFit: "Regular / Classic Fit", trouser: "Pleated Trouser", rise: "Mid Rise",
        waistband: "Side-Adjuster Tabs", break: "Slight Break",
      },
    },
    {
      id: "movement", name: "Relaxed proportion", proposition: "A fuller leg and a softer shirt shape make the silhouette more expressive.",
      patch: {
        collar: relaxed ? "Button-Down Collar" : "Point (Standard) Collar", collarFinish: "Self-fabric", cuff: "Barrel Cuff (1-button)",
        shirtWear: relaxed ? "Untucked" : "Tucked",
        shirtFit: "Relaxed Fit", trouser: "Wide-leg / Relaxed Drape Trouser", rise: "Mid Rise",
        waistband: "Belt Loops", break: "No Break",
      },
    },
  ];
}

/** The requested outfit always remains first. Other directions change only its cut. */
export function planDesignerDirections(
  shirt: DesignerFabric, pant: DesignerFabric, occasion: OccasionTier,
  chosen: DesignerStyle, context: DesignerContext, measurements?: MeasurementProfile | null, observations?: TailorObservationProfile | null,
): DesignerDirection[] {
  const selected = evaluateDesignerCombo(shirt, pant, occasion, chosen, undefined, context);
  const selectedFit = measurements ? assessFitConstruction(measurements, selected.style, { climate: context.climate, shirtFabric: shirt, trouserFabric: pant, observations }) : undefined;
  const selectedBrand = evaluateLinenEarthBrandLanguage(shirt,pant,selected.style,occasion,context);
  const selectedBlock = measurements ? assessBlockStrategy(measurements, selected.style, observations) : undefined;
  const directions: DesignerDirection[] = [{
    id: "selected", name: "Your direction", proposition: "The cloth and cut you chose, assessed together.",
    changes: [], recommendation: selected, fitConstruction: selectedFit, brandLanguage:selectedBrand, blockStrategy:selectedBlock,
  }];
  const seen = new Set([JSON.stringify(selected.style)]);
  const candidates = alternatives(occasion).map((candidate) => {
    const style = { ...chosen, ...candidate.patch };
    const recommendation = evaluateDesignerCombo(shirt, pant, occasion, style, undefined, context);
    const fitConstruction = measurements ? assessFitConstruction(measurements, recommendation.style, { climate: context.climate, shirtFabric: shirt, trouserFabric: pant, observations }) : undefined;
    const brandLanguage = evaluateLinenEarthBrandLanguage(shirt,pant,recommendation.style,occasion,context);
    const blockStrategy = measurements ? assessBlockStrategy(measurements, recommendation.style, observations) : undefined;
    const changes = (Object.keys(style) as Array<keyof DesignerStyle>)
      .filter((key) => chosen[key] !== style[key]).map((key) => `${key}: ${style[key]}`);
    return { ...candidate, changes, recommendation, fitConstruction, brandLanguage, blockStrategy };
  }).filter((candidate) => {
    const key = JSON.stringify(candidate.recommendation.style);
    if (!candidate.changes.length || seen.has(key)) return false;
    seen.add(key);
    // Do not present a deliberately broken cut or an out-of-band look as a suggestion.
    return candidate.recommendation.formality.match !== false
      && !candidate.recommendation.rules.some((item) => item.status === "flag" && item.severity === "High");
  });
  const priority = context.intention === "Expressive" ? ["movement", "heritage", "clean"]
    : context.intention === "Understated" ? ["clean", "heritage", "movement"] : ["heritage", "clean", "movement"];
  candidates.sort((a, b) => {
    const score = (item: typeof a) => item.recommendation.designFitScore * .50 + (item.fitConstruction?.fitScore ?? 70) * .25 + (item.blockStrategy?.score ?? 70) * .15 + (item.brandLanguage?.score ?? 70) * .10;
    return score(b) - score(a) || priority.indexOf(a.id) - priority.indexOf(b.id);
  });
  return [...directions, ...candidates.slice(0, 2).map(({ id, name, proposition, changes, recommendation, fitConstruction, brandLanguage, blockStrategy }) =>
    ({ id, name, proposition, changes, recommendation, fitConstruction, brandLanguage, blockStrategy }))];
}

export type DesignerRepair = { label: string; patch?: DesignerStyleOverrides };

/** Suggest the smallest supported change; unresolved material conflicts require a stylist. */
export function suggestDesignerRepairs(recommendation: DesignerRecommendation): DesignerRepair[] {
  const flagged = (id: string) => recommendation.rules.some((item) => item.id === id && item.status === "flag");
  const repairs: DesignerRepair[] = [];
  if (flagged("CUT-CUFF")) repairs.push({ label: "Pair the French cuff with a spread collar.", patch: { collar: "Spread Collar" } });
  if (flagged("CUT-HEM")) repairs.push({ label: "Give the cropped trouser a matching above-ankle hem.", patch: { break: "Cropped / Above-ankle" } });
  if (flagged("CUT-WAIST")) repairs.push({ label: "Use side adjusters for a cleaner formal waistband.", patch: { waistband: "Side-Adjuster Tabs" } });
  if (flagged("CUT-TUCK")) repairs.push({ label: "Tuck the shirt for a clean formal waistline.", patch: { shirtWear: "Tucked" } });
  if (flagged("CR-4")) repairs.push({ label: "Try a solid or fine motif in one garment; confirm the substitute cloth in store." });
  if (flagged("FORMAL-PRINT")) repairs.push({ label: "Compare a quieter physical shirting or trouser swatch for this formal event." });
  if (flagged("CONTEXT-CLIMATE")) repairs.push({ label: "Check another verified fabric with comfort tags for this climate." });
  if (flagged("CR-2")) repairs.push({ label: "Compare both colours together under the shop lighting before approving the contrast." });
  return repairs;
}
