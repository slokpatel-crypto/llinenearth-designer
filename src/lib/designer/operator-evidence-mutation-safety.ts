/** Privileged production evidence writes must not accept cross-origin browser
 * requests or simple form content types, including requests with no Origin. */
export function operatorEvidenceMutationRequestError(
  request:Pick<Request,"url"|"headers">,
  maxBytes=32_768,
):{status:number;error:string}|null{
  const origin=request.headers.get("origin");
  if(origin){
    let expected:string;
    try{expected=new URL(request.url).origin;}
    catch{return {status:403,error:"Invalid evidence request origin."};}
    if(origin!==expected)
      return {status:403,error:"Cross-site production evidence changes are not allowed."};
  }
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))
    return {status:415,error:"Production evidence mutations require JSON."};
  const length=request.headers.get("content-length");
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes))
    return {status:413,error:"Production evidence payload is too large."};
  return null;
}
