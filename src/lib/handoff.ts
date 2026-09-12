import type { SavedDesign } from "@/lib/saved-designs";
import { fabricTypes, judgeFabricForBrief, type WearFamily } from "@/lib/fashion-intelligence";

export const HANDOFF_KEY = "llinen-earth-atelier-handoffs-v1";
export type HandoffStatus = "requested" | "in_review" | "fabric_check" | "ready_for_consultation";
export type AtelierHandoff = {
  id: string;
  createdAt: string;
  status: HandoffStatus;
  designId: string;
  specHash: string;
  title: string;
  customerNote: string;
  occasion: string;
  venue: string;
  aesthetic: string;
  garmentSpec: SavedDesign["version"]["candidate"]["garments"];
  palette: string[];
  uploadedFabric: string;
  fabricAssessment: {
    score: number;
    verdict: string;
    preferredRole: WearFamily;
    bestOutfitType: string;
    reasons: string[];
  };
  idealStoreFabrics: { id: string; name: string; reason: string }[];
  staffNote?: string;
};

export function listHandoffs(): AtelierHandoff[] {
  if (typeof window === "undefined") return [];
  try { const value = JSON.parse(localStorage.getItem(HANDOFF_KEY) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; }
}

function idealFabrics(design: SavedDesign) {
  const context = `${design.brief.context.occasion} ${design.brief.context.formality} ${design.brief.context.environment}`.toLowerCase();
  const hot = /hot|humid|beach|outdoor|resort/.test(context);
  const formal = /formal|business|reception|ceremonial|wedding/.test(context);
  return fabricTypes
    .map((fabric) => {
      let score = fabric.formality * (formal ? .45 : .2) + fabric.breathability * (hot ? .4 : .15) + fabric.drape * .25 + fabric.structure * (formal ? .15 : .05);
      if (fabric.id === design.version.candidate.fabricJudgement?.resolvedFabric?.id) score += 10;
      return { fabric, score };
    })
    .sort((a,b)=>b.score-a.score)
    .slice(0,4)
    .map(({fabric})=>({ id:fabric.id, name:fabric.name, reason: formal ? `${fabric.formality}/100 formality with ${fabric.drape}/100 drape.` : `${fabric.breathability}/100 breathability with ${fabric.drape}/100 drape.` }));
}

export function createHandoff(design: SavedDesign, customerNote = ""): AtelierHandoff {
  if (typeof window === "undefined") throw new Error("Atelier handoff is available in the browser.");
  const assessment = judgeFabricForBrief(design.brief, design.version.candidate.fabricJudgement?.garmentRole);
  const item: AtelierHandoff = {
    id:`HO-${design.version.specHash || design.id}-${Date.now().toString(36).toUpperCase()}`,
    createdAt:new Date().toISOString(), status:"requested", designId:design.id,
    specHash:design.version.specHash || design.version.id, title:design.title, customerNote,
    occasion:design.brief.context.occasion, venue:design.brief.context.venue, aesthetic:design.version.candidate.aesthetic,
    garmentSpec:{...design.version.candidate.garments}, palette:[...design.version.candidate.palette],
    uploadedFabric:assessment.resolvedFabric?.name || design.renderSet.spec.fabric.material,
    fabricAssessment:{ score:assessment.overall, verdict:assessment.verdict, preferredRole:assessment.garmentRole, bestOutfitType:assessment.bestOutfitType, reasons:assessment.reasons },
    idealStoreFabrics:idealFabrics(design),
  };
  const existing = listHandoffs();
  localStorage.setItem(HANDOFF_KEY, JSON.stringify([item, ...existing.filter((x)=>x.specHash!==item.specHash)].slice(0,50)));
  return item;
}

export function updateHandoff(id: string, patch: Partial<Pick<AtelierHandoff,"status"|"staffNote">>) {
  if (typeof window === "undefined") return;
  const next = listHandoffs().map((item)=>item.id===id?{...item,...patch}:item);
  localStorage.setItem(HANDOFF_KEY,JSON.stringify(next));
}
