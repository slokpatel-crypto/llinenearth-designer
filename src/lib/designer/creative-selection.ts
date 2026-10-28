import type { CreativeDirection } from "./creative-engine.ts";
import type { DesignerClimate, DesignerFabric, DesignerIntention, DesignerStyle, OccasionTier } from "./engine.ts";
import { fromLegacyStyle, type StyleSpecV2 } from "./style-spec-v2.ts";

export type CreativeSelection = {
  shirtId:string;
  pantId:string;
  /** Current catalogue snapshots: supplied by the live Designer, optional for legacy callers. */
  shirt?:DesignerFabric|null;
  pant?:DesignerFabric|null;
  occasion:OccasionTier;
  climate:DesignerClimate;
  intention:DesignerIntention;
  style:DesignerStyle;
  styleSpec:StyleSpecV2;
};

/** Only evidence-bearing catalogue fields belong to the revision identity.
 * A repeated fabric ID with new physical/provenance data is a new preview
 * input; old creative/render/fit approval must not follow it silently.
 */
const FABRIC_REVISION_FIELDS=[
  "name","line","image","hex","colorFamily","tone","patternType","patternScale",
  "renderScale","weightGsm","weightClass","bestSeason","roleTags","weave",
  "texture","fiberContent","confirmedAvailableMetres","availabilityVerified",
  "colorVerified","patternScaleVerified","fiberContentVerified","drape",
  "opacity","comfortTags","physicsProfile",
  "source","allowedGarments",
] as const satisfies readonly (keyof DesignerFabric)[];

function canonicalEvidence(value:unknown,seen:WeakSet<object>):unknown{
  if(value===null||value===undefined) return null;
  if(typeof value==="number"){
    if(!Number.isFinite(value)) throw new Error("Nonfinite fabric evidence");
    return value;
  }
  if(typeof value==="string"||typeof value==="boolean") return value;
  if(typeof value!=="object"||seen.has(value)) throw new Error("Invalid fabric evidence");
  seen.add(value);
  try {
    if(Array.isArray(value)) return value.map((item)=>canonicalEvidence(item,seen));
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null) throw new Error("Non-JSON fabric evidence");
    return Object.fromEntries(Object.keys(value).sort().map((key)=>[
      key,canonicalEvidence((value as Record<string,unknown>)[key],seen),
    ]));
  } finally {seen.delete(value);}
}

export function fabricRevisionKey(fabric:DesignerFabric|null|undefined):string{
  if(!fabric||typeof fabric.id!=="string"||!fabric.id.trim()) return "missing";
  try {
    // Sorting nested JSON keys prevents harmless API serialization order from
    // revoking a still-identical fabric, while invalid/nonfinite data blocks.
    return JSON.stringify(canonicalEvidence([
      fabric.id,...FABRIC_REVISION_FIELDS.map((field)=>fabric[field]??null),
    ],new WeakSet<object>()));
  } catch {return "missing";}
}

function sameFields(left:Record<string,string>,right:Record<string,string>) {
  const keys=Object.keys(right);
  return Object.keys(left).length===keys.length && keys.every((key)=>left[key]===right[key]);
}

/**
 * A selected concept belongs to the exact live fabric, context and cut.
 * Changing only climate, intention or an advanced v2 cut must not leave
 * the old concept/photoreal evidence attached to a different design.
 */
export function creativeDirectionMatchesSelection(
  direction:CreativeDirection|null,
  selection:CreativeSelection,
) {
  if(!direction?.recommendation?.context || !direction.baseStyle) return false;
  const recommendation=direction.recommendation;
  if(recommendation.shirt?.id!==selection.shirtId ||
    recommendation.pant?.id!==selection.pantId ||
    recommendation.occasion!==selection.occasion ||
    recommendation.context.climate!==selection.climate ||
    recommendation.context.intention!==selection.intention ||
    !sameFields(selection.style,direction.baseStyle)) return false;

  // Current UI always supplies both selected catalogue snapshots. A missing
  // snapshot or a same-ID revision change invalidates prior creative evidence.
  if("shirt" in selection && (!selection.shirt ||
    fabricRevisionKey(selection.shirt)==="missing" ||
    fabricRevisionKey(selection.shirt)!==fabricRevisionKey(recommendation.shirt))) return false;
  if("pant" in selection && (!selection.pant ||
    fabricRevisionKey(selection.pant)==="missing" ||
    fabricRevisionKey(selection.pant)!==fabricRevisionKey(recommendation.pant))) return false;

  const expected=fromLegacyStyle(direction.baseStyle);
  return selection.styleSpec.styleSchemaVersion===expected.styleSchemaVersion &&
    sameFields(selection.styleSpec.shirt,expected.shirt) &&
    sameFields(selection.styleSpec.pant,expected.pant) &&
    sameFields(selection.styleSpec.legacy,expected.legacy);
}
