import type { LockedDesignRevision } from "@/lib/designer/design-lock";
import { verifyLockedDesignRevision } from "./design-lock.ts";
import { auditHandoffFitProvenance, auditHandoffMeasurements } from "./handoff-measurements.ts";
import { validateStyleSpecV2 } from "./style-spec-v2.ts";

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
    // Exact advanced cut, body settings and occasion are copied from the
    // cryptographically locked recipe; the older shorthand fields below
    // are not a substitute for a cutting specification.
    styleSpec?:LockedDesignRevision["garmentSpec"]["styleSpec"];
    bodyProfile?:LockedDesignRevision["garmentSpec"]["bodyProfile"];
    context?:LockedDesignRevision["garmentSpec"]["context"];
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
  const measurementAudit=auditHandoffMeasurements({
    shirt:spec.shirt.finishedTargets,
    trouser:spec.trouser.finishedTargets,
  });
  if(measurementAudit.errors.length) {
    throw new Error(`Unsafe tailor handoff measurements: ${measurementAudit.errors.join(" ")}`);
  }
  const fitProvenance={
    fitConstructionVersion:spec.source.fitConstructionVersion,
    easeSource:spec.source.fitEaseSource,
    easeTableVersion:spec.source.fitEaseTableVersion,
  };
  const fitAudit=auditHandoffFitProvenance(fitProvenance);
  if(fitAudit.errors.length) {
    throw new Error(`Unsafe tailor handoff fit provenance: ${fitAudit.errors.join(" ")}`);
  }
  if (spec.styleSpec && !validateStyleSpecV2(spec.styleSpec)) {
    throw new Error("Unsafe tailor handoff construction: unrecognised versioned style option.");
  }
  if ((spec.source.styleSchemaVersion ?? null) !== (spec.styleSpec?.styleSchemaVersion ?? null)) {
    throw new Error("Unsafe tailor handoff construction: locked option schema provenance does not match the selected cut.");
  }
  const measurementSourceNote=spec.source.measurementProfileVersion===1 ? [] : [
    "A versioned measurement profile is not recorded; reconstruct and verify the measurement units and landmarks before tailor review.",
  ];
  const legacyConstructionNote=spec.styleSpec ? [] : [
    "Versioned StyleSpec v2 cut IDs are missing; confirm the exact legacy shirt and trouser construction before production.",
  ];
  const unresolved=[...new Set([
    ...spec.unresolved,
    ...measurementAudit.missing,
    ...fitAudit.missing,
    ...measurementSourceNote,
    ...legacyConstructionNote,
  ])];
  const ready=spec.status==="ready_for_tailor_review"
    && spec.readiness.tailoring!=="insufficient_measurements"
    && spec.readiness.materialVerification==="verified"
    && measurementAudit.missing.length===0
    && fitAudit.missing.length===0
    && measurementSourceNote.length===0
    && legacyConstructionNote.length===0;
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
      styleSpec:spec.styleSpec?JSON.parse(JSON.stringify(spec.styleSpec)):null,
      bodyProfile:spec.bodyProfile?JSON.parse(JSON.stringify(spec.bodyProfile)):null,
      context:{...spec.context},
      fitProvenance,
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
    unresolved,
    caveats:[
      ...spec.caveats,
      "This handoff preserves the locked design recipe but is not a cutting pattern.",
      "No verified physical model/body measurements or tailor sign-off are inferred from recorded targets, a measurement profile version, or a preview body profile.",
      ...(fitProvenance.easeSource === "provisional_house_defaults"
        ? ["Ease ranges use provisional house defaults; actual garment ease and fit need tailor confirmation."] : []),
      "Cloth estimate, stock reservation and price must come from validated production systems; they are never inferred here.",
    ],
  };
}


/**
 * Customer design edits and revisions MUST be verified before a tailor packet
 * can be trusted. This check uses the original locked SHA256, then verifies
 * every material, full StyleSpec v2 option, measurement/ease target, and
 * remaining blocking note against a newly constructed canonical handoff.
 * It does not assert stock reservation, cutting-pattern validation or approval.
 */
export async function buildVerifiedProductionHandoff(
  revision:LockedDesignRevision,
  generatedAt=new Date().toISOString(),
):Promise<ProductionHandoff> {
  if(!await verifyLockedDesignRevision(revision))
    throw new Error("Locked design hash no longer matches the exact garment and tailoring recipe.");
  // A handoff cannot predate its locked source. This ordering check does not
  // authenticate its displayed generation time; only recipe fields are SHA256-locked.
  const lockedTime=new Date(revision.lockedAt).getTime();
  const issuedTime=new Date(generatedAt).getTime();
  if(!Number.isFinite(lockedTime)||!Number.isFinite(issuedTime)||issuedTime<lockedTime)
    throw new Error("Verified tailor handoff cannot be generated before its source design was locked.");
  return buildProductionHandoff(revision,generatedAt);
}

export async function verifyProductionHandoff(
  handoff:ProductionHandoff,
  revision:LockedDesignRevision,
):Promise<boolean> {
  if(!await verifyLockedDesignRevision(revision)) return false;
  const lockedTime=new Date(revision.lockedAt).getTime();
  const issuedTime=new Date(handoff.generatedAt).getTime();
  if(!Number.isFinite(lockedTime)||!Number.isFinite(issuedTime)||issuedTime<lockedTime) return false;
  if(handoff.version!==PRODUCTION_HANDOFF_VERSION
     ||handoff.recipeHash!==revision.recipeHash
     ||handoff.designRevisionId!==revision.revisionId) return false;
  try {
    const expected=buildProductionHandoff(revision,handoff.generatedAt);
    // Canonical comparisons do not rely on JS object insertion order and
    // include all 2D photo-vs-cut caveats, source and customer measurements.
    const sorted=(input:unknown):unknown=>Array.isArray(input)?input.map(sorted)
      :input&&typeof input==="object"
        ?Object.fromEntries(Object.entries(input).sort(([a],[b])=>a.localeCompare(b))
          .map(([key,value])=>[key,sorted(value)]))
        :input;
    return JSON.stringify(sorted(handoff))===JSON.stringify(sorted(expected));
  }catch{return false;}
}
