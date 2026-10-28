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
  "opacity","comfortTags","physicsProfile","garmentCompatibility",
  "source","allowedGarments",
] as const satisfies readonly (keyof DesignerFabric)[];

export function fabricRevisionKey(fabric:DesignerFabric|null|undefined):string{
  if(!fabric||typeof fabric.id!=="string"||!fabric.id.trim()) return "missing";
  return JSON.stringify([fabric.id,...FABRIC_REVISION_FIELDS.map((field)=>fabric[field]??null)]);
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
    fabricRevisionKey(selection.shirt)!==fabricRevisionKey(recommendation.shirt))) return false;
  if("pant" in selection && (!selection.pant ||
    fabricRevisionKey(selection.pant)!==fabricRevisionKey(recommendation.pant))) return false;

  const expected=fromLegacyStyle(direction.baseStyle);
  return selection.styleSpec.styleSchemaVersion===expected.styleSchemaVersion &&
    sameFields(selection.styleSpec.shirt,expected.shirt) &&
    sameFields(selection.styleSpec.pant,expected.pant) &&
    sameFields(selection.styleSpec.legacy,expected.legacy);
}
