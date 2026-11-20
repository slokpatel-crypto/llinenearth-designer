import type { FabricColorway } from "../fabric-stock.ts";
import type { StyleDirectorLook, StyleDirectorRealModelSpec } from "../style-director-agent.ts";
import { designerFabricFromStock, evaluateDesignerCombo } from "./engine.ts";

export type StyleDirectorPairingAlternative = {
  id: string;
  shirtId: string;
  pantId: string;
  supportingRole: "shirt" | "pant";
  supportingFabricName: string;
  supportingFabricLine: string;
  /** Existing deterministic style assessment, not verified physical fit. */
  status: "preliminary" | "needs_review";
  designFitScore: number;
  confidenceScore: number;
  reviewNote: string;
  realModel: StyleDirectorRealModelSpec;
};

const HARD_FLAGS = new Set(["High"]);
const MAX_CANDIDATES = 3;

/**
 * Keeps the chosen hero fabric and original StyleSpec v2 recipe exactly intact.
 * Uses the shared deterministic pairing/garment evaluator; never invents a new
 * garment option, stock verification, measurements or a garment render.
 *
 * The caller must supply a fresh server-side, stock-availability-filtered
 * catalogue. Duplicate or ineligible IDs are denied, not guessed.
 */
export function createStyleDirectorPairingAlternatives(
  look: StyleDirectorLook,
  stock: readonly FabricColorway[],
): StyleDirectorPairingAlternative[] {
  const base = look.realModel;
  if (!base || !look.fabric) return [];
  const heroRole = look.fabric.id === base.shirtId ? "shirt"
    : look.fabric.id === base.pantId ? "trouser" : null;
  if (!heroRole) return [];

  const eligible = stock.filter((fabric) => fabric.inStock === true
    && fabric.suitableFor.includes(heroRole === "shirt" ? "shirt" : "trouser"));
  const heroEntries = eligible.filter((fabric) => fabric.id === look.fabric.id);
  if (heroEntries.length !== 1) return [];

  const secondaryRole = heroRole === "shirt" ? "trouser" : "shirt";
  const currentSecondary = heroRole === "shirt" ? base.pantId : base.shirtId;
  const counts = new Map<string,number>();
  const supporting = stock.filter((fabric) => {
    if (!fabric.inStock || !fabric.suitableFor.includes(secondaryRole)) return false;
    counts.set(fabric.id, (counts.get(fabric.id) || 0) + 1);
    return true;
  });
  const hero = designerFabricFromStock(heroEntries[0]);
  const options = supporting.filter((fabric) => fabric.id !== currentSecondary && counts.get(fabric.id) === 1);

  const scored = options.flatMap((fabric) => {
    const secondary = designerFabricFromStock(fabric);
    const shirt = heroRole === "shirt" ? hero : secondary;
    const pant = heroRole === "shirt" ? secondary : hero;
    const pairing = evaluateDesignerCombo(shirt, pant, base.occasion, base.style,
      undefined, { climate:base.climate, intention:base.intention }, base.styleSpec);
    const flaggedHigh = pairing.rules.filter((rule) => rule.status === "flag" && HARD_FLAGS.has(rule.severity)).length;
    // A construction conflict is not an optional customer-facing pairing.
    if (flaggedHigh > 0) return [];
    if (!Number.isFinite(pairing.designFitScore) || !Number.isFinite(pairing.confidenceScore)) return [];
    const score = pairing.designFitScore + pairing.confidenceScore * .35
      - pairing.rules.filter((rule) => rule.status === "flag" && rule.severity === "Medium").length * 12
      - (pairing.status === "needs_review" ? 8 : 0);
    return [{
      fabric, score,
      preview: {
        ...base,
        shirtId: shirt.id, shirtName: shirt.name, shirtFabric: shirt,
        pantId: pant.id, pantName: pant.name, pantFabric: pant,
        reason: pairing.shortReason,
        status: pairing.status,
        confidenceScore: pairing.confidenceScore,
        designFitScore: pairing.designFitScore,
      } as StyleDirectorRealModelSpec,
    }];
  }).sort((a,b) => b.score - a.score || a.fabric.id.localeCompare(b.fabric.id));

  return scored.slice(0,MAX_CANDIDATES).map(({fabric,preview})=>({
    id: `${look.id}:${secondaryRole}:${fabric.id}`,
    shirtId: preview.shirtId, pantId: preview.pantId,
    supportingRole: secondaryRole === "trouser" ? "pant" : "shirt",
    supportingFabricName: fabric.colorName,
    supportingFabricLine: fabric.line,
    status: preview.status,
    designFitScore: preview.designFitScore,
    confidenceScore: preview.confidenceScore,
    reviewNote: preview.status === "needs_review"
      ? "Styling requires human review; physical fabric, availability and tailoring remain unverified."
      : "Preliminary styling only. Confirm actual stock, colour and tailor fit before ordering.",
    realModel: preview,
  }));
}
