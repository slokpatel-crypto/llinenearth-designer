import type { DesignerBrief } from "@/lib/designer-types";
import { fabricNameFromBrief, judgeFabricForBrief, type FabricJudgement, type WearFamily } from "@/lib/fashion-intelligence";

export type DirectionTier = "Safe" | "Elevated" | "Statement";
export type ScoreBreakdown = { fabric: number; climate: number; occasion: number; aesthetic: number; coherence: number; originality: number; total: number };
export type DesignCandidate = {
  id: string;
  tier: DirectionTier;
  name: string;
  concept: string;
  aesthetic: string;
  fabricUse: string;
  fabricJudgement: FabricJudgement;
  garments: { shirt: string; trouser: string; layer: string; footwear: string };
  palette: string[];
  reasons: string[];
  tradeoff: string;
  scores: ScoreBreakdown;
};

function clamp(n: number) { return Math.max(0, Math.min(100, Math.round(n))); }
function avg(values: number[]) { return clamp(values.reduce((a, b) => a + b, 0) / values.length); }

function fabricFamily(brief: DesignerBrief) { return fabricNameFromBrief(brief); }
function dominantColor(brief: DesignerBrief) { return brief.fabric.profile.observations.find((x) => x.label === "Dominant color")?.value || "Fabric-led neutral"; }

function score(brief: DesignerBrief, tier: DirectionTier, climateFit: number, occasionFit: number, aestheticFit: number, coherence: number, fabricFit: number): ScoreBreakdown {
  const confidence = brief.fabric.profile.observations.reduce((s, x) => s + x.confidence, 0) / Math.max(1, brief.fabric.profile.observations.length);
  const fabric = clamp(fabricFit * .84 + confidence * 16);
  const originality = tier === "Safe" ? 70 : tier === "Elevated" ? 88 : 94;
  const total = avg([fabric * 1.2, climateFit * 1.15, occasionFit * 1.2, aestheticFit, coherence * 1.15, originality * .75]);
  return { fabric, climate: climateFit, occasion: occasionFit, aesthetic: aestheticFit, coherence, originality, total };
}

function judgementFor(brief: DesignerBrief, role: WearFamily) { return judgeFabricForBrief(brief, role); }

export function generateDesignerDirections(brief: DesignerBrief): DesignCandidate[] {
  const c = brief.context;
  const family = fabricFamily(brief).toLowerCase();
  const color = dominantColor(brief);
  const hot = c.environment.toLowerCase().includes("hot") || c.environment.toLowerCase().includes("outdoor") || c.venue.toLowerCase().includes("beach") || c.venue.toLowerCase().includes("garden");
  const formal = c.formality === "Formal" || c.formality.includes("Ceremonial") || (c.occasion === "Business" && c.venue.toLowerCase().includes("boardroom"));
  const evening = c.time === "Evening" || c.time === "Late night";
  const resort = c.occasion.includes("Resort") || c.venue.includes("Beach");
  const festive = c.occasion.includes("Festive") || c.occasion.includes("Wedding");
  const linenLike = family.includes("linen");
  const woolLike = family.includes("wool");
  const cottonLike = family.includes("cotton");
  const trLike = family.includes("tr") || family.includes("poly") || family.includes("viscose") || family.includes("rayon");

  const safeRole: WearFamily = woolLike || trLike ? (formal ? "suit" : "trouser") : linenLike ? (resort ? "shirt" : "trouser") : cottonLike ? "shirt" : "trouser";
  const elevatedRole: WearFamily = woolLike || trLike ? (formal || evening ? "jacket" : "trouser") : linenLike ? (formal ? "jacket" : "trouser") : cottonLike ? "shirt" : safeRole;
  const statementRole: WearFamily = festive ? (woolLike || trLike ? "indian" : "jacket") : (woolLike || trLike ? "jacket" : linenLike ? "jacket" : safeRole);
  const safeJudge = judgementFor(brief, safeRole);
  const elevatedJudge = judgementFor(brief, elevatedRole);
  const statementJudge = judgementFor(brief, statementRole);

  const roleLabel: Record<WearFamily,string> = { shirt:"shirt",trouser:"trouser",jacket:"jacket / blazer",suit:"matching suit",indian:"Indian formal layer" };
  const basePalette = brief.fabric.profile.palette.length ? brief.fabric.profile.palette.slice(0, 3) : ["#d8d0c0", "#16233a", "#746656"];

  const safe: DesignCandidate = {
    id: "DIR-SAFE-01", tier: "Safe", name: formal ? "The Modern Classic" : resort ? "Coastal Ease" : "Quiet Foundation",
    concept: formal ? "A clean, familiar tailoring line with the uploaded fabric used only where its structure and formality are credible." : "A restrained combination that lets the fabric lead without forcing it into the wrong garment.",
    aesthetic: c.aesthetic === "British-Inspired" ? "British-Inspired" : "Modern Classic",
    fabricUse: `Use uploaded ${color} ${fabricFamily(brief)} primarily as the ${roleLabel[safeRole]}.`,
    fabricJudgement: safeJudge,
    garments: {
      shirt: formal ? "Spread-Collar Dress Shirt" : resort ? "Camp-Collar Shirt" : "Oxford Button-Down Shirt",
      trouser: formal ? "Flat-Front Tailored Trouser" : resort ? "Tailored Drawstring Trouser" : "Flat-Front Tailored Trouser",
      layer: formal ? "Soft Single-Breasted Blazer" : c.formality === "Relaxed" ? "No jacket" : "Soft Single-Breasted Blazer",
      footwear: formal ? "Dark brown leather loafer / oxford" : resort ? "Suede loafer" : "Minimal leather loafer"
    }, palette: basePalette,
    reasons: [safeJudge.reasons[0], formal ? "Keeps the silhouette appropriate to the requested formality." : "Uses a familiar silhouette so the fabric remains the visual anchor.", hot ? "Avoids unnecessary structure for the warmer/outdoor setting." : "Allows enough structure for the setting without becoming ceremonial."],
    tradeoff: safeJudge.verdict === "conditional" ? "The cloth can work, but construction must compensate for its climate/formality limits." : "The most dependable direction; it intentionally sacrifices some novelty.",
    scores: score(brief, "Safe", safeJudge.climateFit, safeJudge.occasionFit, c.aesthetic === "Modern Classic" ? 96 : 86, 93, safeJudge.overall)
  };

  const elevatedLayer = festive ? "Bandhgala / Jodhpuri Jacket" : formal || evening ? "Soft Single-Breasted Blazer" : resort ? "Tailored Overshirt" : "Soft Single-Breasted Blazer";
  const elevated: DesignCandidate = {
    id: "DIR-ELEVATED-01", tier: "Elevated", name: resort ? "Riviera Tailoring" : festive ? "Modern Ceremony" : "The Considered Line",
    concept: "The recommended LLinen Earth balance: the fabric is assigned to the garment role it can perform best, then proportion and supporting materials are built around it.",
    aesthetic: c.aesthetic === "Minimal" ? "Quiet Luxury" : c.aesthetic,
    fabricUse: `Use the uploaded fabric as the ${roleLabel[elevatedRole]}; support it with quieter materials instead of repeating it across the whole outfit.`,
    fabricJudgement: elevatedJudge,
    garments: {
      shirt: festive ? "Band-Collar Shirt" : resort ? "Camp-Collar Shirt" : "Spread-Collar Dress Shirt",
      trouser: "Single-Pleat Tailored Trouser",
      layer: elevatedLayer,
      footwear: hot ? "Unlined suede loafer" : "Dark brown suede / leather loafer"
    }, palette: [...basePalette, hot ? "#e8e0d2" : "#17243a"].slice(0, 4),
    reasons: [elevatedJudge.reasons[0], "Pleated trousers add controlled volume and a more designer-led proportion.", hot ? "Soft construction protects breathability and keeps the outfit visually light." : "Material contrast adds depth without relying on loud colour."],
    tradeoff: elevatedJudge.verdict === "avoid" ? "The uploaded fabric should not be forced into the hero garment; use it as a smaller supporting component or choose a better fabric." : "Slightly more fashion-forward proportion than a conventional tailored look.",
    scores: score(brief, "Elevated", elevatedJudge.climateFit, elevatedJudge.occasionFit, 96, 96, elevatedJudge.overall)
  };

  const statementFormalLayer = festive ? "Bandhgala / Jodhpuri Jacket" : hot ? "Soft Single-Breasted Blazer" : "Double-Breasted Blazer";
  const statement: DesignCandidate = {
    id: "DIR-STATEMENT-01", tier: "Statement", name: festive ? "Contemporary Heritage" : evening ? "After Dark" : "New Proportion",
    concept: "A controlled statement built through silhouette, fabric role and styling rather than excessive decoration.",
    aesthetic: festive ? "Contemporary Indian" : c.aesthetic === "Quiet Luxury" ? "Italian-Inspired" : c.aesthetic,
    fabricUse: `Use the uploaded fabric as a decisive ${roleLabel[statementRole]} signal, not automatically on every garment.`,
    fabricJudgement: statementJudge,
    garments: {
      shirt: festive ? "Band-Collar Shirt" : formal ? "Cutaway-Collar Dress Shirt" : "Camp-Collar Shirt",
      trouser: "Wide-Leg Trouser",
      layer: formal || evening || festive ? statementFormalLayer : "Soft Single-Breasted Blazer",
      footwear: formal ? "Sleek black or deep brown leather" : festive ? "Dark leather loafer / refined Indian slip-on" : "Dark suede loafer"
    }, palette: [...basePalette, "#0a0f18"].slice(0, 4),
    reasons: [statementJudge.reasons[0], "The wider trouser changes the visual proportion enough to feel intentional and current.", hot ? "Structure is reduced because climate is treated as a hard constraint." : "A stronger jacket silhouette is viable because the setting can support it."],
    tradeoff: statementJudge.verdict === "conditional" || statementJudge.verdict === "avoid" ? "This is visually strongest, but the uploaded cloth may need to move to a supporting role for technical credibility." : "The strongest silhouette; best for someone comfortable being visibly more directional.",
    scores: score(brief, "Statement", statementJudge.climateFit, statementJudge.occasionFit, 91, 88, statementJudge.overall)
  };

  const candidates = [safe, elevated, statement];
  if (formal && hot) {
    statement.scores.occasion = clamp(statement.scores.occasion - 3);
    statement.tradeoff = "Formal outdoor heat limits how structured the statement can become; the jacket stays deliberately softer.";
    statement.scores.total = avg([statement.scores.fabric, statement.scores.climate, statement.scores.occasion, statement.scores.aesthetic, statement.scores.coherence, statement.scores.originality]);
  }
  return candidates.sort((a, b) => (a.tier === "Elevated" ? -1 : b.tier === "Elevated" ? 1 : b.scores.total - a.scores.total));
}
