import type { DesignerBrief } from "@/lib/designer-types";

export type DirectionTier = "Safe" | "Elevated" | "Statement";
export type ScoreBreakdown = { fabric: number; climate: number; occasion: number; aesthetic: number; coherence: number; originality: number; total: number };
export type DesignCandidate = {
  id: string;
  tier: DirectionTier;
  name: string;
  concept: string;
  aesthetic: string;
  fabricUse: string;
  garments: { shirt: string; trouser: string; layer: string; footwear: string };
  palette: string[];
  reasons: string[];
  tradeoff: string;
  scores: ScoreBreakdown;
};

function clamp(n: number) { return Math.max(0, Math.min(100, Math.round(n))); }
function avg(values: number[]) { return clamp(values.reduce((a, b) => a + b, 0) / values.length); }

function fabricFamily(brief: DesignerBrief) {
  return brief.fabric.materialOverride || brief.fabric.profile.observations.find((x) => x.label === "Likely material family")?.value || "Unknown fabric";
}

function dominantColor(brief: DesignerBrief) {
  return brief.fabric.profile.observations.find((x) => x.label === "Dominant color")?.value || "Fabric-led neutral";
}

function score(brief: DesignerBrief, tier: DirectionTier, climateFit: number, occasionFit: number, aestheticFit: number, coherence: number): ScoreBreakdown {
  const confidence = brief.fabric.profile.observations.reduce((s, x) => s + x.confidence, 0) / Math.max(1, brief.fabric.profile.observations.length);
  const fabric = clamp(78 + confidence * 17);
  const originality = tier === "Safe" ? 70 : tier === "Elevated" ? 88 : 94;
  const total = avg([fabric * 1.1, climateFit * 1.15, occasionFit * 1.2, aestheticFit, coherence * 1.15, originality * .75]);
  return { fabric, climate: climateFit, occasion: occasionFit, aesthetic: aestheticFit, coherence, originality, total };
}

export function generateDesignerDirections(brief: DesignerBrief): DesignCandidate[] {
  const c = brief.context;
  const family = fabricFamily(brief).toLowerCase();
  const color = dominantColor(brief);
  const hot = c.environment.toLowerCase().includes("hot") || c.environment.toLowerCase().includes("outdoor") || c.venue.toLowerCase().includes("beach") || c.venue.toLowerCase().includes("garden");
  const formal = c.formality === "Formal" || c.formality.includes("Ceremonial") || (c.occasion === "Business" && c.venue.includes("boardroom"));
  const evening = c.time === "Evening" || c.time === "Late night";
  const resort = c.occasion.includes("Resort") || c.venue.includes("Beach");
  const festive = c.occasion.includes("Festive");
  const linenLike = family.includes("linen");
  const woolLike = family.includes("wool");
  const cottonLike = family.includes("cotton");

  const anchor = woolLike ? "tailored jacket or trouser" : linenLike ? (formal ? "soft tailoring" : "shirt or trouser") : cottonLike ? "shirt or trouser" : "hero garment";
  const basePalette = brief.fabric.profile.palette.length ? brief.fabric.profile.palette.slice(0, 3) : ["#d8d0c0", "#16233a", "#746656"];

  const safe: DesignCandidate = {
    id: "DIR-SAFE-01", tier: "Safe", name: formal ? "The Modern Classic" : resort ? "Coastal Ease" : "Quiet Foundation",
    concept: formal ? "A clean, familiar tailoring line with the fabric used where it can look most credible." : "A restrained combination that lets the fabric lead without over-styling it.",
    aesthetic: c.aesthetic === "British-Inspired" ? "British-Inspired" : "Modern Classic", fabricUse: `Use uploaded ${color} fabric as the ${anchor}.`,
    garments: {
      shirt: formal ? "Spread-Collar Dress Shirt" : resort ? "Camp-Collar Shirt" : "Oxford Button-Down Shirt",
      trouser: formal ? "Flat-Front Tailored Trouser" : resort ? "Drawstring Linen Trouser" : "Flat-Front Tailored Trouser",
      layer: formal ? "Soft Single-Breasted Blazer" : c.formality === "Relaxed" ? "No jacket" : "Soft Single-Breasted Blazer",
      footwear: formal ? "Dark brown leather loafer / oxford" : resort ? "Suede loafer" : "Minimal leather loafer"
    }, palette: basePalette,
    reasons: [formal ? "Keeps the silhouette appropriate to the requested formality." : "Uses a familiar silhouette so the fabric remains the visual anchor.", hot ? "Avoids unnecessary structure for the warmer/outdoor setting." : "Allows enough structure for the setting without becoming ceremonial.", `Aligned with the requested ${c.fit.toLowerCase()} silhouette.`],
    tradeoff: "The most dependable direction; it intentionally sacrifices some novelty.",
    scores: score(brief, "Safe", hot ? 94 : 89, 94, c.aesthetic === "Modern Classic" ? 96 : 86, 93)
  };

  const elevatedLayer = formal || evening ? "Soft Single-Breasted Blazer" : resort ? "Unstructured overshirt / soft jacket" : "Soft Single-Breasted Blazer";
  const elevated: DesignCandidate = {
    id: "DIR-ELEVATED-01", tier: "Elevated", name: resort ? "Riviera Tailoring" : festive ? "Modern Ceremony" : "The Considered Line",
    concept: "The recommended LLinen Earth balance: stronger proportion and material contrast without turning the outfit into a statement piece.",
    aesthetic: c.aesthetic === "Minimal" ? "Quiet Luxury" : c.aesthetic,
    fabricUse: `Make the ${anchor} the hero; pair it with quieter supporting materials.`,
    garments: {
      shirt: festive ? "Band-Collar Shirt" : resort ? "Camp-Collar Shirt" : "Spread-Collar Dress Shirt",
      trouser: "Tailored Pleated Trouser",
      layer: elevatedLayer,
      footwear: hot ? "Unlined suede loafer" : "Dark brown suede / leather loafer"
    }, palette: [...basePalette, hot ? "#e8e0d2" : "#17243a"].slice(0, 4),
    reasons: ["Pleated trousers add controlled volume and a more designer-led proportion.", hot ? "Soft construction protects breathability and keeps the outfit visually light." : "Material contrast adds depth without relying on loud color.", `The direction preserves ${c.impression.toLowerCase()} while pushing beyond the safest option.`],
    tradeoff: "Slightly more fashion-forward proportion than a conventional tailored look.",
    scores: score(brief, "Elevated", hot ? 96 : 92, 95, 96, 96)
  };

  const statementFormalLayer = hot ? "Soft Single-Breasted Blazer" : "Structured Double-Breasted Blazer";
  const statement: DesignCandidate = {
    id: "DIR-STATEMENT-01", tier: "Statement", name: festive ? "Contemporary Heritage" : evening ? "After Dark" : "New Proportion",
    concept: "A controlled statement built through silhouette and styling rather than excessive decoration.",
    aesthetic: festive ? "Contemporary Indian" : c.aesthetic === "Quiet Luxury" ? "Italian-Inspired" : c.aesthetic,
    fabricUse: `Use the uploaded fabric as a decisive ${woolLike ? "tailoring" : linenLike ? "textural" : "color"} signal, not on every garment.`,
    garments: {
      shirt: festive ? "Band-Collar Shirt" : formal ? "Spread-Collar Dress Shirt" : "Camp-Collar Shirt",
      trouser: "Wide-Leg Trouser",
      layer: formal || evening ? statementFormalLayer : "Soft Single-Breasted Blazer",
      footwear: formal ? "Sleek black or deep brown leather" : "Dark suede loafer"
    }, palette: [...basePalette, "#0a0f18"].slice(0, 4),
    reasons: ["The wider trouser changes the visual proportion enough to feel intentional and current.", hot ? "Structure is reduced because the environment is a hard constraint." : "A stronger jacket silhouette is viable because the setting can support it.", "The uploaded fabric remains the hero while the rest of the look stays disciplined."],
    tradeoff: "The strongest silhouette; best for someone comfortable being visibly more directional.",
    scores: score(brief, "Statement", hot ? 86 : 91, formal && hot ? 87 : 92, 91, 88)
  };

  const candidates = [safe, elevated, statement];
  if (formal && hot) {
    statement.scores.occasion = clamp(statement.scores.occasion - 3);
    statement.tradeoff = "Formal outdoor heat limits how structured the statement can become; the jacket stays deliberately softer.";
    statement.scores.total = avg([statement.scores.fabric, statement.scores.climate, statement.scores.occasion, statement.scores.aesthetic, statement.scores.coherence, statement.scores.originality]);
  }
  return candidates.sort((a, b) => (a.tier === "Elevated" ? -1 : b.tier === "Elevated" ? 1 : b.scores.total - a.scores.total));
}
