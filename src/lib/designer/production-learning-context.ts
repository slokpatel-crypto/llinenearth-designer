import type { LockedDesignRevision } from "@/lib/designer/design-lock";

export const PRODUCTION_LEARNING_CONTEXT_VERSION="linen-earth-production-learning-context-v1" as const;

export type ProductionLearningContext={
  version:typeof PRODUCTION_LEARNING_CONTEXT_VERSION;
  revisionId:string;
  recipeHash:string;
  source:{
    designerRuleSetVersion:string;
    fitConstructionVersion:string|null;
    styleSchemaVersion:2|null;
  };
  context:{
    occasion:string;
    climate:string;
    intention:string;
  };
  fabrics:{
    shirtId:string;
    trouserId:string;
  };
  shirt:{
    fit:string;
    wear:string;
    collar:string;
    collarFinish:string;
    cuff:string;
    placket:string;
    button:string;
  };
  trouser:{
    shape:string;
    rise:string;
    waistband:string;
    break:string;
  };
  creative:{
    conceptId:string;
    explorationClass:string;
    treatmentIds:string[];
    patternId:string|null;
  }|null;
};

export function buildProductionLearningContext(revision:LockedDesignRevision):ProductionLearningContext{
  const spec=revision.garmentSpec;
  return {
    version:PRODUCTION_LEARNING_CONTEXT_VERSION,
    revisionId:revision.revisionId,
    recipeHash:revision.recipeHash.toLowerCase(),
    source:{
      designerRuleSetVersion:spec.source.designerRuleSetVersion,
      fitConstructionVersion:spec.source.fitConstructionVersion,
      styleSchemaVersion:spec.source.styleSchemaVersion,
    },
    context:{
      occasion:spec.context.occasion,
      climate:spec.context.climate,
      intention:spec.context.intention,
    },
    fabrics:{
      shirtId:spec.fabrics.shirt.id,
      trouserId:spec.fabrics.trouser.id,
    },
    shirt:{
      fit:spec.shirt.fit,
      wear:spec.shirt.wear,
      collar:spec.shirt.collar,
      collarFinish:spec.shirt.collarFinish,
      cuff:spec.shirt.cuff,
      placket:spec.shirt.placket,
      button:spec.shirt.button,
    },
    trouser:{
      shape:spec.trouser.shape,
      rise:spec.trouser.rise,
      waistband:spec.trouser.waistband,
      break:spec.trouser.break,
    },
    creative:spec.creative?{
      conceptId:spec.creative.conceptId,
      explorationClass:spec.creative.explorationClass,
      treatmentIds:spec.creative.treatments.map(item=>item.id),
      patternId:spec.creative.pattern?.id??null,
    }:null,
  };
}
