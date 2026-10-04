import "server-only";
import { normalizeCustomerEmail } from "@/lib/customer-account";
import { CUSTOMER_SESSION_COOKIE, verifySignedCustomerSession } from "@/lib/customer-session";
export { normalizeCustomerEmail } from "@/lib/customer-account";

export type CustomerIdentity = {
  id:string;
  email:string|null;
};

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
    const detail=(await response.text()).slice(0,240);
    throw new Error(`Customer OTP request failed (${response.status}): ${detail}`);
  }
}

export async function verifyCustomerOtp(email:string,token:string):Promise<SupabaseAuthSession>{
  const response=await authFetch("/auth/v1/verify",{
    method:"POST",
    body:JSON.stringify({email,token,type:"email"}),
  });
  if(!response.ok){
    const detail=(await response.text()).slice(0,240);
    throw new Error(`Customer OTP verification failed (${response.status}): ${detail}`);
  }
  return await response.json() as SupabaseAuthSession;
}

export async function getCustomerIdentity(request:Request):Promise<CustomerIdentity|null>{
  const durable=verifySignedCustomerSession(readCookie(request,CUSTOMER_SESSION_COOKIE));
  if(durable) return durable;

  // Backward-compatible bridge for sessions created before the durable
  // Linen Earth customer-session cookie was introduced.
  const token=readCookie(request,CUSTOMER_ACCESS_COOKIE);
  if(!token) return null;
  const response=await authFetch("/auth/v1/user",{
    method:"GET",
    headers:{authorization:`Bearer ${token}`},
  });
  if(!response.ok) return null;
  const user=await response.json() as {id?:string;email?:string|null};
  if(!user.id) return null;
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
