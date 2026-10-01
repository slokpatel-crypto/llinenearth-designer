import type { LockedDesignRevision } from "./design-lock.ts";
import { buildProductionHandoff } from "./production-handoff.ts";

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

export function buildProductionPacket(input:{
  revision:LockedDesignRevision;
  quote?:ProductionQuoteSnapshot|null;
  order?:ProductionOrderSnapshot|null;
}){
  const handoff=buildProductionHandoff(input.revision);
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
      quoteAttached:Boolean(quote),
      quoteAccepted:quote?.status==="accepted",
      orderAttached:Boolean(order),
      noDesignDataReEntry:true,
    },
  };
}
