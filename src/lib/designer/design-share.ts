// Server-only by dependency: this module imports node:crypto and is only called by server routes/pages.
import { createHmac, timingSafeEqual } from "node:crypto";
import { readBrandEnv } from "@/lib/runtime-compat";
import type { LockedDesignRevision } from "@/lib/designer/design-lock";

const VERSION="v1";
const MAX_AGE_MS=30*24*60*60*1000;

export type SharedDesignPayload={
  version:"linen-earth-share-v1";
  revisionId:string;
  recipeHash:string;
  expiresAt:number;
  context:LockedDesignRevision["garmentSpec"]["context"];
  fabrics:{
    shirt:{id:string;name:string;line:string};
    trouser:{id:string;name:string;line:string};
  };
  shirt:{
    fit:string;wear:string;collar:string;collarFinish:string;cuff:string;placket:string;button:string;
  };
  trouser:{
    shape:string;rise:string;waistband:string;break:string;
  };
  creative:{
    conceptId:string;
    name:string;
    treatments:Array<{id:string;zone:string;label:string;instruction:string}>;
    pattern:{id:string;name:string;family:string;placement:string}|null;
  }|null;
};

function secret(){
  const value=readBrandEnv("LINEN_DESIGN_SHARE_SECRET") || readBrandEnv("LINEN_MEMORY_SESSION_SECRET");
  return value && value.length>=32 ? value : null;
}

export function designShareConfigured(){return Boolean(secret());}

function encode(value:string){return Buffer.from(value,"utf8").toString("base64url");}
function decode(value:string){return Buffer.from(value,"base64url").toString("utf8");}

function signature(body:string){
  const key=secret();
  if(!key) return null;
  return createHmac("sha256",key).update(`${VERSION}.${body}`).digest("base64url");
}

export function sharePayloadFromRevision(revision:LockedDesignRevision,now=Date.now()):SharedDesignPayload {
  const spec=revision.garmentSpec;
  return {
    version:"linen-earth-share-v1",
    revisionId:revision.revisionId,
    recipeHash:revision.recipeHash,
    expiresAt:now+MAX_AGE_MS,
    context:{...spec.context},
    fabrics:{
      shirt:{id:spec.fabrics.shirt.id,name:spec.fabrics.shirt.name,line:spec.fabrics.shirt.line},
      trouser:{id:spec.fabrics.trouser.id,name:spec.fabrics.trouser.name,line:spec.fabrics.trouser.line},
    },
    shirt:{
      fit:spec.shirt.fit,wear:spec.shirt.wear,collar:spec.shirt.collar,collarFinish:spec.shirt.collarFinish,
      cuff:spec.shirt.cuff,placket:spec.shirt.placket,button:spec.shirt.button,
    },
    trouser:{
      shape:spec.trouser.shape,rise:spec.trouser.rise,waistband:spec.trouser.waistband,break:spec.trouser.break,
    },
    creative:spec.creative ? {
      conceptId:spec.creative.conceptId,
      name:spec.creative.name,
      treatments:spec.creative.treatments.slice(0,8).map((item)=>({
        id:item.id,zone:item.zone,label:item.label,instruction:item.instruction,
      })),
      pattern:spec.creative.pattern ? {
        id:spec.creative.pattern.id,
        name:spec.creative.pattern.name,
        family:spec.creative.pattern.family,
        placement:spec.creative.pattern.placement,
      } : null,
    } : null,
  };
}

export function createDesignShareToken(revision:LockedDesignRevision,now=Date.now()){
  const payload=sharePayloadFromRevision(revision,now);
  const body=encode(JSON.stringify(payload));
  const sig=signature(body);
  if(!sig) return null;
  return `${VERSION}.${body}.${sig}`;
}

export function verifyDesignShareToken(token:string,now=Date.now()):SharedDesignPayload|null {
  const [version,body,supplied,extra]=token.split(".");
  if(version!==VERSION||!body||!supplied||extra) return null;
  const expected=signature(body);
  if(!expected) return null;
  const a=Buffer.from(expected);
  const b=Buffer.from(supplied);
  if(a.length!==b.length||!timingSafeEqual(a,b)) return null;
  try{
    const payload=JSON.parse(decode(body)) as SharedDesignPayload;
    if(payload.version!=="linen-earth-share-v1") return null;
    if(!payload.revisionId||!payload.recipeHash||!Number.isFinite(payload.expiresAt)||payload.expiresAt<now) return null;
    if(payload.expiresAt>now+MAX_AGE_MS+60_000) return null;
    if(!payload.fabrics?.shirt?.id||!payload.fabrics?.trouser?.id) return null;
    return payload;
  }catch{
    return null;
  }
}
