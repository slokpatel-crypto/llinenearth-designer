export type Confidence = "high" | "medium" | "low";

export type FabricObservation = {
  label: string;
  value: string;
  confidence: number;
  confidenceLabel: Confidence;
  basis: "visual_estimate" | "user_confirmed" | "development_mock";
};

export type FabricProfile = {
  id: string;
  source: "development_mock";
  summary: string;
  observations: FabricObservation[];
  palette: string[];
  cautions: string[];
};

export type FabricAnalysisInput = {
  fileName: string;
  contentType: string;
  size: number;
};

function confidenceLabel(score: number): Confidence {
  if (score >= 0.82) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

function familyFromName(name: string) {
  const n = name.toLowerCase();
  if (n.includes("linen")) return "Linen / linen blend";
  if (n.includes("cotton")) return "Cotton / cotton blend";
  if (n.includes("wool")) return "Wool / wool blend";
  if (n.includes("silk")) return "Silk / silk blend";
  return "Linen-like natural weave";
}

export function analyzeFabricDevelopment(input: FabricAnalysisInput): FabricProfile {
  const family = familyFromName(input.fileName);
  const raw = [
    ["Likely material family", family, 0.68],
    ["Dominant color", "Deep navy", 0.91],
    ["Pattern", "Solid with subtle natural variation", 0.86],
    ["Surface", "Dry, lightly textured", 0.72],
    ["Drape", "Medium-light, relaxed", 0.63],
    ["Likely climate fit", "Warm to temperate", 0.66],
  ] as const;

  return {
    id: `FAB-${Date.now()}`,
    source: "development_mock",
    summary: "A dark, restrained fabric direction with natural surface character — promising for relaxed tailoring and elevated separates.",
    observations: raw.map(([label, value, score]) => ({
      label,
      value,
      confidence: score,
      confidenceLabel: confidenceLabel(score),
      basis: "development_mock",
    })),
    palette: ["#111b2e", "#1f2f49", "#45566f", "#9b8b72"],
    cautions: [
      "Fiber composition cannot be confirmed from a photo alone.",
      "Exact weight, stretch and hand-feel need user or supplier confirmation.",
    ],
  };
}
