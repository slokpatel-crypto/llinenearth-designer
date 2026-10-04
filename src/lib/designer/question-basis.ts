import type { DesignerAdviceOption } from "./advisor.ts";
import type { DesignerContext, DesignerStyle, OccasionTier } from "./engine.ts";
import { parseDesignerBrief } from "./brief.ts";

export type DesignerQuestionBasis={
  currentShirtId:string;
  currentPantId:string;
  currentStyle:DesignerStyle;
  occasion:OccasionTier;
  context:DesignerContext;
};

/** A proposal is a question starting point, not an applied or endorsed outfit.
 * Keep its own occasion, especially when it came from a multi-occasion capsule. */
export function designerDirectionBasis(
  option:Pick<DesignerAdviceOption,"shirt"|"pant"|"style"|"occasion"|"context">,
  fallback:Pick<DesignerQuestionBasis,"occasion"|"context">,
):DesignerQuestionBasis {
  return {
    currentShirtId:option.shirt.id,currentPantId:option.pant.id,
    currentStyle:{...option.style},occasion:option.occasion || fallback.occasion,
    context:{...(option.context || fallback.context)},
  };
}

/** A judgement refers to the judged proposal, even when another proposal was
 * the conversation's starting point. Snapshot construction to avoid aliasing. */
export function designerQuestionBasis(
  current:DesignerQuestionBasis,working?:DesignerQuestionBasis|null,judged?:DesignerQuestionBasis|null,
):DesignerQuestionBasis {
  const source=judged || working || current;
  return {...source,currentStyle:{...source.currentStyle},context:{...source.context}};
}

/** Match the occasion parser used by the API. An explicit new occasion in a
 * follow-up must not receive preferences from the proposal's earlier occasion. */
export function designerQuestionPreferenceOccasion(brief:string,basis:DesignerQuestionBasis):OccasionTier {
  return parseDesignerBrief(brief,{occasion:basis.occasion,context:basis.context,style:basis.currentStyle}).occasion;
}
