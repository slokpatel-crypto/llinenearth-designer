import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { DesignerClimate, DesignerIntention, DesignerStyle, OccasionTier } from "./engine";

const VERSION="v1";
const MAX_AGE_MS=2*60*60*1000;

export type StyleDirectorHandoffPayload={
  version:"linen-earth-style-director-handoff-v1";
  sourceLookId:string;
  shirtId:string;
  pantId:string;
  occasion:OccasionTier;
  climate:DesignerClimate;
  intention:DesignerIntention;
  style:DesignerStyle;
  expiresAt:number;
};

function secret(){
  const value=process.env.LINEN_MEMORY_SESSION_SECRET?.trim() || "";
  return value.length>=32?value:null;
}

function encode(value:string){return Buffer.from(value,"utf8").toString("base64url");}
function decode(value:string){return Buffer.from(value,"base64url").toString("utf8");}

function signature(body:string){
  const key=secret();
  if(!key) return null;
  return createHmac("sha256",key).update(VERSION+"."+body).digest("base64url");
}

export function styleDirectorHandoffConfigured(){return Boolean(secret());}

export function createStyleDirectorHandoffToken(
  input:Omit<StyleDirectorHandoffPayload,"version"|"expiresAt">,
  now=Date.now(),
){
  const payload:StyleDirectorHandoffPayload={
    version:"linen-earth-style-director-handoff-v1",
    ...input,
    expiresAt:now+MAX_AGE_MS,
  };
  const body=encode(JSON.stringify(payload));
  const sig=signature(body);
  return sig?VERSION+"."+body+"."+sig:null;
}

export function verifyStyleDirectorHandoffToken(token:string,now=Date.now()):StyleDirectorHandoffPayload|null{
  const [version,body,supplied,extra]=String(token||"").split(".");
  if(version!==VERSION||!body||!supplied||extra) return null;
  const expected=signature(body);
  if(!expected) return null;
  const a=Buffer.from(expected);
  const b=Buffer.from(supplied);
  if(a.length!==b.length||!timingSafeEqual(a,b)) return null;
  try{
    const payload=JSON.parse(decode(body)) as StyleDirectorHandoffPayload;
    if(payload.version!=="linen-earth-style-director-handoff-v1") return null;
    if(!payload.sourceLookId||!payload.shirtId||!payload.pantId) return null;
    if(!Number.isFinite(payload.expiresAt)||payload.expiresAt<now||payload.expiresAt>now+MAX_AGE_MS+60_000) return null;
    return payload;
  }catch{return null;}
}

function canonical(value:unknown):string{
  if(Array.isArray(value)) return "["+value.map(canonical).join(",")+"]";
  if(value&&typeof value==="object"){
    return "{"+Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>JSON.stringify(key)+":"+canonical(item)).join(",")+"}";
  }
  return JSON.stringify(value);
}

export function styleDirectorHandoffMatches(
  payload:StyleDirectorHandoffPayload,
  observed:{shirtId:string;pantId:string;occasion:OccasionTier;style:DesignerStyle},
){
  return payload.shirtId===observed.shirtId
    && payload.pantId===observed.pantId
    && payload.occasion===observed.occasion
    && canonical(payload.style)===canonical(observed.style);
}
