import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type CustomerSessionIdentity={id:string;email:string|null};

const VERSION="lecs1";
// Require canonical PostgreSQL/Supabase UUIDs for signed customer ownership.
// Permissive UUID-looking values must not become an authenticated RPC owner.
const CUSTOMER_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validCustomerSessionIdentityId(value:unknown):value is string{
  return typeof value==="string"&&CUSTOMER_UUID.test(value);
}
export const CUSTOMER_SESSION_MAX_AGE_SECONDS=30*24*60*60;

function cleanEmail(value:unknown){
  const email=String(value??"").trim().toLowerCase();
  return email&&email.length<=254?email:null;
}

function sign(secret:string,payload:string){
  return createHmac("sha256",secret).update(`${VERSION}.${payload}`).digest("base64url");
}

export function createCustomerSessionToken(
  secret:string,
  identity:CustomerSessionIdentity,
  now=Date.now(),
){
  if(secret.length<32) throw new Error("Customer session secret is too short.");
  const id=String(identity.id||"").trim();
  if(!validCustomerSessionIdentityId(id)) throw new Error("Customer identity is invalid.");
  const payload=Buffer.from(JSON.stringify({
    v:1,
    id,
    email:cleanEmail(identity.email),
    // Independent sign-ins must never share the same revocation identity,
    // even if the same customer logs in within the same millisecond.
    nonce:randomBytes(16).toString("base64url"),
    exp:now+CUSTOMER_SESSION_MAX_AGE_SECONDS*1000,
  }),"utf8").toString("base64url");
  return `${VERSION}.${payload}.${sign(secret,payload)}`;
}

export function verifyCustomerSessionToken(
  secret:string,
  token:unknown,
  now=Date.now(),
):CustomerSessionIdentity|null{
  if(secret.length<32) return null;
  const [version,payload,supplied,extra]=String(token||"").split(".");
  if(typeof token!=="string"||token.length>2_048||
    version!==VERSION||!payload||!supplied||extra||
    !/^[A-Za-z0-9_-]+$/.test(payload)||!/^[A-Za-z0-9_-]{43}$/.test(supplied))
    return null;
  const expected=sign(secret,payload);
  const a=Buffer.from(expected);
  const b=Buffer.from(supplied);
  if(a.length!==b.length||!timingSafeEqual(a,b)) return null;
  try{
    const data=JSON.parse(Buffer.from(payload,"base64url").toString("utf8")) as {
      v?:number;id?:string;email?:string|null;exp?:number;nonce?:unknown;
    };
    if(data.v!==1||!validCustomerSessionIdentityId(data.id)) return null;
    // Compatibility: existing signed lecs1 cookies predate the nonce field.
    // New cookies must carry a canonical 128-bit nonce. The HMAC authenticates
    // presence/absence alike, so this does not weaken the legacy check.
    if(data.nonce!==undefined&&
      (typeof data.nonce!=="string"||!/^[A-Za-z0-9_-]{22}$/.test(data.nonce)||
        Buffer.from(data.nonce,"base64url").toString("base64url")!==data.nonce))
      return null;
    if(typeof data.exp!=="number"||data.exp<=now||data.exp>now+CUSTOMER_SESSION_MAX_AGE_SECONDS*1000+60_000) return null;
    return {id:data.id,email:cleanEmail(data.email)};
  }catch{
    return null;
  }
}
