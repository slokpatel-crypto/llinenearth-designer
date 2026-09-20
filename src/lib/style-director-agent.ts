import { FABRIC_STOCK, fabricProfileFromStock, type FabricColorway } from "@/lib/fabric-stock";
import { generateDesignerDirections, type DesignCandidate } from "@/lib/designer-engine";
import { finalizeVersion, initialVersion, type DesignVersion } from "@/lib/refinement-engine";
import type { ContextProfile, DesignerBrief } from "@/lib/designer-types";

export type StyleDirectorAnswers = {
  occasion: "Wedding" | "Work" | "Date" | "Celebration" | "Travel" | "Everyday";
  mood: "Quiet" | "Sharp" | "Relaxed" | "Statement";
  time: "Day" | "Evening";
  climate: "Hot" | "Indoor" | "Mixed";
  garment: "shirt" | "trouser" | "suit" | "blazer";
  colorDirection: "Light" | "Earthy" | "Blue" | "Dark" | "Surprise me";
};

export type StyleDirectorLook = {
  id: string;
  title: string;
  strapline: string;
  fabric: FabricColorway;
  candidate: DesignCandidate;
  brief: DesignerBrief;
  version: DesignVersion;
  why: string[];
};

function contextFromAnswers(a: StyleDirectorAnswers): ContextProfile {
  const occasionMap: Record<StyleDirectorAnswers["occasion"], string> = {
    Wedding: "Wedding / Reception",
    Work: "Business",
    Date: "Dinner / Social",
    Celebration: "Festive / Celebration",
    Travel: "Resort / Travel",
    Everyday: "Smart Casual",
  };
  const venue = a.occasion === "Wedding" ? "Hotel / Banquet"
    : a.occasion === "Travel" ? "Resort / Outdoor"
    : a.occasion === "Work" ? "Office / Boardroom"
    : a.occasion === "Date" ? "Restaurant / City"
    : "Indoor / City";
  const formality = a.mood === "Relaxed" ? "Relaxed"
    : a.occasion === "Wedding" || a.occasion === "Work" ? "Formal"
    : "Smart";
  const aesthetic = a.mood === "Quiet" ? "Quiet Luxury"
    : a.mood === "Sharp" ? "Modern Classic"
    : a.mood === "Statement" ? "Italian-Inspired"
    : "Minimal";
  return {
    occasion: occasionMap[a.occasion],
    venue,
    time: a.time,
    environment: a.climate === "Hot" ? "Hot / Outdoor"
      : a.climate === "Indoor" ? "Air-conditioned / Indoor"
      : "Mixed climate",
    formality,
    impression: a.mood === "Statement" ? "Memorable and directional"
      : a.mood === "Sharp" ? "Polished and confident"
      : a.mood === "Quiet" ? "Understated and expensive"
      : "Easy and approachable",
    fit: a.mood === "Relaxed" ? "Relaxed tailored" : "Tailored",
    aesthetic,
  };
}

function colorScore(fabric: FabricColorway, direction: StyleDirectorAnswers["colorDirection"]) {
  const name = fabric.colorName.toLowerCase();
  const hex = fabric.hex.replace("#", "");
  const r = Number.parseInt(hex.slice(0,2),16);
  const g = Number.parseInt(hex.slice(2,4),16);
  const b = Number.parseInt(hex.slice(4,6),16);
  const lightness = (Math.max(r,g,b) + Math.min(r,g,b)) / 2;
  if (direction === "Surprise me") return 10;
  if (direction === "Light") return lightness > 155 ? 32 : 0;
  if (direction === "Dark") return lightness < 120 ? 32 : 0;
  if (direction === "Blue") return /blue|slate|chambray|sky|denim/.test(name) ? 38 : b > r + 10 ? 18 : 0;
  return /beige|taupe|cream|khakhi|brown|oak|sand|jute|saffron/.test(name) ? 38 : (r > b && g > b ? 10 : 0);
}

function rankFabric(a: StyleDirectorAnswers, fabric: FabricColorway) {
  let score = 0;
  if (fabric.suitableFor.includes(a.garment)) score += 100;
  score += colorScore(fabric, a.colorDirection);
  if (a.occasion === "Wedding" && /suiting|formal/i.test(fabric.line)) score += 24;
  if (a.occasion === "Travel" && /plain|print/i.test(fabric.line)) score += 16;
  if (a.mood === "Statement" && /print|orchid|rose|pink|maroon/i.test(`${fabric.line} ${fabric.colorName}`)) score += 20;
  if (a.mood === "Quiet" && /plain|cream|taupe|grey|gray|beige/i.test(`${fabric.line} ${fabric.colorName}`)) score += 18;
  if (a.time === "Evening" && /dark|charcoal|black|maroon|slate/i.test(fabric.colorName)) score += 16;
  return score;
}

function chooseFabrics(a: StyleDirectorAnswers) {
  const eligible = FABRIC_STOCK.filter((f) => f.inStock && f.suitableFor.includes(a.garment));
  return [...eligible].sort((x,y) => rankFabric(a,y) - rankFabric(a,x)).slice(0,3);
}

function nameFor(index: number, candidate: DesignCandidate) {
  const labels = ["Director's Pick", "Easy Win", "Push It"];
  return `${labels[index] || candidate.tier} · ${candidate.name}`;
}

export function createStyleDirectorLooks(answers: StyleDirectorAnswers): StyleDirectorLook[] {
  const context = contextFromAnswers(answers);
  return chooseFabrics(answers).map((fabric, index) => {
    const brief: DesignerBrief = {
      fabric: {
        profile: fabricProfileFromStock(fabric),
        source: "stock",
        stockId: fabric.id,
        swatchImageUrl: fabric.swatchImageUrl,
        materialOverride: fabric.family,
        toneOverride: fabric.colorName,
      },
      context,
    };
    const candidates = generateDesignerDirections(brief);
    const candidate = candidates[Math.min(index, candidates.length - 1)] ?? candidates[0];
    const version = finalizeVersion(initialVersion(candidate));
    return {
      id: `${fabric.id}-${candidate.id}`,
      title: nameFor(index, candidate),
      strapline: index === 0 ? "Best balance of fabric, occasion and personality."
        : index === 1 ? "The safest way to look considered without trying too hard."
        : "The option with more visual energy and attitude.",
      fabric,
      candidate,
      brief,
      version,
      why: [
        `${fabric.colorName} ${fabric.line} fits the direction you chose.`,
        candidate.reasons[0] || "The fabric and silhouette support the occasion.",
        candidate.tradeoff,
      ],
    };
  });
}
