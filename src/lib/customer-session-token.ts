import { createHmac, timingSafeEqual } from "node:crypto";

export type CustomerSessionIdentity={id:string;email:string|null};

const VERSION="lecs1";
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
  if(!/^[0-9a-f-]{20,80}$/i.test(id)) throw new Error("Customer identity is invalid.");
  const payload=Buffer.from(JSON.stringify({
    v:1,
    id,
    email:cleanEmail(identity.email),
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
  if(version!==VERSION||!payload||!supplied||extra) return null;
  const expected=sign(secret,payload);
  const a=Buffer.from(expected);
  const b=Buffer.from(supplied);
  if(a.length!==b.length||!timingSafeEqual(a,b)) return null;
  try{
    const data=JSON.parse(Buffer.from(payload,"base64url").toString("utf8")) as {
      v?:number;id?:string;email?:string|null;exp?:number;
    };
    if(data.v!==1||typeof data.id!=="string"||!/^[0-9a-f-]{20,80}$/i.test(data.id)) return null;
    if(typeof data.exp!=="number"||data.exp<=now||data.exp>now+CUSTOMER_SESSION_MAX_AGE_SECONDS*1000+60_000) return null;
    return {id:data.id,email:cleanEmail(data.email)};
  }catch{
    return null;
  }
}
