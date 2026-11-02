import "server-only";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import { normalizeCustomerEmail } from "@/lib/customer-account";
import { CUSTOMER_SESSION_COOKIE, verifySignedCustomerSession } from "@/lib/customer-session";
import { validCustomerSessionIdentityId } from "@/lib/customer-session-token";
import { customerSessionBearerAllowed, customerSessionRevocationRequired } from "@/lib/customer-session-revocation";
export { normalizeCustomerEmail } from "@/lib/customer-account";

export type CustomerIdentity = {
  id:string;
  email:string|null;
};

const MAX_VERIFY_PROVIDER_BYTES=65_536;
const MAX_LEGACY_USER_PROVIDER_BYTES=16_384;
function jsonProviderResponse(response:Response){
  return response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()==="application/json";
}

type SupabaseAuthSession = {
  access_token?:string;
  refresh_token?:string;
  expires_in?:number;
  user?:{id?:string;email?:string|null};
};

export const CUSTOMER_ACCESS_COOKIE="le_customer_access";
export const CUSTOMER_REFRESH_COOKIE="le_customer_refresh";

function publicConfig(){
  const url=process.env.SUPABASE_URL?.trim()?.replace(/\/$/,"");
  const key=(process.env.SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if(!url||!key) return null;
  return {url,key};
}

export function readCookie(request:Request,name:string){
  const raw=request.headers.get("cookie")||"";
  for(const part of raw.split(";")){
    const [key,...rest]=part.trim().split("=");
    if(key===name){try{return decodeURIComponent(rest.join("="));}catch{return "";}}
  }
  return "";
}

async function authFetch(path:string,init:RequestInit){
  const config=publicConfig();
  if(!config) throw new Error("Customer authentication is not configured.");
  return fetch(config.url+path,{
    ...init,
    headers:{
      apikey:config.key,
      "content-type":"application/json",
      accept:"application/json",
      ...(init.headers||{}),
    },
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
}

export async function requestCustomerOtp(email:string){
  const response=await authFetch("/auth/v1/otp",{
    method:"POST",
    body:JSON.stringify({email,create_user:true}),
  });
  if(!response.ok){
    // Error bodies can contain private identifiers or be arbitrarily large.
    throw new Error(`Customer OTP request failed (${response.status}).`);
  }
}

export async function verifyCustomerOtp(email:string,token:string):Promise<SupabaseAuthSession>{
  const response=await authFetch("/auth/v1/verify",{
    method:"POST",
    body:JSON.stringify({email,token,type:"email"}),
  });
  if(!response.ok){
    throw new Error(`Customer OTP verification failed (${response.status}).`);
  }
  if(!jsonProviderResponse(response))throw new Error("Invalid customer OTP provider content type.");
  const payload=await readBoundedJsonResponse(response,MAX_VERIFY_PROVIDER_BYTES);
  if(!payload||typeof payload!=="object"||Array.isArray(payload))
    throw new Error("Invalid customer OTP provider response.");
  return payload as SupabaseAuthSession;
}

export async function getCustomerIdentity(request:Request):Promise<CustomerIdentity|null>{
  const signedCookie=readCookie(request,CUSTOMER_SESSION_COOKIE);
  if(signedCookie){
    // A malformed/expired signed cookie must not silently downgrade to a legacy token.
    const identity=verifySignedCustomerSession(signedCookie);
    if(!identity)return null;
    return await customerSessionBearerAllowed(signedCookie)?identity:null;
  }
  // Once revocation is enforced, legacy bearer cookies cannot bypass it.
  if(customerSessionRevocationRequired())return null;

  // Backward-compatible bridge for sessions created before the durable
  // Linen Earth customer-session cookie was introduced.
  const token=readCookie(request,CUSTOMER_ACCESS_COOKIE);
  if(!token) return null;
  const response=await authFetch("/auth/v1/user",{
    method:"GET",
    headers:{authorization:`Bearer ${token}`},
  });
  if(!response.ok) return null;
  if(!jsonProviderResponse(response))return null;
  const raw=await readBoundedJsonResponse(response,MAX_LEGACY_USER_PROVIDER_BYTES);
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
  const user=raw as {id?:string;email?:string|null};
  if(!validCustomerSessionIdentityId(user.id)) return null;
  return {id:user.id,email:user.email||null};
}

export function authCookieOptions(maxAge:number){
  return {
    httpOnly:true,
    secure:process.env.NODE_ENV==="production",
    sameSite:"lax" as const,
    path:"/",
    maxAge:Math.max(60,Math.min(Math.floor(maxAge||3600),60*60*24*7)),
  };
}
