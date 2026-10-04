import type { LockedDesignRevision } from "@/lib/designer/design-lock";

export const PRODUCTION_HANDOFF_VERSION="linen-earth-production-handoff-v1" as const;

export type ProductionHandoff={
  version:typeof PRODUCTION_HANDOFF_VERSION;
  designRevisionId:string;
  recipeHash:string;
  generatedAt:string;
  status:"review_required"|"ready_for_tailor_review";
  fabrics:{
    shirt:{id:string;name:string;line:string;source:string};
    trouser:{id:string;name:string;line:string;source:string};
  };
  construction:{
    fitProvenance:{
      fitConstructionVersion:LockedDesignRevision["garmentSpec"]["source"]["fitConstructionVersion"];
      easeSource:LockedDesignRevision["garmentSpec"]["source"]["fitEaseSource"];
      easeTableVersion:LockedDesignRevision["garmentSpec"]["source"]["fitEaseTableVersion"];
    };
    creative?:LockedDesignRevision["garmentSpec"]["creative"];
    shirt:LockedDesignRevision["garmentSpec"]["shirt"];
    trouser:LockedDesignRevision["garmentSpec"]["trouser"];
    blockStrategy:LockedDesignRevision["garmentSpec"]["blockStrategy"];
    checks:LockedDesignRevision["garmentSpec"]["constructionChecks"];
  };
  production:{
    clothEstimate:{
      shirtMetres:null;
      trouserMetres:null;
      basis:"tailor_required";
      note:string;
    };
    stockReservation:{
      status:"not_requested";
      reservationId:null;
    };
    quote:{
      status:"pending";
      amount:null;
      currency:null;
    };
  };
  unresolved:string[];
  caveats:string[];
};

export function buildProductionHandoff(
  revision:LockedDesignRevision,
  generatedAt=new Date().toISOString(),
):ProductionHandoff {
  const spec=revision.garmentSpec;
  const ready=spec.status==="ready_for_tailor_review"
    && spec.readiness.tailoring!=="insufficient_measurements"
    && spec.readiness.materialVerification==="verified";
  return {
    version:PRODUCTION_HANDOFF_VERSION,
    designRevisionId:revision.revisionId,
    recipeHash:revision.recipeHash,
    generatedAt:new Date(generatedAt).toISOString(),
    status:ready?"ready_for_tailor_review":"review_required",
    fabrics:{
      shirt:{id:spec.fabrics.shirt.id,name:spec.fabrics.shirt.name,line:spec.fabrics.shirt.line,source:spec.fabrics.shirt.source},
      trouser:{id:spec.fabrics.trouser.id,name:spec.fabrics.trouser.name,line:spec.fabrics.trouser.line,source:spec.fabrics.trouser.source},
    },
    construction:{
      fitProvenance:{
        fitConstructionVersion:spec.source.fitConstructionVersion,
        easeSource:spec.source.fitEaseSource,
        easeTableVersion:spec.source.fitEaseTableVersion,
      },
      ...(spec.creative?{creative:JSON.parse(JSON.stringify(spec.creative))}:{}),
      shirt:JSON.parse(JSON.stringify(spec.shirt)),
      trouser:JSON.parse(JSON.stringify(spec.trouser)),
      blockStrategy:spec.blockStrategy ? JSON.parse(JSON.stringify(spec.blockStrategy)) : null,
      checks:spec.constructionChecks.map((item)=>({...item})),
    },
    production:{
      clothEstimate:{
        shirtMetres:null,
        trouserMetres:null,
        basis:"tailor_required",
        note:"Cloth meterage is intentionally blank until Linen Earth validates a garment/width/size estimation table with its tailor.",
      },
      stockReservation:{status:"not_requested",reservationId:null},
      quote:{status:"pending",amount:null,currency:null},
    },
    unresolved:[...spec.unresolved],
    caveats:[
      ...spec.caveats,
      "This handoff preserves the locked design recipe but is not a cutting pattern.",
      "Cloth estimate, stock reservation and price must come from validated production systems; they are never inferred here.",
    ],
  };
}
