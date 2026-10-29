/** A legacy public gallery is untrusted, optional stock-discovery context.
 * Never let a huge or stalled third-party HTML response block the verified
 * first-party stock path. This does not establish physical availability.
 */
export const MAX_LEGACY_GALLERY_HTML_BYTES = 2 * 1024 * 1024;

export async function readBoundedLegacyGalleryHtml(response:Response):Promise<string> {
  const lengthHeader=response.headers.get("content-length");
  if(lengthHeader!==null){
    const declared=Number(lengthHeader);
    if(Number.isFinite(declared)&&declared>MAX_LEGACY_GALLERY_HTML_BYTES)
      throw new Error("Legacy gallery response exceeds size limit.");
  }
  if(!response.body) return "";
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  let bytes=0;
  let html="";
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done) break;
      bytes+=value.byteLength;
      if(bytes>MAX_LEGACY_GALLERY_HTML_BYTES){
        await reader.cancel();
        throw new Error("Legacy gallery streamed response exceeds size limit.");
      }
      html+=decoder.decode(value,{stream:true});
    }
    return html+decoder.decode();
  }finally{
    reader.releaseLock();
  }
}
