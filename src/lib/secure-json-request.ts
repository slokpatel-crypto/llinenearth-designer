/** Service-role and public Designer JSON endpoints must bound streamed bytes and reject cross-site writes. */
export class SecureJsonBodyTooLarge extends Error {}
export class SecureJsonBodyInvalid extends Error {}

/** For bodyless state-changing endpoints such as sign-out; JSON routes use
 * the same check before parsing any attacker-controlled request bytes.
 */
export function secureSameOriginRequestError(
  request:Pick<Request,"url"|"headers">,
):{status:number;error:string}|null{
  const unsafeOrigin=secureSameOriginRequestError(request);
  if(unsafeOrigin) return unsafeOrigin;
  return null;
}

export function secureJsonRequestError(
  request:Pick<Request,"url"|"headers">,
  maxBytes:number,
):{status:number;error:string}|null{
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1) throw new Error("Invalid JSON request byte limit.");
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)
    return {status:403,error:"Cross-site changes are not allowed."};
  const fetchSite=request.headers.get("sec-fetch-site");
  if(fetchSite&&fetchSite!=="same-origin"&&fetchSite!=="none")
    return {status:403,error:"Cross-site changes are not allowed."};
  if(!/^application\/json(?:\s*;\s*charset=utf-8\s*)?$/i.test(request.headers.get("content-type")||""))
    return {status:415,error:"This operation requires JSON."};
  const length=request.headers.get("content-length");
  if(length!==null&&(!/^\d+$/.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>maxBytes))
    return {status:413,error:"Request payload is too large."};
  return null;
}

export async function readSecureJsonObject(request:Request,maxBytes:number):Promise<Record<string,unknown>>{
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1) throw new Error("Invalid JSON request byte limit.");
  if(!request.body) throw new SecureJsonBodyInvalid("A JSON request body is required.");
  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[];
  let total=0;
  try{
    while(true){
      const next=await reader.read();
      if(next.done) break;
      total+=next.value.byteLength;
      if(total>maxBytes){
        await reader.cancel();
        throw new SecureJsonBodyTooLarge("Request payload is too large.");
      }
      chunks.push(next.value);
    }
  }finally{reader.releaseLock();}
  const data=new Uint8Array(total);
  let offset=0;
  for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
  let parsed:unknown;
  try{parsed=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(data));}
  catch{throw new SecureJsonBodyInvalid("Request body must be valid UTF-8 JSON.");}
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))
    throw new SecureJsonBodyInvalid("Request JSON must be an object.");
  return parsed as Record<string,unknown>;
}
