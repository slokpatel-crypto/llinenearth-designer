import { FABRIC_STOCK } from "../fabric-stock.ts";

const KNOWN_CATALOGUE_FABRICS=new Set(FABRIC_STOCK.map(fabric=>fabric.id));

/** Physical stock records are meaningful only for published supplier SKUs. */
export function assertCurrentFabricId(id:string):void {
  if(!KNOWN_CATALOGUE_FABRICS.has(id))
    throw new Error("Selected fabric is not in the published Linen Earth supplier catalogue.");
}

/** Operator writes use service-role credentials: protect them before any RPC. */
export function stockMutationRequestError(request:Pick<Request,"url"|"headers">):
  {status:number;error:string}|null {
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)
    return {status:403,error:"Cross-site stock changes are not allowed."};
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))
    return {status:415,error:"Stock mutations require JSON."};
  const length=request.headers.get("content-length");
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>24_000))
    return {status:413,error:"Stock mutation payload is too large."};
  return null;
}
