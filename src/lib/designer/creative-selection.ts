import type { CreativeDirection } from "./creative-engine.ts";
import type { DesignerClimate, DesignerIntention, DesignerStyle, OccasionTier } from "./engine.ts";
import { fromLegacyStyle, type StyleSpecV2 } from "./style-spec-v2.ts";

export type CreativeSelection = {
  shirtId:string;
  pantId:string;
  occasion:OccasionTier;
  climate:DesignerClimate;
  intention:DesignerIntention;
  style:DesignerStyle;
  styleSpec:StyleSpecV2;
};

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

  const expected=fromLegacyStyle(direction.baseStyle);
  return selection.styleSpec.styleSchemaVersion===expected.styleSchemaVersion &&
    sameFields(selection.styleSpec.shirt,expected.shirt) &&
    sameFields(selection.styleSpec.pant,expected.pant) &&
    sameFields(selection.styleSpec.legacy,expected.legacy);
}
