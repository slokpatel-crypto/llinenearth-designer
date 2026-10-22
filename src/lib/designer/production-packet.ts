import type { LockedDesignRevision } from "./design-lock.ts";
import {
  buildProductionHandoff, buildVerifiedProductionHandoff,
  type ProductionHandoff,
} from "./production-handoff.ts";

export type ProductionQuoteSnapshot={
  quoteId:string;
  currency:string;
  total:number;
  status:string;
  createdAt:string;
};

export type ProductionOrderSnapshot={
  orderId:string;
  status:string;
  createdAt:string;
};

export type ProductionPacketInput={
  revision:LockedDesignRevision;
  quote?:ProductionQuoteSnapshot|null;
  order?:ProductionOrderSnapshot|null;
};

function assembleProductionPacket(input:ProductionPacketInput,handoff:ProductionHandoff){
  const quote=input.quote??null;
  const order=input.order??null;
  return {
    version:"linen-earth-production-packet-v1" as const,
    generatedAt:new Date().toISOString(),
    revisionId:input.revision.revisionId,
    recipeHash:input.revision.recipeHash,
    handoff,
    quote,
    order,
    traceability:{
      immutableRecipe:true,
      packetBuiltFromLockedRevision:true,
      quoteAttached:Boolean(quote),
      quoteAccepted:quote?.status==="accepted",
      orderAttached:Boolean(order),
      noDesignDataReEntry:false,
      deliveryAuditRequired:true,
      note:"Packet generation proves locked-recipe traceability only. Zero manual re-entry is verified separately after real delivery.",
    },
  };
}

/** Legacy pure packet constructor. Callers with user-provided or recovered
 * revisions must use the verified variant before export or production work.
 */
export function buildProductionPacket(input:ProductionPacketInput){
  return assembleProductionPacket(input,buildProductionHandoff(input.revision));
}

/** Only a SHA256-verified locked revision may produce an operator download. */
export async function buildVerifiedProductionPacket(input:ProductionPacketInput){
  const handoff=await buildVerifiedProductionHandoff(input.revision);
  return assembleProductionPacket(input,handoff);
}
