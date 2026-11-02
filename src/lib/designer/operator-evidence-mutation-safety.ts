/** Privileged production evidence writes must not accept cross-origin browser
 * requests or simple form content types, including requests with no Origin. */
export function operatorEvidenceMutationRequestError(
  request:Pick<Request,"url"|"headers">,
  maxBytes=32_768,
):{status:number;error:string}|null{
  const origin=request.headers.get("origin");
  if(origin){
    let allowed=false;
    try{
      const claimed=new URL(origin);
      const effective=new URL(request.url);
      const rawHost=request.headers.get("host");
      // Next can construct its internal Request.url with a localhost host
      // behind a proxy. The browser-controlled Origin must match EITHER that
      // URL or the actual Host header; browsers cannot spoof Host via fetch.
      // Scheme must agree with the effective URL unless HTTPS was terminated
      // upstream (internal HTTP + external HTTPS).
      const matchesHost=rawHost!==null&&
        claimed.host.toLowerCase()===rawHost.toLowerCase()&&
        (claimed.protocol===effective.protocol||
          (effective.protocol==="http:"&&claimed.protocol==="https:"));
      allowed=claimed.origin===effective.origin||matchesHost;
    }catch{allowed=false;}
    if(!allowed)
      return {status:403,error:"Cross-site production evidence changes are not allowed."};
  }
  // Fetch Metadata is an independent browser signal when a reverse proxy
  // drops Origin. A same-site subdomain is not the same authenticated origin.
  const fetchSite=request.headers.get("sec-fetch-site");
  if(fetchSite&&fetchSite!=="same-origin"&&fetchSite!=="none")
    return {status:403,error:"Cross-site production evidence changes are not allowed."};
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))
    return {status:415,error:"Production evidence mutations require JSON."};
  const length=request.headers.get("content-length");
  if(length!==null&&(!/^\d+$/.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>maxBytes))
    return {status:413,error:"Production evidence payload is too large."};
  return null;
}
