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
  const fetchSite=request.headers.get("sec-fetch-site");
  if(fetchSite&&fetchSite!=="same-origin"&&fetchSite!=="none")
    return {status:403,error:"Cross-site stock changes are not allowed."};
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))
    return {status:415,error:"Stock mutations require JSON."};
  const length=request.headers.get("content-length");
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>24_000))
    return {status:413,error:"Stock mutation payload is too large."};
  return null;
}

/**
 * Content-Length can be omitted (e.g. chunked requests), so a header-only
 * check does not bound service-role mutation input. Count actual UTF-8 bytes
 * before ever parsing JSON; reject rather than truncating a physical record.
 */
export class StockMutationPayloadTooLarge extends Error {}

export async function readBoundedStockMutationJson(request:Request):Promise<Record<string,unknown>>{
  if(!request.body) throw new Error("Stock mutation body is required.");
  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[];
  let total=0;
  try{
    while(true){
      const next=await reader.read();
      if(next.done) break;
      total+=next.value.byteLength;
      if(total>24_000){
        await reader.cancel();
        throw new StockMutationPayloadTooLarge("Stock mutation payload is too large.");
      }
      chunks.push(next.value);
    }
  }finally{
    reader.releaseLock();
  }
  const data=new Uint8Array(total);
  let offset=0;
  for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
  let parsed:unknown;
  try{
    parsed=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(data));
  }catch{
    throw new Error("Stock mutation body must be valid UTF-8 JSON.");
  }
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))
    throw new Error("Stock mutation JSON must be an object.");
  return parsed as Record<string,unknown>;
}
