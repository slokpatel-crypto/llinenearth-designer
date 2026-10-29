/** Fail closed on oversized upstream JSON, including decoded transfer streams.
 * Limits peak memory before JSON.parse and is independent of Content-Length. */
export async function readBoundedJsonResponse(response:Response,maxBytes:number):Promise<unknown> {
  if(!Number.isSafeInteger(maxBytes)||maxBytes<2||!response.body)
    throw new Error("Invalid bounded JSON response");
  const reader=response.body.getReader();
  const chunks:Uint8Array[]=[];
  let size=0;
  let completed=false;
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done){completed=true;break;}
      if(!value) continue;
      if(size+value.byteLength>maxBytes)
        throw new Error("Upstream JSON response exceeds allowed size");
      chunks.push(value);
      size+=value.byteLength;
    }
  } finally {
    if(!completed) {
      try { await reader.cancel(); } catch { /* Preserve the original read failure. */ }
    }
    reader.releaseLock();
  }
  const bytes=new Uint8Array(size);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)) as unknown;
}
