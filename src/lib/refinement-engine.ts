import type { DesignCandidate } from "@/lib/designer-engine";
import type { DesignerBrief } from "@/lib/designer-types";

export type LockableField = "shirt" | "trouser" | "layer" | "footwear" | "aesthetic" | "palette";
export type ChangeDelta = { field: LockableField; before: string; after: string };
export type RefinementResult = { candidate: DesignCandidate; delta: ChangeDelta[]; summary: string };
export type DesignVersion = {
  id: string;
  parentId: string | null;
  candidate: DesignCandidate;
  lockedFields: LockableField[];
  delta: ChangeDelta[];
  reason: string;
  createdAt: string;
  finalized: boolean;
  specHash?: string;
};

const ALTERNATE_TROUSERS = ["Tailored Pleated Trouser", "Flat-Front Tailored Trouser", "Wide-Leg Trouser", "Drawstring Linen Trouser"];
const ALTERNATE_SHIRTS = ["Spread-Collar Dress Shirt", "Oxford Button-Down Shirt", "Camp-Collar Shirt", "Band-Collar Shirt"];

function copy(candidate: DesignCandidate): DesignCandidate {
  return { ...candidate, garments: { ...candidate.garments }, palette: [...candidate.palette], reasons: [...candidate.reasons], scores: { ...candidate.scores } };
}

function nextDifferent(current: string, list: string[]) {
  const index = list.indexOf(current);
  return list[(index + 1 + list.length) % list.length];
}

function inferScope(text: string): LockableField[] | null {
  if (!text.includes("only")) return null;
  if (text.includes("trouser") || text.includes("pant")) return ["trouser"];
  if (text.includes("shirt")) return ["shirt"];
  if (text.includes("jacket") || text.includes("blazer") || text.includes("layer")) return ["layer"];
  if (text.includes("shoe") || text.includes("footwear") || text.includes("loafer")) return ["footwear"];
  if (text.includes("aesthetic") || text.includes("style")) return ["aesthetic"];
  if (text.includes("color") || text.includes("palette")) return ["palette"];
  return null;
}

export function refineDesign(brief: DesignerBrief, source: DesignCandidate, instruction: string, lockedFields: LockableField[], versionNumber: number): RefinementResult {
  const text = instruction.trim().toLowerCase();
  const candidate = copy(source);
  candidate.id = `${source.id.split("-R")[0]}-R${versionNumber}`;
  const delta: ChangeDelta[] = [];
  const scope = inferScope(text);
  const locked = new Set(lockedFields);

  function can(field: LockableField) { return !locked.has(field) && (!scope || scope.includes(field)); }
  function set(field: LockableField, value: string | string[]) {
    if (!can(field)) return;
    const before = field === "palette" ? candidate.palette.join(", ") : field === "aesthetic" ? candidate.aesthetic : candidate.garments[field];
    const after = Array.isArray(value) ? value.join(", ") : value;
    if (before === after) return;
    if (field === "palette") candidate.palette = [...(value as string[])];
    else if (field === "aesthetic") candidate.aesthetic = value as string;
    else candidate.garments[field] = value as string;
    delta.push({ field, before, after });
  }

  const lessFormal = text.includes("less formal") || text.includes("more relaxed") || text.includes("casual") || text.includes("relax it");
  const moreFormal = !lessFormal && (text.includes("more formal") || text.includes("formal") || text.includes("sharper"));
  const italian = text.includes("italian");
  const quieter = text.includes("quieter") || text.includes("quiet luxury") || text.includes("subtle") || text.includes("understated");
  const bolder = text.includes("bolder") || text.includes("statement") || text.includes("more unique") || text.includes("directional");
  const changeTrouser = text.includes("change trouser") || text.includes("change pant") || text.includes("different trouser");
  const changeShirt = text.includes("change shirt") || text.includes("different shirt");
  const changeLayer = text.includes("change jacket") || text.includes("different jacket") || text.includes("change layer");
  const colorChange = text.includes("color") || text.includes("palette");

  if (changeTrouser) set("trouser", nextDifferent(candidate.garments.trouser, ALTERNATE_TROUSERS));
  if (changeShirt) set("shirt", nextDifferent(candidate.garments.shirt, ALTERNATE_SHIRTS));
  if (changeLayer) set("layer", candidate.garments.layer.includes("Double") ? "Soft Single-Breasted Blazer" : "Structured Double-Breasted Blazer");

  if (lessFormal) {
    set("shirt", brief.context.venue.includes("Beach") || brief.context.occasion.includes("Resort") ? "Camp-Collar Shirt" : "Oxford Button-Down Shirt");
    set("trouser", brief.context.venue.includes("Beach") ? "Drawstring Linen Trouser" : "Tailored Pleated Trouser");
    set("layer", "Unstructured overshirt / soft jacket");
    set("footwear", "Unlined suede loafer");
  }

  if (moreFormal) {
    set("shirt", "Spread-Collar Dress Shirt");
    set("trouser", "Flat-Front Tailored Trouser");
    set("layer", brief.context.time === "Evening" ? "Structured Double-Breasted Blazer" : "Soft Single-Breasted Blazer");
    set("footwear", "Dark brown leather loafer / oxford");
    set("aesthetic", "Modern Classic");
  }

  if (italian) {
    set("aesthetic", "Italian-Inspired");
    set("trouser", "Tailored Pleated Trouser");
    set("layer", "Soft Single-Breasted Blazer");
    set("footwear", "Dark brown suede loafer");
    if (can("palette")) set("palette", [...candidate.palette.slice(0, 3), "#e5dccb"].slice(0, 4));
  }

  if (quieter) {
    set("aesthetic", "Quiet Luxury");
    set("layer", candidate.garments.layer.includes("Double") ? "Soft Single-Breasted Blazer" : candidate.garments.layer);
    if (can("palette")) set("palette", candidate.palette.slice(0, 3));
  }

  if (bolder) {
    set("trouser", "Wide-Leg Trouser");
    set("layer", brief.context.environment.toLowerCase().includes("hot") ? "Soft Single-Breasted Blazer" : "Structured Double-Breasted Blazer");
    set("aesthetic", brief.context.occasion.includes("Festive") ? "Contemporary Indian" : "Italian-Inspired");
  }

  if (colorChange && can("palette")) {
    const rotated = candidate.palette.length > 1 ? [...candidate.palette.slice(1), candidate.palette[0]] : [...candidate.palette, "#17243a"];
    set("palette", rotated);
  }

  if (!delta.length && !scope) {
    set("trouser", nextDifferent(candidate.garments.trouser, ALTERNATE_TROUSERS));
  }

  candidate.name = `${source.name} · Refined`;
  candidate.concept = delta.length ? `Refined from ${source.name} while preserving locked components.` : source.concept;
  candidate.reasons = delta.length ? [`Applied “${instruction.trim()}” as a controlled design delta.`, `${lockedFields.length || "No"} component${lockedFields.length === 1 ? "" : "s"} locked during refinement.`, ...source.reasons.slice(0, 1)] : [...source.reasons];
  candidate.scores = { ...source.scores, coherence: Math.max(82, source.scores.coherence - Math.max(0, delta.length - 3)), total: Math.max(80, source.scores.total - Math.max(0, delta.length - 4)) };

  return { candidate, delta, summary: delta.length ? `${delta.length} controlled change${delta.length === 1 ? "" : "s"} applied.` : "No unlocked field matched this refinement." };
}

export function initialVersion(candidate: DesignCandidate): DesignVersion {
  return { id: "DV-001", parentId: null, candidate: copy(candidate), lockedFields: [], delta: [], reason: `Selected ${candidate.tier} direction`, createdAt: new Date().toISOString(), finalized: false };
}

export function nextVersion(parent: DesignVersion, result: RefinementResult, locks: LockableField[], number: number, reason: string): DesignVersion {
  return { id: `DV-${String(number).padStart(3, "0")}`, parentId: parent.id, candidate: result.candidate, lockedFields: [...locks], delta: result.delta, reason, createdAt: new Date().toISOString(), finalized: false };
}

function stableHash(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
}

export function finalizeVersion(version: DesignVersion): DesignVersion {
  const c = version.candidate;
  const canonical = JSON.stringify({ id: version.id, garments: c.garments, aesthetic: c.aesthetic, palette: c.palette, locks: version.lockedFields });
  return { ...version, finalized: true, specHash: `LE-${stableHash(canonical)}` };
}
