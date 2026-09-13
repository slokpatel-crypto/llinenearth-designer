export type Confidence = "high" | "medium" | "low";

export type FabricVisualSignals = {
  dominantHex: string;
  meanLightness: number;
  saturation: number;
  contrast: number;
  texture: number;
  edgeDensity: number;
  horizontalStructure: number;
  verticalStructure: number;
  colorVariation: number;
};

export type FabricCandidate = {
  family: string;
  confidence: number;
  evidence: string[];
};

export type FabricObservation = {
  label: string;
  value: string;
  confidence: number;
  confidenceLabel: Confidence;
  basis: "visual_estimate" | "user_confirmed" | "development_visual_classifier";
};

export type FabricProfile = {
  id: string;
  source: "development_visual_classifier";
  summary: string;
  observations: FabricObservation[];
  palette: string[];
  alternatives: FabricCandidate[];
  visualSignals?: FabricVisualSignals;
  cautions: string[];
};

export type FabricAnalysisInput = {
  fileName: string;
  contentType: string;
  size: number;
  visualSignals?: FabricVisualSignals;
};

function confidenceLabel(score: number): Confidence {
  if (score >= 0.82) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

const families = [
  "Linen", "Linen-Cotton", "Cotton Poplin", "Oxford Cotton", "Cotton Twill",
  "TR / Poly-Viscose Suiting", "TR-Wool / Poly-Viscose-Wool", "Tropical Wool",
  "Hopsack Wool", "Wool Flannel", "Cotton Seersucker", "Denim", "Corduroy", "Velvet", "Silk Blend"
] as const;

function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }
function closeness(value: number, target: number, spread = .3) { return clamp01(1 - Math.abs(value - target) / spread); }
function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const n = Number.parseInt(clean.length === 3 ? clean.split("").map((x) => x + x).join("") : clean, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r: number, g: number, b: number) { return `#${[r,g,b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2,"0")).join("")}`; }
function adjustHex(hex: string, amount: number) {
  const { r,g,b } = hexToRgb(hex);
  return rgbToHex(r + amount, g + amount, b + amount);
}
function colorName(hex: string) {
  const { r,g,b } = hexToRgb(hex);
  const max = Math.max(r,g,b), min = Math.min(r,g,b), light = (max + min) / 510;
  if (max - min < 18) return light < .18 ? "Black / near-black" : light < .38 ? "Charcoal" : light < .68 ? "Grey" : "Ivory / light neutral";
  if (b > r * 1.12 && b > g * .95) return light < .35 ? "Deep navy / blue" : "Blue";
  if (r > b * 1.35 && g > b * 1.15) return light > .62 ? "Warm beige / cream" : "Camel / warm brown";
  if (r > g * 1.18 && r > b * 1.2) return light < .35 ? "Burgundy / deep red" : "Red / rust";
  if (g > r * 1.08 && g > b * 1.08) return "Olive / green";
  return light < .35 ? "Deep muted tone" : "Muted mid-tone";
}

function filenameHint(name: string) {
  const n = name.toLowerCase();
  const map: Array<[string[], string]> = [
    [["linen"],"Linen"], [["linencotton","linen-cotton","linen_cotton"],"Linen-Cotton"], [["poplin"],"Cotton Poplin"],
    [["oxford"],"Oxford Cotton"], [["twill"],"Cotton Twill"], [["tr-wool","trwool","pvwool"],"TR-Wool / Poly-Viscose-Wool"],
    [["tr","polyviscose","poly-viscose","pv"],"TR / Poly-Viscose Suiting"], [["tropical"],"Tropical Wool"], [["hopsack"],"Hopsack Wool"],
    [["flannel"],"Wool Flannel"], [["seersucker"],"Cotton Seersucker"], [["denim","jean"],"Denim"], [["corduroy","cord"],"Corduroy"],
    [["velvet"],"Velvet"], [["silk"],"Silk Blend"], [["cotton"],"Cotton Poplin"], [["wool"],"Tropical Wool"]
  ];
  return map.find(([keys]) => keys.some((k) => n.includes(k)))?.[1];
}

function scoreFamilies(input: FabricAnalysisInput): FabricCandidate[] {
  const s = input.visualSignals;
  const hint = filenameHint(input.fileName);
  if (!s) return [{ family: hint || "Linen", confidence: .52, evidence: [hint ? "Filename suggests this family." : "No visual signal data was available."] }];
  const direction = Math.abs(s.horizontalStructure - s.verticalStructure);
  const dark = 1 - s.meanLightness;
  const smooth = 1 - s.texture;
  const lowEdge = 1 - s.edgeDensity;
  const scoreMap: Record<string, number> = {
    "Linen": .22 + .30 * closeness(s.texture,.62,.48) + .18 * closeness(s.colorVariation,.45,.45) + .12 * closeness(s.edgeDensity,.42,.4),
    "Linen-Cotton": .24 + .24 * closeness(s.texture,.48,.45) + .16 * closeness(s.colorVariation,.36,.4) + .12 * closeness(s.edgeDensity,.34,.4),
    "Cotton Poplin": .24 + .30 * smooth + .22 * lowEdge + .10 * closeness(s.colorVariation,.18,.3),
    "Oxford Cotton": .23 + .26 * closeness(s.texture,.48,.38) + .22 * closeness(s.edgeDensity,.45,.4) + .10 * closeness(s.colorVariation,.3,.35),
    "Cotton Twill": .22 + .28 * closeness(s.texture,.5,.4) + .24 * direction + .12 * closeness(s.edgeDensity,.5,.42),
    "TR / Poly-Viscose Suiting": .25 + .25 * closeness(s.texture,.25,.34) + .20 * lowEdge + .10 * closeness(s.contrast,.35,.35),
    "TR-Wool / Poly-Viscose-Wool": .23 + .22 * closeness(s.texture,.38,.36) + .16 * closeness(s.edgeDensity,.34,.34) + .12 * dark,
    "Tropical Wool": .24 + .23 * closeness(s.texture,.32,.33) + .18 * closeness(s.edgeDensity,.3,.32) + .12 * dark,
    "Hopsack Wool": .20 + .34 * closeness(s.texture,.72,.34) + .26 * closeness(s.edgeDensity,.68,.35),
    "Wool Flannel": .21 + .28 * closeness(s.texture,.3,.34) + .20 * lowEdge + .12 * dark + .08 * s.colorVariation,
    "Cotton Seersucker": .18 + .28 * closeness(s.texture,.66,.35) + .30 * direction + .12 * s.contrast,
    "Denim": .20 + .22 * closeness(s.texture,.58,.4) + .18 * s.edgeDensity + .18 * dark + .10 * s.contrast,
    "Corduroy": .16 + .25 * closeness(s.texture,.72,.35) + .34 * direction + .14 * s.edgeDensity,
    "Velvet": .18 + .25 * smooth + .20 * dark + .20 * closeness(s.contrast,.46,.42) + .08 * lowEdge,
    "Silk Blend": .20 + .32 * smooth + .15 * s.saturation + .16 * s.contrast + .10 * lowEdge,
  };
  if (hint) scoreMap[hint] = (scoreMap[hint] || .3) + .28;
  return families.map((family) => {
    const raw = clamp01(scoreMap[family]);
    const confidence = Math.min(hint === family ? .89 : .79, .38 + raw * .5);
    const evidence: string[] = [];
    if (hint === family) evidence.push("Filename/material label supports this family.");
    if (s.texture > .58) evidence.push("Visible surface texture is relatively pronounced.");
    if (s.texture < .3) evidence.push("Surface reads comparatively smooth/fine.");
    if (direction > .16) evidence.push("Directional weave/rib structure is visible.");
    if (s.edgeDensity > .55) evidence.push("High micro-edge density suggests a more open or pronounced weave.");
    if (dark > .6) evidence.push("Dark tonal response is consistent with many suiting/denim families.");
    return { family, confidence, evidence: evidence.slice(0,3) };
  }).sort((a,b) => b.confidence - a.confidence).slice(0,4);
}

function patternFromSignals(s?: FabricVisualSignals) {
  if (!s) return "Solid / unresolved";
  const directional = Math.abs(s.horizontalStructure - s.verticalStructure);
  if (s.horizontalStructure > .58 && s.verticalStructure > .58) return "Check / grid-like structure";
  if (directional > .2 && Math.max(s.horizontalStructure,s.verticalStructure) > .45) return "Directional stripe / rib structure";
  if (s.colorVariation > .52 && s.contrast > .42) return "Mottled / heathered variation";
  if (s.texture > .62) return "Solid with visible slub / weave texture";
  return "Mostly solid / subtle variation";
}
function surfaceFromSignals(s?: FabricVisualSignals) {
  if (!s) return "Surface unresolved";
  if (s.texture > .7) return "Pronounced, open or ridged texture";
  if (s.texture > .48) return "Dry, visibly textured surface";
  if (s.texture > .28) return "Fine-to-medium woven surface";
  return "Smooth / fine surface";
}
function drapeProxy(s?: FabricVisualSignals) {
  if (!s) return "Unknown from still image";
  if (s.contrast > .58 && s.texture < .35) return "Possibly fluid / light-reflective";
  if (s.texture > .62 && s.edgeDensity > .5) return "Likely more structured / textured";
  return "Medium / requires fold or hand-feel confirmation";
}

export function analyzeFabricDevelopment(input: FabricAnalysisInput): FabricProfile {
  const alternatives = scoreFamilies(input);
  const top = alternatives[0];
  const s = input.visualSignals;
  const dominantHex = s?.dominantHex || "#17243a";
  const dominant = colorName(dominantHex);
  const pattern = patternFromSignals(s);
  const surface = surfaceFromSignals(s);
  const raw = [
    ["Likely material family", top.family, top.confidence],
    ["Dominant color", dominant, s ? .88 : .58],
    ["Pattern structure", pattern, s ? Math.min(.86,.58 + s.contrast * .24 + Math.abs(s.horizontalStructure-s.verticalStructure)*.2) : .52],
    ["Surface / weave", surface, s ? Math.min(.82,.54 + s.texture * .3) : .48],
    ["Drape proxy", drapeProxy(s), s ? .56 : .38],
    ["Visual texture index", s ? `${Math.round(s.texture*100)}/100` : "Not available", s ? .92 : .3],
  ] as const;
  return {
    id: `FAB-${Date.now()}`,
    source: "development_visual_classifier",
    summary: `${top.family} is the strongest visual match (${Math.round(top.confidence*100)}%). The cloth reads as ${dominant.toLowerCase()} with ${pattern.toLowerCase()} and ${surface.toLowerCase()}.`,
    observations: raw.map(([label,value,score]) => ({ label, value, confidence: score, confidenceLabel: confidenceLabel(score), basis: "development_visual_classifier" })),
    palette: [dominantHex, adjustHex(dominantHex,-34), adjustHex(dominantHex,34), adjustHex(dominantHex,68)],
    alternatives,
    visualSignals: s,
    cautions: [
      "This V3 classifier reads color, contrast, texture and directional weave cues from the photo; it still cannot chemically prove fibre composition.",
      "Exact GSM/weight, stretch, fibre percentages and hand-feel need a label, supplier specification or physical confirmation.",
    ],
  };
}
