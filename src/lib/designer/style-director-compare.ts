import type { StyleDirectorLook } from "../style-director-agent.ts";

/**
 * Customer-facing, read-only look comparison. Scores already belong to the
 * deterministic Designer Engine; this module never invents fit, inventory,
 * physical cloth measurements or a new garment-option vocabulary.
 */
export const STYLE_DIRECTOR_COMPARE_LENSES = [
  { id: "overall", label: "Overall balance", key: "total", detail: "The existing engine's combined styling signal." },
  { id: "occasion", label: "Occasion", key: "occasion", detail: "How the concept is scored for the selected occasion." },
  { id: "climate", label: "Environment", key: "climate", detail: "The engine's provisional climate styling signal, not a tested comfort rating." },
  { id: "expression", label: "Expression", key: "originality", detail: "How directional the styling concept is, not a quality measure." },
] as const;

export type StyleDirectorCompareLens = (typeof STYLE_DIRECTOR_COMPARE_LENSES)[number]["id"];
type ScoreKey = (typeof STYLE_DIRECTOR_COMPARE_LENSES)[number]["key"];

export type StyleDirectorComparedLook = {
  sourceIndex: number;
  lookId: string;
  rank: number | null;
  /** Existing provisional fashion-engine score, never a physical/fit approval. */
  stylingSignal: number | null;
  state: "concept_only" | "preliminary" | "needs_review";
  reviewNote: string;
  tradeoff: string;
  rationale: string;
  fabric: { color: string; line: string; pattern: string };
  outfit: { shirt: string; pant: string } | null;
  /** Exact existing version-2 IDs; resolve labels through the shared option library. */
  construction: {
    shirtType: string; collar: string; cuff: string;
    pantType: string; waistband: string; pantBreak: string; wear: string;
  } | null;
};

function boundedScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value : null;
}

function scoreKey(lens: StyleDirectorCompareLens): ScoreKey {
  const selected = STYLE_DIRECTOR_COMPARE_LENSES.find((item) => item.id === lens);
  if (!selected) throw new Error("Choose a supported Style Director comparison lens.");
  return selected.key;
}

/**
 * Stable ranking by an explicitly chosen existing engine signal.
 * Ties share a rank, invalid/missing scores are unranked, input remains intact.
 */
export function compareStyleDirectorLooks(
  looks: readonly StyleDirectorLook[],
  lens: StyleDirectorCompareLens = "overall",
): StyleDirectorComparedLook[] {
  const key = scoreKey(lens);
  const ranked = looks.map((look, sourceIndex) => ({
    look,
    sourceIndex,
    score: boundedScore(look.candidate.scores[key]),
  })).sort((a, b) => {
    if (a.score === null) return b.score === null ? a.sourceIndex - b.sourceIndex : 1;
    if (b.score === null) return -1;
    return b.score - a.score || a.sourceIndex - b.sourceIndex;
  });

  let previousScore: number | null = null;
  let previousRank = 0;
  return ranked.map(({ look, sourceIndex, score }, index) => {
    const real = look.realModel;
    const state: StyleDirectorComparedLook["state"] = !real ? "concept_only"
      : real.status === "needs_review" ? "needs_review" : "preliminary";
    if (score !== null) {
      if (previousScore !== score) previousRank = index + 1;
      previousScore = score;
    }
    return {
      sourceIndex,
      lookId: look.id,
      rank: score === null ? null : previousRank,
      stylingSignal: score,
      state,
      reviewNote: state === "needs_review"
        ? "This pairing needs human construction review before it can be treated as buildable."
        : state === "concept_only"
          ? "This is a styling concept; a supported paired-garment preview is not available."
          : "This is a preliminary styling proposal, not a verified fit or tailoring approval.",
      tradeoff: look.candidate.tradeoff,
      rationale: look.why[0] || look.candidate.reasons[0] || "",
      fabric: {
        color: look.fabric.colorName, line: look.fabric.line, pattern: look.fabric.pattern,
      },
      outfit: real ? { shirt: real.shirtName, pant: real.pantName } : null,
      construction: real ? {
        shirtType: real.styleSpec.shirt.type,
        collar: real.styleSpec.shirt.collar,
        cuff: real.styleSpec.shirt.cuff,
        pantType: real.styleSpec.pant.type,
        waistband: real.styleSpec.pant.waistband,
        pantBreak: real.styleSpec.pant.break,
        wear: real.styleSpec.shirt.wear,
      } : null,
    };
  });
}
